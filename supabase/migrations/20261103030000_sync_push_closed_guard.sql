CREATE OR REPLACE FUNCTION public.sync_push(_code text, _token text, _records jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
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
   -- Shift / hari usaha yang sudah ditutup tidak boleh dibuka lagi oleh salinan lama.
   IF r->>'c' IN ('shifts','businessDays') AND previous_data->>'closedAt' IS NOT NULL AND r->'d'->>'closedAt' IS NULL THEN CONTINUE; END IF;
   -- Transaksi selesai tidak boleh mundur oleh salinan lama; dilewati tanpa menggagalkan kiriman lain.
   IF r->>'c'='sales' AND previous_data->>'status' IN ('paid','void','refunded') AND coalesce(r->'d'->>'status','') NOT IN ('paid','void','refunded') THEN CONTINUE; END IF;
  END IF;
  INSERT INTO public.store_records(store_id,collection,record_id,data,deleted,device_id) VALUES(sid,r->>'c',r->>'id',CASE WHEN coalesce((r->>'del')::boolean,false) THEN previous_data ELSE r->'d' END,coalesce((r->>'del')::boolean,false),did)
  ON CONFLICT(store_id,collection,record_id) DO UPDATE SET data=EXCLUDED.data,deleted=EXCLUDED.deleted,device_id=EXCLUDED.device_id,updated_at=now(),seq=nextval('public.store_records_seq');
  n:=n+1;
 END LOOP;
 RETURN n;
END $fn$;
