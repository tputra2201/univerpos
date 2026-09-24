-- Kunci aktivasi per store
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS activation_key text NOT NULL DEFAULT lpad((floor(random()*1000000))::int::text, 6, '0');

CREATE TABLE IF NOT EXISTS public.store_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  device_token text NOT NULL,
  device_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (store_id, device_token)
);

GRANT SELECT ON public.store_devices TO authenticated;
GRANT ALL ON public.store_devices TO service_role;

ALTER TABLE public.store_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dev view devices" ON public.store_devices
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'developer') OR public.has_role(auth.uid(), 'installer'));

CREATE POLICY "Dev manage devices" ON public.store_devices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'developer'));

-- Aktivasi mandiri: kode store + kunci aktivasi + token perangkat
CREATE OR REPLACE FUNCTION public.activate_device(_code text, _key text, _token text, _device_name text)
RETURNS TABLE(code text, name text, mode text, business_type_name text, base_kind text, max_devices int, device_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s record; used int; existing uuid;
BEGIN
  SELECT st.*, bt.name AS bt_name, bt.base_kind AS bt_kind
    INTO s
    FROM public.stores st
    LEFT JOIN public.business_types bt ON bt.id = st.business_type_id
   WHERE st.code = upper(trim(_code));

  IF s.id IS NULL OR trim(coalesce(_key,'')) <> s.activation_key THEN
    RAISE EXCEPTION 'INVALID: Kode store atau kunci aktivasi salah.';
  END IF;
  IF NOT s.active THEN
    RAISE EXCEPTION 'INACTIVE: Store ini dinonaktifkan. Hubungi penyedia aplikasi.';
  END IF;

  SELECT d.id INTO existing FROM public.store_devices d
   WHERE d.store_id = s.id AND d.device_token = _token;

  IF existing IS NULL THEN
    SELECT count(*) INTO used FROM public.store_devices d WHERE d.store_id = s.id AND d.is_active;
    IF s.max_devices > 0 AND used >= s.max_devices THEN
      RAISE EXCEPTION 'MAX_DEVICES: Store ini sudah mencapai batas maksimum % perangkat. Lepaskan perangkat lama di Pengaturan > Perangkat, atau hubungi penyedia aplikasi.', s.max_devices;
    END IF;
    INSERT INTO public.store_devices(store_id, device_token, device_name)
    VALUES (s.id, _token, left(coalesce(nullif(trim(_device_name),''),'Perangkat'), 60));
  ELSE
    UPDATE public.store_devices
       SET is_active = true, last_seen_at = now(),
           device_name = left(coalesce(nullif(trim(_device_name),''), device_name), 60)
     WHERE id = existing;
  END IF;

  SELECT count(*) INTO used FROM public.store_devices d WHERE d.store_id = s.id AND d.is_active;
  UPDATE public.stores SET device_count = used, last_activated_at = now(), last_activated_by = 'self-service'
   WHERE id = s.id;

  RETURN QUERY SELECT s.code, s.name, s.mode, coalesce(s.bt_name,''), coalesce(s.bt_kind,'retail'), s.max_devices, used;
END $$;

REVOKE ALL ON FUNCTION public.activate_device(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_device(text, text, text, text) TO anon, authenticated;

-- Daftar perangkat untuk store (butuh kode + kunci)
CREATE OR REPLACE FUNCTION public.store_devices_list(_code text, _key text)
RETURNS TABLE(id uuid, device_name text, is_active boolean, last_seen_at timestamptz, created_at timestamptz, max_devices int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE sid uuid; mx int;
BEGIN
  SELECT st.id, st.max_devices INTO sid, mx FROM public.stores st
   WHERE st.code = upper(trim(_code)) AND st.activation_key = trim(coalesce(_key,''));
  IF sid IS NULL THEN RAISE EXCEPTION 'INVALID: Kode store atau kunci aktivasi salah.'; END IF;
  RETURN QUERY
    SELECT d.id, d.device_name, d.is_active, d.last_seen_at, d.created_at, mx
      FROM public.store_devices d
     WHERE d.store_id = sid AND d.is_active
     ORDER BY d.created_at;
END $$;

REVOKE ALL ON FUNCTION public.store_devices_list(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_devices_list(text, text) TO anon, authenticated;

-- Lepas perangkat (membebaskan kuota)
CREATE OR REPLACE FUNCTION public.release_device(_code text, _key text, _device_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE sid uuid; used int;
BEGIN
  SELECT st.id INTO sid FROM public.stores st
   WHERE st.code = upper(trim(_code)) AND st.activation_key = trim(coalesce(_key,''));
  IF sid IS NULL THEN RAISE EXCEPTION 'INVALID: Kode store atau kunci aktivasi salah.'; END IF;
  UPDATE public.store_devices SET is_active = false WHERE id = _device_id AND store_id = sid;
  SELECT count(*) INTO used FROM public.store_devices d WHERE d.store_id = sid AND d.is_active;
  UPDATE public.stores SET device_count = used WHERE id = sid;
  RETURN used;
END $$;

REVOKE ALL ON FUNCTION public.release_device(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_device(text, text, uuid) TO anon, authenticated;