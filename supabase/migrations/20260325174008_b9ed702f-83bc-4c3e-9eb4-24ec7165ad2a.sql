
-- Expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'other',
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  include_vat boolean NOT NULL DEFAULT false,
  vat_amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expenses" ON public.expenses
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all expenses" ON public.expenses
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Add payment tracking to orders
ALTER TABLE public.orders
  ADD COLUMN paid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN payment_method text DEFAULT 'cash',
  ADD COLUMN payment_date date;

-- Payments log table
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  include_vat boolean NOT NULL DEFAULT false,
  vat_amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own payments" ON public.payments
  FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all payments" ON public.payments
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
