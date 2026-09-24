ALTER TABLE public.store_devices ADD COLUMN IF NOT EXISTS device_model text NOT NULL DEFAULT '';
DROP FUNCTION IF EXISTS public.device_heartbeat(text, text);
CREATE OR REPLACE FUNCTION public.device_heartbeat(_code text, _token text, _model text DEFAULT '')
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.store_devices d SET last_seen_at = now(),
         device_model = CASE WHEN coalesce(trim(_model),'') = '' THEN d.device_model ELSE left(trim(_model),80) END
   FROM public.stores s
  WHERE s.id = d.store_id AND s.code = upper(trim(_code)) AND d.device_token = _token AND d.is_active;
$$;
GRANT EXECUTE ON FUNCTION public.device_heartbeat(text, text, text) TO anon, authenticated;
DROP FUNCTION IF EXISTS public.store_devices_list(text, text);
CREATE FUNCTION public.store_devices_list(_code text, _key text)
 RETURNS TABLE(id uuid, device_name text, is_active boolean, last_seen_at timestamptz, created_at timestamptz, max_devices integer, device_model text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE sid uuid; mx int;
BEGIN
  SELECT st.id, st.max_devices INTO sid, mx FROM public.stores st
   WHERE st.code = upper(trim(_code)) AND st.activation_key = trim(coalesce(_key,''));
  IF sid IS NULL THEN RAISE EXCEPTION 'INVALID: Kode store atau kunci aktivasi salah.'; END IF;
  RETURN QUERY
    SELECT d.id, d.device_name, d.is_active, d.last_seen_at, d.created_at, mx, d.device_model
      FROM public.store_devices d WHERE d.store_id = sid AND d.is_active ORDER BY d.created_at;
END $function$;
GRANT EXECUTE ON FUNCTION public.store_devices_list(text, text) TO anon, authenticated;