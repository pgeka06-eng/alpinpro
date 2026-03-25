
-- Table for before/after photos
CREATE TABLE public.order_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'before' CHECK (type IN ('before', 'after')),
  photo_url text NOT NULL,
  file_path text,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own order photos" ON public.order_photos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all order photos" ON public.order_photos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('order-photos', 'order-photos', true);

CREATE POLICY "Auth users can upload order photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-photos');

CREATE POLICY "Anyone can view order photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'order-photos');

CREATE POLICY "Auth users can delete order photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'order-photos');
