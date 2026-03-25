
-- Cost settings per user
CREATE TABLE public.cost_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  hourly_rate numeric NOT NULL DEFAULT 0,
  material_cost_per_unit numeric NOT NULL DEFAULT 0,
  crew_daily_wage numeric NOT NULL DEFAULT 0,
  crew_size integer NOT NULL DEFAULT 2,
  equipment_amortization numeric NOT NULL DEFAULT 0,
  transport_cost numeric NOT NULL DEFAULT 0,
  overhead_percent numeric NOT NULL DEFAULT 10,
  hours_per_unit numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cost_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cost settings" ON public.cost_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all cost settings" ON public.cost_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cost_settings_updated_at
  BEFORE UPDATE ON public.cost_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
