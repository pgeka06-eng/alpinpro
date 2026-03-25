
-- Climber extended profiles
CREATE TABLE public.climber_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  work_types text[] NOT NULL DEFAULT '{}',
  portfolio_urls text[] NOT NULL DEFAULT '{}',
  total_orders integer NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 0,
  avg_check numeric NOT NULL DEFAULT 0,
  reliability numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.climber_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all climber profiles" ON public.climber_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own climber profile" ON public.climber_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all climber profiles" ON public.climber_profiles
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_climber_profiles_updated_at
  BEFORE UPDATE ON public.climber_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage for climber avatars and portfolio images
INSERT INTO storage.buckets (id, name, public) VALUES ('climber-files', 'climber-files', true);

CREATE POLICY "Anyone can view climber files" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'climber-files');

CREATE POLICY "Authenticated can upload climber files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'climber-files');

CREATE POLICY "Users can delete own climber files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'climber-files');
