CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dev manage app settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'developer')) WITH CHECK (public.has_role(auth.uid(), 'developer'));
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.developer_contact()
RETURNS TABLE(contact_email text, contact_phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT contact_email, contact_phone FROM public.app_settings WHERE id = 1 $$;
GRANT EXECUTE ON FUNCTION public.developer_contact() TO anon, authenticated;