CREATE TABLE public.store_record_versions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 store_id uuid NOT NULL,
 collection text NOT NULL,
 record_id text NOT NULL,
 data jsonb,
 deleted boolean NOT NULL,
 source_seq bigint NOT NULL,
 source_device_id uuid,
 archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 operation text NOT NULL
);
GRANT SELECT ON public.store_record_versions TO authenticated;
GRANT ALL ON public.store_record_versions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.store_record_versions_id_seq TO service_role;
ALTER TABLE public.store_record_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Developer reads record archives" ON public.store_record_versions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'developer'));
CREATE INDEX store_record_versions_lookup ON public.store_record_versions(store_id, collection, record_id, archived_at DESC);
INSERT INTO public.store_record_versions(store_id,collection,record_id,data,deleted,source_seq,source_device_id,operation)
 SELECT store_id,collection,record_id,data,deleted,seq,device_id,'initial_snapshot' FROM public.store_records;
CREATE TABLE public.sync_deletion_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 store_id uuid NOT NULL,
 device_id uuid NOT NULL,
 collection text NOT NULL,
 record_id text NOT NULL,
 reported_actor text NOT NULL,
 action_at timestamptz NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT ON public.sync_deletion_audit TO authenticated;
GRANT ALL ON public.sync_deletion_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sync_deletion_audit_id_seq TO service_role;
ALTER TABLE public.sync_deletion_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Developer reads deletion audit" ON public.sync_deletion_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'developer'));
CREATE INDEX sync_deletion_audit_window ON public.sync_deletion_audit(store_id,accepted_at);
CREATE OR REPLACE FUNCTION public.archive_store_record() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  INSERT INTO public.store_record_versions(store_id,collection,record_id,data,deleted,source_seq,source_device_id,operation) VALUES(NEW.store_id,NEW.collection,NEW.record_id,NEW.data,NEW.deleted,NEW.seq,NEW.device_id,'insert');
  RETURN NEW;
 END IF;
 INSERT INTO public.store_record_versions(store_id,collection,record_id,data,deleted,source_seq,source_device_id,operation) VALUES(OLD.store_id,OLD.collection,OLD.record_id,OLD.data,OLD.deleted,OLD.seq,OLD.device_id,lower(TG_OP)||'_before');
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 INSERT INTO public.store_record_versions(store_id,collection,record_id,data,deleted,source_seq,source_device_id,operation) VALUES(NEW.store_id,NEW.collection,NEW.record_id,NEW.data,NEW.deleted,NEW.seq,NEW.device_id,'update_after');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.archive_store_record() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER archive_store_record_changes AFTER INSERT OR UPDATE OR DELETE ON public.store_records FOR EACH ROW EXECUTE FUNCTION public.archive_store_record();
CREATE OR REPLACE FUNCTION public.sync_push(_code text, _token text, _records jsonb) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; did uuid; r jsonb; n bigint := 0; deletion_count integer; recent_count integer; previous_data jsonb;
BEGIN
 SELECT x.store_id,x.device_id INTO sid,did FROM public._sync_device(_code,_token) x;
 IF sid IS NULL THEN RAISE EXCEPTION 'SYNC_DENIED: Perangkat tidak terdaftar untuk store online ini.'; END IF;
 IF _records IS NULL OR jsonb_typeof(_records) <> 'array' OR jsonb_array_length(_records)>500 THEN RAISE EXCEPTION 'SYNC_INVALID: Format data tidak valid'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(sid::text,0));
 SELECT count(*) INTO deletion_count FROM jsonb_array_elements(_records) e WHERE coalesce((e->>'del')::boolean,false);
 IF deletion_count>0 THEN
  SELECT count(*) INTO recent_count FROM public.sync_deletion_audit WHERE store_id=sid AND accepted_at>clock_timestamp()-interval '1 minute';
  IF deletion_count+recent_count>20 THEN RAISE EXCEPTION 'SYNC_SAFETY: Penghapusan massal diblokir. Data pusat tetap tersimpan.'; END IF;
 END IF;
 FOR r IN SELECT * FROM jsonb_array_elements(_records) LOOP
  IF coalesce(r->>'c','') NOT IN ('users','categories','products','modifiers','paymentMethods','tables','staff','onlineChannels','serviceTypes','sales','heldOrders','kitchenOrders','shifts','businessDays','members','memberPoints','financeCategories','financeEntries','deletedFinance','stockItems','stockMoves','settings') OR length(coalesce(r->>'id','')) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'SYNC_INVALID: Identitas catatan tidak valid'; END IF;
  SELECT data INTO previous_data FROM public.store_records WHERE store_id=sid AND collection=r->>'c' AND record_id=r->>'id';
  IF coalesce((r->>'del')::boolean,false) THEN
   IF r->>'c' IN ('sales','shifts','businessDays','stockMoves','memberPoints','deletedFinance','settings') THEN RAISE EXCEPTION 'SYNC_SAFETY: Riwayat transaksi, kas, stok dan hari usaha tidak boleh dihapus melalui sinkronisasi.'; END IF;
   IF coalesce(r->>'intent','')<>'explicit-delete-v1' OR length(trim(coalesce(r->>'actor','')))=0 OR r->>'at' IS NULL THEN RAISE EXCEPTION 'SYNC_SAFETY: Penghapusan tanpa tindakan eksplisit diblokir. Perbarui aplikasi.'; END IF;
   INSERT INTO public.sync_deletion_audit(store_id,device_id,collection,record_id,reported_actor,action_at) VALUES(sid,did,r->>'c',r->>'id',left(r->>'actor',120),(r->>'at')::timestamptz);
  ELSE
   IF jsonb_typeof(r->'d') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'SYNC_INVALID: Isi catatan tidak valid'; END IF;
   IF r->>'c'='settings' AND (r->'d'->>'storeCode' IS DISTINCT FROM upper(trim(_code))) THEN RAISE EXCEPTION 'SYNC_SAFETY: Pengaturan store berbeda diblokir.'; END IF;
   IF r->>'c'='settings' AND (r->'d'->>'activated') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'SYNC_SAFETY: Pengaturan aktivasi kosong diblokir.'; END IF;
   IF r->>'c'='sales' AND previous_data->>'status' IN ('paid','void','refunded') AND r->'d'->>'status' NOT IN ('paid','void','refunded') THEN RAISE EXCEPTION 'SYNC_SAFETY: Transaksi selesai tidak boleh kembali menjadi pesanan kosong.'; END IF;
  END IF;
  INSERT INTO public.store_records(store_id,collection,record_id,data,deleted,device_id) VALUES(sid,r->>'c',r->>'id',CASE WHEN coalesce((r->>'del')::boolean,false) THEN previous_data ELSE r->'d' END,coalesce((r->>'del')::boolean,false),did)
  ON CONFLICT(store_id,collection,record_id) DO UPDATE SET data=EXCLUDED.data,deleted=EXCLUDED.deleted,device_id=EXCLUDED.device_id,updated_at=now(),seq=nextval('public.store_records_seq');
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_push(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_push(text,text,jsonb) TO anon,authenticated;