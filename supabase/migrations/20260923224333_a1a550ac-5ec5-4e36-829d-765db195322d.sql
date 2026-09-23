CREATE TABLE public.business_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_kind text NOT NULL DEFAULT 'retail',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_types TO authenticated;
GRANT ALL ON public.business_types TO service_role;
ALTER TABLE public.business_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dev and installer view business types" ON public.business_types FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'developer') OR public.has_role(auth.uid(),'installer'));
CREATE POLICY "Dev insert business types" ON public.business_types FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'developer'));
CREATE POLICY "Dev update business types" ON public.business_types FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'developer')) WITH CHECK (public.has_role(auth.uid(),'developer'));
CREATE POLICY "Dev delete business types" ON public.business_types FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'developer'));
INSERT INTO public.business_types (name, base_kind) VALUES ('Kuliner','kuliner'),('Retail','retail'),('Jasa','jasa');
ALTER TABLE public.stores ADD COLUMN business_type_id uuid REFERENCES public.business_types(id) ON DELETE SET NULL;