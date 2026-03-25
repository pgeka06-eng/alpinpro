
-- Contracts/acts table
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'contract', -- 'contract' or 'act'
  number text NOT NULL,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  description text,
  total_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft', -- draft, sent, signed
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  signed_at timestamptz,
  signed_ip text,
  signed_device text,
  signed_user_agent text,
  pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(token)
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own contracts" ON public.contracts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all contracts" ON public.contracts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view contract by token" ON public.contracts
  FOR SELECT TO anon
  USING (true);

-- Updated_at trigger
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for generated PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', true);

-- Storage policies
CREATE POLICY "Users can upload contracts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "Anyone can view contracts" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'contracts');

CREATE POLICY "Users can delete own contracts" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'contracts');
