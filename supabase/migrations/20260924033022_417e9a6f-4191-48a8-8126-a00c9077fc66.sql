ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS expires_at date;

DROP FUNCTION IF EXISTS public.activate_device(text,text,text,text);
CREATE FUNCTION public.activate_device(_code text, _key text, _token text, _device_name text)
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
    SELECT count(*) INTO used FROM public.store_devices d WHERE d.store_id = s.id AND d.is_active;
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
  SELECT count(*) INTO used FROM public.store_devices d WHERE d.store_id = s.id AND d.is_active;
  UPDATE public.stores SET device_count = used, last_activated_at = now(), last_activated_by = 'self-service' WHERE id = s.id;
  RETURN QUERY SELECT s.code, s.name, s.mode, coalesce(s.bt_name,''), coalesce(s.bt_kind,'retail'), s.max_devices, used, s.expires_at;
END $function$;
GRANT EXECUTE ON FUNCTION public.activate_device(text,text,text,text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.check_store(text);
CREATE FUNCTION public.check_store(_code text)
 RETURNS TABLE(active boolean, mode text, expires_at date)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT s.active, s.mode, s.expires_at FROM public.stores s WHERE s.code = upper(trim(_code))
$function$;
GRANT EXECUTE ON FUNCTION public.check_store(text) TO anon, authenticated;