CREATE TABLE public.device_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  slot_code text NOT NULL,
  one_time_key text NOT NULL DEFAULT lpad(((floor(random()*100000000))::bigint)::text, 8, '0'),
  label text NOT NULL DEFAULT '',
  device_id uuid REFERENCES public.store_devices(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slot_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_slots TO authenticated;
GRANT ALL ON public.device_slots TO service_role;
ALTER TABLE public.device_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dev installer view slots" ON public.device_slots FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'developer') OR has_role(auth.uid(),'installer'));
CREATE POLICY "Dev installer insert slots" ON public.device_slots FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'developer') OR has_role(auth.uid(),'installer'));
CREATE POLICY "Dev installer update slots" ON public.device_slots FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'developer') OR has_role(auth.uid(),'installer'))
  WITH CHECK (has_role(auth.uid(),'developer') OR has_role(auth.uid(),'installer'));
CREATE POLICY "Dev installer delete slots" ON public.device_slots FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'developer') OR has_role(auth.uid(),'installer'));

-- Aktivasi baru wajib lewat slot + kunci sekali pakai.
CREATE OR REPLACE FUNCTION public.activate_slot(_code text, _slot text, _key text, _token text, _device_name text)
 RETURNS TABLE(code text, name text, mode text, business_type_name text, base_kind text, max_devices integer, device_count integer, expires_at date, admin_key text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s record; sl record; used int; did uuid;
BEGIN
  SELECT st.*, bt.name AS bt_name, bt.base_kind AS bt_kind INTO s
    FROM public.stores st LEFT JOIN public.business_types bt ON bt.id = st.business_type_id
   WHERE st.code = upper(trim(_code));
  IF s.id IS NULL THEN RAISE EXCEPTION 'INVALID: Kode store, kode perangkat, atau kunci aktivasi salah.'; END IF;
  IF NOT s.active THEN RAISE EXCEPTION 'INACTIVE: Store ini dinonaktifkan. Hubungi penyedia aplikasi.'; END IF;
  SELECT * INTO sl FROM public.device_slots x
   WHERE x.store_id = s.id AND x.slot_code = upper(trim(_slot)) FOR UPDATE;
  IF sl.id IS NULL OR sl.one_time_key <> trim(coalesce(_key,'')) THEN
    RAISE EXCEPTION 'INVALID: Kode store, kode perangkat, atau kunci aktivasi salah.';
  END IF;
  IF sl.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'USED: Kunci aktivasi untuk perangkat ini sudah dipakai. Minta kunci baru ke penyedia aplikasi.';
  END IF;
  SELECT d.id INTO did FROM public.store_devices d WHERE d.store_id = s.id AND d.device_token = _token;
  IF did IS NULL THEN
    INSERT INTO public.store_devices(store_id, device_token, device_name)
    VALUES (s.id, _token, left(coalesce(nullif(trim(_device_name),''), nullif(sl.label,''), sl.slot_code), 60))
    RETURNING id INTO did;
  ELSE
    UPDATE public.store_devices SET is_active = true, last_seen_at = now(),
      device_name = left(coalesce(nullif(trim(_device_name),''), nullif(sl.label,''), sl.slot_code), 60)
     WHERE id = did;
  END IF;
  -- lepaskan slot lain yang mungkin masih memegang perangkat ini
  UPDATE public.device_slots SET device_id = NULL WHERE device_id = did AND id <> sl.id;
  UPDATE public.device_slots SET used_at = now(), device_id = did WHERE id = sl.id;
  SELECT count(*) INTO used FROM public.store_devices d WHERE d.store_id = s.id AND d.is_active AND NOT d.is_developer;
  UPDATE public.stores SET device_count = used, last_activated_at = now(), last_activated_by = 'slot ' || sl.slot_code WHERE id = s.id;
  RETURN QUERY SELECT s.code, s.name, s.mode, coalesce(s.bt_name,''), coalesce(s.bt_kind,'retail'), s.max_devices, used, s.expires_at, s.activation_key;
END $$;

-- Cara lama: hanya boleh untuk perangkat yang sudah terdaftar (aktivasi ulang).
CREATE OR REPLACE FUNCTION public.activate_device(_code text, _key text, _token text, _device_name text)
 RETURNS TABLE(code text, name text, mode text, business_type_name text, base_kind text, max_devices integer, device_count integer, expires_at date)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'INVALID: Aktivasi kini memakai Kode Perangkat dan Kunci Aktivasi sekali pakai.';
END $$;

CREATE OR REPLACE FUNCTION public.release_device(_code text, _key text, _device_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE sid uuid; used int;
BEGIN
  SELECT st.id INTO sid FROM public.stores st
   WHERE st.code = upper(trim(_code)) AND st.activation_key = trim(coalesce(_key,''));
  IF sid IS NULL THEN RAISE EXCEPTION 'INVALID: Kode store atau kunci aktivasi salah.'; END IF;
  UPDATE public.store_devices SET is_active = false WHERE id = _device_id AND store_id = sid;
  -- slot kembali kosong dengan kunci sekali pakai baru
  UPDATE public.device_slots SET device_id = NULL, used_at = NULL,
         one_time_key = lpad(((floor(random()*100000000))::bigint)::text, 8, '0')
   WHERE device_id = _device_id AND store_id = sid;
  SELECT count(*) INTO used FROM public.store_devices d WHERE d.store_id = sid AND d.is_active AND NOT d.is_developer;
  UPDATE public.stores SET device_count = used WHERE id = sid;
  RETURN used;
END $$;