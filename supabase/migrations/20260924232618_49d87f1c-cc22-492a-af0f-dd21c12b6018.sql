ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS app_name text NOT NULL DEFAULT 'Kasir UKM', ADD COLUMN IF NOT EXISTS app_icon text NOT NULL DEFAULT '';
CREATE OR REPLACE FUNCTION public.app_branding() RETURNS TABLE(app_name text, app_icon text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT a.app_name FROM app_settings a WHERE id=1),'Kasir UKM'), coalesce((SELECT a.app_icon FROM app_settings a WHERE id=1),'');
$$;
GRANT EXECUTE ON FUNCTION public.app_branding() TO anon, authenticated;