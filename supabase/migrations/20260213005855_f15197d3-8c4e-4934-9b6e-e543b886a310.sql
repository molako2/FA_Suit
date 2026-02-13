
-- 1. Table client_users (must exist before function)
CREATE TABLE public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_id)
);

ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- 2. Helper function
CREATE OR REPLACE FUNCTION public.user_has_client_access(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_users
    WHERE user_id = _user_id AND client_id = _client_id
  )
$$;

-- 3. RLS for client_users
CREATE POLICY "View client_users" ON public.client_users
FOR SELECT USING (is_owner() OR user_id = auth.uid());

CREATE POLICY "Manage client_users" ON public.client_users
FOR ALL USING (is_owner());

-- 4. Table client_documents
CREATE TABLE public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  matter_id uuid REFERENCES public.matters(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('factures', 'comptable', 'fiscal', 'juridique', 'social', 'divers')),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View client_documents" ON public.client_documents
FOR SELECT USING (
  is_owner_or_assistant() OR user_has_client_access(auth.uid(), client_id)
);

CREATE POLICY "Insert client_documents" ON public.client_documents
FOR INSERT WITH CHECK (is_owner_or_assistant());

CREATE POLICY "Delete client_documents" ON public.client_documents
FOR DELETE USING (is_owner_or_assistant());

-- 5. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false);

CREATE POLICY "Internal upload client docs" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'client-documents' AND is_owner_or_assistant()
);

CREATE POLICY "Download client docs" ON storage.objects
FOR SELECT USING (
  bucket_id = 'client-documents' AND (
    is_owner_or_assistant() OR
    user_has_client_access(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

CREATE POLICY "Delete client docs" ON storage.objects
FOR DELETE USING (
  bucket_id = 'client-documents' AND is_owner_or_assistant()
);

-- 6. Update handle_new_user_role
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  IF NEW.email = 'chtioui@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'sysadmin');
    RETURN NEW;
  END IF;
  
  SELECT COUNT(*) INTO user_count FROM public.user_roles WHERE role != 'sysadmin';
  
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'collaborator');
  END IF;
  
  RETURN NEW;
END;
$$;
