-- Storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public) VALUES ('price-pdfs', 'price-pdfs', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload PDFs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'price-pdfs');

CREATE POLICY "Authenticated users can view PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'price-pdfs');

CREATE POLICY "Authenticated users can delete own PDFs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'price-pdfs');

-- Price lists table
CREATE TABLE public.price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'parsing', 'parsed', 'error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own price lists"
  ON public.price_lists FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own price lists"
  ON public.price_lists FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own price lists"
  ON public.price_lists FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own price lists"
  ON public.price_lists FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_price_lists_updated_at
  BEFORE UPDATE ON public.price_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Price items (parsed from PDF)
CREATE TABLE public.price_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'шт',
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  description TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view price items of own lists"
  ON public.price_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.price_lists
      WHERE id = price_list_id AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can insert price items to own lists"
  ON public.price_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.price_lists
      WHERE id = price_list_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update price items of own lists"
  ON public.price_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.price_lists
      WHERE id = price_list_id AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can delete price items of own lists"
  ON public.price_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.price_lists
      WHERE id = price_list_id AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE TRIGGER update_price_items_updated_at
  BEFORE UPDATE ON public.price_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Price change history
CREATE TABLE public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_item_id UUID NOT NULL REFERENCES public.price_items(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view history of own items"
  ON public.price_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.price_items pi
      JOIN public.price_lists pl ON pl.id = pi.price_list_id
      WHERE pi.id = price_item_id AND (pl.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can insert history"
  ON public.price_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = changed_by);