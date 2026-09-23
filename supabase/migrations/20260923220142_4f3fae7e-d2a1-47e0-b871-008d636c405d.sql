CREATE TYPE public.app_role AS ENUM ('developer', 'installer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  display_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'developer'));

CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  mode text NOT NULL DEFAULT 'offline' CHECK (mode IN ('online', 'offline')),
  active boolean NOT NULL DEFAULT true,
  notes text NOT NULL DEFAULT '',
  device_count integer NOT NULL DEFAULT 0,
  last_activated_at timestamptz,
  last_activated_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers and installers view stores" ON public.stores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'developer') OR public.has_role(auth.uid(), 'installer'));
CREATE POLICY "Developers create stores" ON public.stores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "Developers update stores" ON public.stores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'developer')) WITH CHECK (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "Developers delete stores" ON public.stores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));

-- Installer/developer mengaktifkan perangkat untuk toko
CREATE OR REPLACE FUNCTION public.activate_store(_store_id uuid)
RETURNS TABLE (code text, name text, mode text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE who text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'developer') OR public.has_role(auth.uid(), 'installer')) THEN
    RAISE EXCEPTION 'Tidak berwenang';
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

-- Pemeriksaan status toko mode online (tanpa login)
CREATE OR REPLACE FUNCTION public.check_store(_code text)
RETURNS TABLE (active boolean, mode text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.active, s.mode FROM public.stores s WHERE s.code = upper(trim(_code))
$$;
GRANT EXECUTE ON FUNCTION public.check_store(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.developer_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'developer')
$$;
GRANT EXECUTE ON FUNCTION public.developer_exists() TO anon, authenticated;