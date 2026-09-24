CREATE OR REPLACE FUNCTION public.device_heartbeat(_code text, _token text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.store_devices d SET last_seen_at = now()
   FROM public.stores s
  WHERE s.id = d.store_id AND s.code = upper(trim(_code)) AND d.device_token = _token AND d.is_active;
$$;
GRANT EXECUTE ON FUNCTION public.device_heartbeat(text, text) TO anon, authenticated;