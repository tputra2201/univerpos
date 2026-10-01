ALTER TABLE public.store_devices ADD COLUMN IF NOT EXISTS force_logout boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.device_heartbeat(text, text, text, text, text, boolean);
CREATE FUNCTION public.device_heartbeat(_code text, _token text, _model text DEFAULT '', _user_name text DEFAULT NULL, _user_role text DEFAULT NULL, _shift_open boolean DEFAULT NULL)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE did uuid; fl boolean;
BEGIN
  SELECT d.id, d.force_logout INTO did, fl FROM public.store_devices d JOIN public.stores s ON s.id = d.store_id
   WHERE s.code = upper(trim(_code)) AND d.device_token = _token AND d.is_active;
  IF did IS NULL THEN RETURN false; END IF;
  UPDATE public.store_devices d SET last_seen_at = now(),
         device_model = CASE WHEN coalesce(trim(_model),'') = '' THEN d.device_model ELSE left(trim(_model),80) END,
         current_user_name = CASE WHEN fl THEN '' WHEN _user_name IS NULL THEN d.current_user_name ELSE left(trim(_user_name),60) END,
         current_user_role = CASE WHEN fl THEN '' WHEN _user_role IS NULL THEN d.current_user_role ELSE left(trim(_user_role),30) END,
         shift_open = coalesce(_shift_open, d.shift_open),
         force_logout = false
   WHERE d.id = did;
  RETURN coalesce(fl, false);
END $$;
GRANT EXECUTE ON FUNCTION public.device_heartbeat(text, text, text, text, text, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.force_logout_device(_code text, _key text, _device_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE sid uuid;
BEGIN
  SELECT st.id INTO sid FROM public.stores st
   WHERE st.code = upper(trim(_code)) AND st.activation_key = trim(coalesce(_key,''));
  IF sid IS NULL THEN RAISE EXCEPTION 'INVALID: Kode store salah.'; END IF;
  UPDATE public.store_devices SET force_logout = true WHERE id = _device_id AND store_id = sid AND is_active;
END $$;
GRANT EXECUTE ON FUNCTION public.force_logout_device(text, text, uuid) TO anon, authenticated;