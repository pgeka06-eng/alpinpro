-- Replace permissive anon UPDATE policy with a restrictive one
-- The actual signing will happen through an edge function with service role
DROP POLICY "Anyone can sign estimate" ON public.estimates;

-- Anon can only read estimates (needed to view via token link)
-- The SELECT policy already exists and is fine for public read access