CREATE OR REPLACE FUNCTION public.check_device(_code text, _token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT d.is_active FROM public.store_devices d
    JOIN public.stores s ON s.id = d.store_id
    WHERE upper(s.code) = upper(_code) AND d.device_token = _token
    LIMIT 1
  ), false)
$$;
GRANT EXECUTE ON FUNCTION public.check_device(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_device_slot_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.device_id IS NOT NULL THEN
    UPDATE public.store_devices SET is_active = false WHERE id = OLD.device_id;
    UPDATE public.stores SET device_count = (
      SELECT count(*) FROM public.store_devices WHERE store_id = OLD.store_id AND is_active AND NOT is_developer
    ) WHERE id = OLD.store_id;
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_device_slot_deleted ON public.device_slots;
CREATE TRIGGER trg_device_slot_deleted AFTER DELETE ON public.device_slots
FOR EACH ROW EXECUTE FUNCTION public.on_device_slot_deleted();