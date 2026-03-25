
-- Clients table
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own clients" ON public.clients
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all clients" ON public.clients
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Orders table
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL,
  climber_user_id uuid,
  order_number text NOT NULL,
  service_name text NOT NULL,
  description text,
  volume numeric,
  unit text DEFAULT 'шт',
  total_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'created',
  scheduled_date date,
  completed_date date,
  is_repeat boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own orders" ON public.orders
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all orders" ON public.orders
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Climbers can view assigned orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = climber_user_id);

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
