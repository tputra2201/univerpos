CREATE SEQUENCE IF NOT EXISTS public.store_records_seq;
CREATE TABLE public.store_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  collection text NOT NULL,
  record_id text NOT NULL,
  data jsonb,
  deleted boolean NOT NULL DEFAULT false,
  device_id uuid,
  seq bigint NOT NULL DEFAULT nextval('public.store_records_seq'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, collection, record_id)
);
CREATE INDEX store_records_seq_idx ON public.store_records(store_id, seq);
GRANT SELECT ON public.store_records TO authenticated;
GRANT ALL ON public.store_records TO service_role;
ALTER TABLE public.store_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dev view store records" ON public.store_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));

CREATE OR REPLACE FUNCTION public._sync_device(_code text, _token text)
RETURNS TABLE(store_id uuid, device_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.id, d.id FROM public.stores s JOIN public.store_devices d ON d.store_id = s.id
   WHERE s.code = upper(trim(_code)) AND s.active AND s.mode = 'online'
     AND d.device_token = _token AND d.is_active LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public._sync_device(text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_push(_code text, _token text, _records jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE sid uuid; did uuid; r jsonb; n bigint := 0;
BEGIN
  SELECT x.store_id, x.device_id INTO sid, did FROM public._sync_device(_code, _token) x;
  IF sid IS NULL THEN RAISE EXCEPTION 'SYNC_DENIED: Perangkat tidak terdaftar untuk store online ini.'; END IF;
  IF jsonb_typeof(_records) <> 'array' OR jsonb_array_length(_records) > 500 THEN
    RAISE EXCEPTION 'Format data tidak valid';
  END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(_records) LOOP
    INSERT INTO public.store_records(store_id, collection, record_id, data, deleted, device_id)
    VALUES (sid, left(r->>'c',40), left(r->>'id',120),
            CASE WHEN coalesce((r->>'del')::boolean,false) THEN NULL ELSE r->'d' END,
            coalesce((r->>'del')::boolean,false), did)
    ON CONFLICT (store_id, collection, record_id) DO UPDATE
      SET data = EXCLUDED.data, deleted = EXCLUDED.deleted, device_id = EXCLUDED.device_id,
          updated_at = now(), seq = nextval('public.store_records_seq');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.sync_pull(_code text, _token text, _since bigint)
RETURNS TABLE(collection text, record_id text, data jsonb, deleted boolean, seq bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE sid uuid;
BEGIN
  SELECT x.store_id INTO sid FROM public._sync_device(_code, _token) x;
  IF sid IS NULL THEN RAISE EXCEPTION 'SYNC_DENIED: Perangkat tidak terdaftar untuk store online ini.'; END IF;
  RETURN QUERY SELECT r.collection, r.record_id, r.data, r.deleted, r.seq
    FROM public.store_records r WHERE r.store_id = sid AND r.seq > coalesce(_since,0)
    ORDER BY r.seq LIMIT 1000;
END $$;

GRANT EXECUTE ON FUNCTION public.sync_push(text,text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_pull(text,text,bigint) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.check_store(text);
CREATE FUNCTION public.check_store(_code text)
RETURNS TABLE(active boolean, mode text, expires_at date, has_data boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.active, s.mode, s.expires_at,
         EXISTS(SELECT 1 FROM public.store_records r WHERE r.store_id = s.id)
    FROM public.stores s WHERE s.code = upper(trim(_code))
$$;
GRANT EXECUTE ON FUNCTION public.check_store(text) TO anon, authenticated;