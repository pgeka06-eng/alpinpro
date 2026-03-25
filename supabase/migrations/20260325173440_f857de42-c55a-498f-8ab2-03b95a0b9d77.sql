
-- Reviews table
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  climber_user_id uuid NOT NULL,
  reviewer_name text NOT NULL,
  reviewer_email text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  quality_score integer NOT NULL DEFAULT 5 CHECK (quality_score >= 1 AND quality_score <= 5),
  punctuality_score integer NOT NULL DEFAULT 5 CHECK (punctuality_score >= 1 AND punctuality_score <= 5),
  safety_score integer NOT NULL DEFAULT 5 CHECK (safety_score >= 1 AND safety_score <= 5),
  comment text,
  estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews" ON public.reviews
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert reviews" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Anon can view reviews" ON public.reviews
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert reviews" ON public.reviews
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Admins can manage reviews" ON public.reviews
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Function to recalculate climber metrics from reviews
CREATE OR REPLACE FUNCTION public.recalc_climber_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_rating numeric;
  avg_quality numeric;
  avg_punctuality numeric;
  avg_safety numeric;
  review_count integer;
  trust numeric;
BEGIN
  SELECT
    COALESCE(AVG(rating), 0),
    COALESCE(AVG(quality_score), 0),
    COALESCE(AVG(punctuality_score), 0),
    COALESCE(AVG(safety_score), 0),
    COUNT(*)
  INTO avg_rating, avg_quality, avg_punctuality, avg_safety, review_count
  FROM public.reviews
  WHERE climber_user_id = NEW.climber_user_id;

  -- Trust index: weighted average of sub-scores, scaled 0-100
  -- quality 40%, punctuality 30%, safety 30%, bonus for volume
  trust := LEAST(100, ROUND(
    (avg_quality * 0.4 + avg_punctuality * 0.3 + avg_safety * 0.3) * 20
    * LEAST(1.0, review_count::numeric / 5.0)
  ));

  -- Upsert climber_profiles
  INSERT INTO public.climber_profiles (user_id, rating, reliability)
  VALUES (NEW.climber_user_id, ROUND(avg_rating, 1), trust)
  ON CONFLICT (user_id)
  DO UPDATE SET
    rating = ROUND(avg_rating, 1),
    reliability = trust,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER recalc_rating_after_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION recalc_climber_rating();
