
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS total_orders integer NOT NULL DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS total_revenue numeric NOT NULL DEFAULT 0;
