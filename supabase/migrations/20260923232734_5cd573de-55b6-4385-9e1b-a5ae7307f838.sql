ALTER TABLE public.stores ADD COLUMN app_version text NOT NULL DEFAULT '';

CREATE TABLE public.app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_releases TO authenticated;
GRANT ALL ON public.app_releases TO service_role;
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dev manage releases" ON public.app_releases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'developer')) WITH CHECK (public.has_role(auth.uid(),'developer'));

CREATE TABLE public.update_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  current_version text NOT NULL DEFAULT '',
  target_version text NOT NULL DEFAULT '',
  requested_by text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.update_requests TO authenticated;
GRANT ALL ON public.update_requests TO service_role;
ALTER TABLE public.update_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dev manage update requests" ON public.update_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'developer')) WITH CHECK (public.has_role(auth.uid(),'developer'));

CREATE OR REPLACE FUNCTION public.latest_release()
RETURNS TABLE(version text, notes text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT r.version, r.notes FROM public.app_releases r ORDER BY r.created_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.request_update(_code text, _current text, _by text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; tv text; rid uuid;
BEGIN
  SELECT id INTO sid FROM public.stores WHERE code = upper(trim(_code)) AND active;
  IF sid IS NULL THEN RAISE EXCEPTION 'Store tidak ditemukan atau nonaktif'; END IF;
  SELECT version INTO tv FROM public.app_releases ORDER BY created_at DESC LIMIT 1;
  IF tv IS NULL THEN RAISE EXCEPTION 'Belum ada rilis'; END IF;
  SELECT id INTO rid FROM public.update_requests WHERE store_id = sid AND status = 'pending' AND target_version = tv LIMIT 1;
  IF rid IS NOT NULL THEN RETURN rid; END IF;
  INSERT INTO public.update_requests(store_id, current_version, target_version, requested_by)
  VALUES (sid, left(coalesce(_current,''),40), tv, left(coalesce(_by,''),80)) RETURNING id INTO rid;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.update_request_status(_id uuid)
RETURNS TABLE(status text, target_version text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT u.status, u.target_version FROM public.update_requests u WHERE u.id = _id
$$;

CREATE OR REPLACE FUNCTION public.mark_update_applied(_id uuid, _version text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid;
BEGIN
  UPDATE public.update_requests SET status='applied' WHERE id=_id AND status='approved' RETURNING store_id INTO sid;
  IF sid IS NOT NULL THEN UPDATE public.stores SET app_version = left(_version,40) WHERE id = sid; END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.latest_release() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_update(text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_request_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_update_applied(uuid,text) TO anon, authenticated;