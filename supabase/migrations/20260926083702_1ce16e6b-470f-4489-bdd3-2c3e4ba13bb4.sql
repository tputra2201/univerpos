ALTER TABLE public.store_devices ADD COLUMN IF NOT EXISTS is_developer boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.activate_device(_code text, _key text, _token text, _device_name text)
 RETURNS TABLE(code text, name text, mode text, business_type_name text, base_kind text, max_devices integer, device_count integer, expires_at date)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s record; used int; existing uuid;
BEGIN
  SELECT st.*, bt.name AS bt_name, bt.base_kind AS bt_kind INTO s
    FROM public.stores st LEFT JOIN public.business_types bt ON bt.id = st.business_type_id
   WHERE st.code = upper(trim(_code));
  IF s.id IS NULL OR trim(coalesce(_key,'')) <> s.activation_key THEN
    RAISE EXCEPTION 'INVALID: Kode store atau kunci aktivasi salah.';
  END IF;
  IF NOT s.active THEN
    RAISE EXCEPTION 'INACTIVE: Store ini dinonaktifkan. Hubungi penyedia aplikasi.';
  END IF;
  SELECT d.id INTO existing FROM public.store_devices d WHERE d.store_id = s.id AND d.device_token = _token;
  IF existing IS NULL THEN
    SELECT count(*) INTO used FROM public.store_devices d WHERE d.store_id = s.id AND d.is_active AND NOT d.is_developer;
    IF s.max_devices > 0 AND used >= s.max_devices THEN
      RAISE EXCEPTION 'MAX_DEVICES: Store ini sudah mencapai batas maksimum % perangkat. Lepaskan perangkat lama di Pengaturan > Perangkat, atau hubungi penyedia aplikasi.', s.max_devices;
    END IF;
    INSERT INTO public.store_devices(store_id, device_token, device_name)
    VALUES (s.id, _token, left(coalesce(nullif(trim(_device_name),''),'Perangkat'), 60));
  ELSE
    UPDATE public.store_devices SET is_active = true, last_seen_at = now(),
           device_name = left(coalesce(nullif(trim(_device_name),''), device_name), 60)
     WHERE id = existing;
  END IF;
  SELECT count(*) INTO used FROM public.store_devices d WHERE d.store_id = s.id AND d.is_active AND NOT d.is_developer;
  UPDATE public.stores SET device_count = used, last_activated_at = now(), last_activated_by = 'self-service' WHERE id = s.id;
  RETURN QUERY SELECT s.code, s.name, s.mode, coalesce(s.bt_name,''), coalesce(s.bt_kind,'retail'), s.max_devices, used, s.expires_at;
END $function$;

CREATE OR REPLACE FUNCTION public.release_device(_code text, _key text, _device_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE sid uuid; used int;
BEGIN
  SELECT st.id INTO sid FROM public.stores st
   WHERE st.code = upper(trim(_code)) AND st.activation_key = trim(coalesce(_key,''));
  IF sid IS NULL THEN RAISE EXCEPTION 'INVALID: Kode store atau kunci aktivasi salah.'; END IF;
  UPDATE public.store_devices SET is_active = false WHERE id = _device_id AND store_id = sid;
  SELECT count(*) INTO used FROM public.store_devices d WHERE d.store_id = sid AND d.is_active AND NOT d.is_developer;
  UPDATE public.stores SET device_count = used WHERE id = sid;
  RETURN used;
END $function$;

CREATE OR REPLACE FUNCTION public.store_devices_list(_code text, _key text)
 RETURNS TABLE(id uuid, device_name text, is_active boolean, last_seen_at timestamp with time zone, created_at timestamp with time zone, max_devices integer, device_model text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE sid uuid; mx int;
BEGIN
  SELECT st.id, st.max_devices INTO sid, mx FROM public.stores st
   WHERE st.code = upper(trim(_code)) AND st.activation_key = trim(coalesce(_key,''));
  IF sid IS NULL THEN RAISE EXCEPTION 'INVALID: Kode store atau kunci aktivasi salah.'; END IF;
  RETURN QUERY
    SELECT d.id, d.device_name, d.is_active, d.last_seen_at, d.created_at, mx, d.device_model
      FROM public.store_devices d WHERE d.store_id = sid AND d.is_active AND NOT d.is_developer ORDER BY d.created_at;
END $function$;

CREATE OR REPLACE FUNCTION public.dev_attach_device(_code text, _token text, _device_name text)
 RETURNS TABLE(code text, name text, mode text, business_type_name text, activation_key text, expires_at date, has_data boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'developer') THEN
    RAISE EXCEPTION 'FORBIDDEN: Hanya developer.';
  END IF;
  SELECT st.*, bt.name AS bt_name INTO s FROM public.stores st
    LEFT JOIN public.business_types bt ON bt.id = st.business_type_id
   WHERE st.code = upper(trim(_code));
  IF s.id IS NULL OR s.mode <> 'online' THEN RAISE EXCEPTION 'INVALID: Store online tidak ditemukan.'; END IF;
  INSERT INTO public.store_devices(store_id, device_token, device_name, is_developer)
  VALUES (s.id, _token, left(coalesce(nullif(trim(_device_name),''),'Developer'), 60), true)
  ON CONFLICT DO NOTHING;
  UPDATE public.store_devices SET is_active = true, is_developer = true, last_seen_at = now()
   WHERE store_id = s.id AND device_token = _token;
  RETURN QUERY SELECT s.code, s.name, s.mode, coalesce(s.bt_name,''), s.activation_key, s.expires_at,
    EXISTS(SELECT 1 FROM public.store_records r WHERE r.store_id = s.id);
END $function$;
REVOKE EXECUTE ON FUNCTION public.dev_attach_device(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_attach_device(text,text,text) TO authenticated;