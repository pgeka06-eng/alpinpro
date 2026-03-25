CREATE TABLE public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  climber_user_id uuid NOT NULL,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  message text,
  work_type text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (anon) can insert a request
CREATE POLICY "Anyone can submit contact request"
  ON public.contact_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Climbers can view requests sent to them
CREATE POLICY "Climbers can view own requests"
  ON public.contact_requests FOR SELECT TO authenticated
  USING (climber_user_id = auth.uid());

-- Admins can manage all
CREATE POLICY "Admins can manage all contact requests"
  ON public.contact_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Climbers can update status of own requests
CREATE POLICY "Climbers can update own requests"
  ON public.contact_requests FOR UPDATE TO authenticated
  USING (climber_user_id = auth.uid());

-- Make climber_profiles and profiles readable by anon for the marketplace
CREATE POLICY "Anon can view climber profiles"
  ON public.climber_profiles FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anon can view profiles"
  ON public.profiles FOR SELECT TO anon
  USING (true);