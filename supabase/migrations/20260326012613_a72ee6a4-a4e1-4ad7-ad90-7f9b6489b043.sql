
-- Add 'client' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- Marketplace orders (client job postings)
CREATE TABLE public.marketplace_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  work_type text NOT NULL DEFAULT 'other',
  address text,
  city text,
  budget_from numeric DEFAULT 0,
  budget_to numeric DEFAULT 0,
  deadline date,
  status text NOT NULL DEFAULT 'open',
  responses_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view open orders
CREATE POLICY "Anyone can view open marketplace orders"
  ON public.marketplace_orders FOR SELECT TO authenticated
  USING (status = 'open' OR client_user_id = auth.uid());

-- Clients can insert their own orders
CREATE POLICY "Clients can insert own marketplace orders"
  ON public.marketplace_orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_user_id);

-- Clients can update own orders
CREATE POLICY "Clients can update own marketplace orders"
  ON public.marketplace_orders FOR UPDATE TO authenticated
  USING (auth.uid() = client_user_id);

-- Clients can delete own orders
CREATE POLICY "Clients can delete own marketplace orders"
  ON public.marketplace_orders FOR DELETE TO authenticated
  USING (auth.uid() = client_user_id);

-- Admins can manage all
CREATE POLICY "Admins can manage all marketplace orders"
  ON public.marketplace_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Marketplace responses (climber bids)
CREATE TABLE public.marketplace_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  climber_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  proposed_price numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, climber_user_id)
);

ALTER TABLE public.marketplace_responses ENABLE ROW LEVEL SECURITY;

-- Climbers can view their own responses
CREATE POLICY "Climbers can view own responses"
  ON public.marketplace_responses FOR SELECT TO authenticated
  USING (climber_user_id = auth.uid());

-- Order owner can view responses to their orders
CREATE POLICY "Order owner can view responses"
  ON public.marketplace_responses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.marketplace_orders mo
    WHERE mo.id = order_id AND mo.client_user_id = auth.uid()
  ));

-- Climbers can insert responses
CREATE POLICY "Climbers can insert responses"
  ON public.marketplace_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = climber_user_id);

-- Order owner can update response status (accept/reject)
CREATE POLICY "Order owner can update response status"
  ON public.marketplace_responses FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.marketplace_orders mo
    WHERE mo.id = order_id AND mo.client_user_id = auth.uid()
  ));

-- Admins can manage all responses
CREATE POLICY "Admins can manage all responses"
  ON public.marketplace_responses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to update responses_count
CREATE OR REPLACE FUNCTION public.update_marketplace_responses_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE marketplace_orders SET responses_count = responses_count + 1, updated_at = now() WHERE id = NEW.order_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE marketplace_orders SET responses_count = responses_count - 1, updated_at = now() WHERE id = OLD.order_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_marketplace_responses_count
AFTER INSERT OR DELETE ON public.marketplace_responses
FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_responses_count();

-- Updated_at trigger for marketplace_orders
CREATE TRIGGER trg_marketplace_orders_updated_at
BEFORE UPDATE ON public.marketplace_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
