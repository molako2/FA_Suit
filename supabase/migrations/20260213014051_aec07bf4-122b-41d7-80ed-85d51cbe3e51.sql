
-- Create table for user-client-matter associations
CREATE TABLE public.client_user_matters (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  matter_id uuid NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_id, matter_id)
);

-- Enable RLS
ALTER TABLE public.client_user_matters ENABLE ROW LEVEL SECURITY;

-- Owner/sysadmin can manage all
CREATE POLICY "Manage client_user_matters"
ON public.client_user_matters
FOR ALL
USING (is_owner() OR is_sysadmin())
WITH CHECK (is_owner() OR is_sysadmin());

-- Users can view their own associations
CREATE POLICY "View own client_user_matters"
ON public.client_user_matters
FOR SELECT
USING (user_id = auth.uid());
