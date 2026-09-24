ALTER TABLE public.stores ADD COLUMN max_devices integer NOT NULL DEFAULT 1;
CREATE OR REPLACE FUNCTION public.activate_store(_store_id uuid)
RETURNS TABLE (code text, name text, mode text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE who text; cur int; mx int;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'developer') OR public.has_role(auth.uid(), 'installer')) THEN
    RAISE EXCEPTION 'Tidak berwenang';
  END IF;
  SELECT s.device_count, s.max_devices INTO cur, mx FROM public.stores s WHERE s.id = _store_id;
  IF mx IS NOT NULL AND mx > 0 AND cur >= mx THEN
    RAISE EXCEPTION 'MAX_DEVICES: Store ini sudah mencapai batas maksimum % perangkat. Hubungi developer untuk menambah kuota.', mx;
  END IF;
  SELECT COALESCE(NULLIF(ur.display_name, ''), ur.email) INTO who
    FROM public.user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1;
  RETURN QUERY
  UPDATE public.stores s
     SET device_count = s.device_count + 1, last_activated_at = now(), last_activated_by = COALESCE(who, '')
   WHERE s.id = _store_id AND s.active
  RETURNING s.code, s.name, s.mode;
END $$;
REVOKE EXECUTE ON FUNCTION public.activate_store(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_store(uuid) TO authenticated;