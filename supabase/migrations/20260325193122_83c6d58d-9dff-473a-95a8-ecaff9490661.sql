
-- Workers table
CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'climber',
  daily_rate numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workers" ON public.workers
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all workers" ON public.workers
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_workers_updated_at
  BEFORE UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Worker assignments to orders
CREATE TABLE public.worker_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  work_date date,
  hours_worked numeric DEFAULT 0,
  daily_pay numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'assigned',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(worker_id, order_id, work_date)
);

ALTER TABLE public.worker_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own assignments" ON public.worker_assignments
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all assignments" ON public.worker_assignments
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Salary payments
CREATE TABLE public.salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'cash',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own salary payments" ON public.salary_payments
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all salary payments" ON public.salary_payments
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
