-- Estimates table
CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'agreed', 'rejected')),
  service_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  base_price NUMERIC(12,2) NOT NULL,
  volume NUMERIC(12,2) NOT NULL,
  coeff_urgency NUMERIC(4,2) NOT NULL DEFAULT 1,
  coeff_complexity NUMERIC(4,2) NOT NULL DEFAULT 1,
  coeff_height NUMERIC(4,2) NOT NULL DEFAULT 1,
  coeff_season NUMERIC(4,2) NOT NULL DEFAULT 1,
  total_coeff NUMERIC(6,3) NOT NULL DEFAULT 1,
  total_price NUMERIC(12,2) NOT NULL,
  signed_at TIMESTAMPTZ,
  signed_ip TEXT,
  signed_device TEXT,
  signed_user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own estimates"
  ON public.estimates FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all estimates"
  ON public.estimates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view estimate by token"
  ON public.estimates FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anyone can sign estimate"
  ON public.estimates FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();