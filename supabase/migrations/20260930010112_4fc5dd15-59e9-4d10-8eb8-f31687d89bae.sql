ALTER TABLE public.store_devices ADD COLUMN IF NOT EXISTS current_user_name text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS current_user_role text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS shift_open boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.device_heartbeat(_code text, _token text, _model text DEFAULT '', _user_name text DEFAULT NULL, _user_role text DEFAULT NULL, _shift_open boolean DEFAULT NULL)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  UPDATE public.store_devices d SET last_seen_at = now(),
         device_model = CASE WHEN coalesce(trim(_model),'') = '' THEN d.device_model ELSE left(trim(_model),80) END,
         current_user_name = CASE WHEN _user_name IS NULL THEN d.current_user_name ELSE left(trim(_user_name),60) END,
         current_user_role = CASE WHEN _user_role IS NULL THEN d.current_user_role ELSE left(trim(_user_role),30) END,
         shift_open = coalesce(_shift_open, d.shift_open)
   FROM public.stores s
  WHERE s.id = d.store_id AND s.code = upper(trim(_code)) AND d.device_token = _token AND d.is_active;
$$;
DROP FUNCTION IF EXISTS public.device_heartbeat(text, text, text);

DROP FUNCTION IF EXISTS public.store_devices_list(text, text);
CREATE FUNCTION public.store_devices_list(_code text, _key text)
 RETURNS TABLE(id uuid, device_name text, is_active boolean, last_seen_at timestamptz, created_at timestamptz, max_devices integer, device_model text, current_user_name text, current_user_role text, shift_open boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE sid uuid; mx int;
BEGIN
  SELECT st.id, st.max_devices INTO sid, mx FROM public.stores st
   WHERE st.code = upper(trim(_code)) AND st.activation_key = trim(coalesce(_key,''));
  IF sid IS NULL THEN RAISE EXCEPTION 'INVALID: Kode store atau kunci aktivasi salah.'; END IF;
  RETURN QUERY
    SELECT d.id, d.device_name, d.is_active, d.last_seen_at, d.created_at, mx, d.device_model,
           d.current_user_name, d.current_user_role, d.shift_open
      FROM public.store_devices d WHERE d.store_id = sid AND d.is_active AND NOT d.is_developer ORDER BY d.created_at;
END $$;