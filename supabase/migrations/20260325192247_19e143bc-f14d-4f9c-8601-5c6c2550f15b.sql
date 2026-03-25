
-- Create sites table
CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  city text,
  lat numeric,
  lng numeric,
  contact_name text,
  contact_phone text,
  notes text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own sites" ON public.sites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all sites" ON public.sites
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add site_id to orders
ALTER TABLE public.orders ADD COLUMN site_id uuid REFERENCES public.sites(id);

-- Storage bucket for site photos
INSERT INTO storage.buckets (id, name, public) VALUES ('site-photos', 'site-photos', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload site photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-photos');

CREATE POLICY "Anyone can view site photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'site-photos');

CREATE POLICY "Users can delete own site photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-photos');
