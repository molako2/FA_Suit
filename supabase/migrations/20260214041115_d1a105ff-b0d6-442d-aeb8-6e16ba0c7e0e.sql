
-- 1. Create private storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('matter-documents', 'matter-documents', false);

-- 2. Create matter_documents table
CREATE TABLE public.matter_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  category text NOT NULL,
  tags text[] DEFAULT '{}',
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  uploaded_by uuid NOT NULL,
  parent_id uuid REFERENCES public.matter_documents(id) ON DELETE SET NULL,
  is_current boolean NOT NULL DEFAULT true,
  version_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.matter_documents ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for matter_documents
CREATE POLICY "Select matter_documents" ON public.matter_documents
  FOR SELECT USING (is_owner_or_assistant());

CREATE POLICY "Insert matter_documents" ON public.matter_documents
  FOR INSERT WITH CHECK (is_owner_or_assistant());

CREATE POLICY "Update matter_documents" ON public.matter_documents
  FOR UPDATE USING (is_owner_or_assistant());

CREATE POLICY "Delete matter_documents" ON public.matter_documents
  FOR DELETE USING (is_owner_or_assistant());

-- 5. Storage policies for matter-documents bucket
CREATE POLICY "Upload matter documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'matter-documents' AND auth.uid() IS NOT NULL AND is_owner_or_assistant()
  );

CREATE POLICY "Download matter documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'matter-documents' AND auth.uid() IS NOT NULL AND is_owner_or_assistant()
  );

CREATE POLICY "Delete matter documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'matter-documents' AND auth.uid() IS NOT NULL AND is_owner_or_assistant()
  );

CREATE POLICY "Update matter documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'matter-documents' AND auth.uid() IS NOT NULL AND is_owner_or_assistant()
  );

-- 6. Index for performance
CREATE INDEX idx_matter_documents_matter_id ON public.matter_documents(matter_id);
CREATE INDEX idx_matter_documents_parent_id ON public.matter_documents(parent_id);
CREATE INDEX idx_matter_documents_category ON public.matter_documents(category);
