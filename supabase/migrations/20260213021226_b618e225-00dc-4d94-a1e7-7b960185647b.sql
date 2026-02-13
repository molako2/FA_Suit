
-- Step 1: Create user_has_matter_access function
CREATE OR REPLACE FUNCTION public.user_has_matter_access(_user_id uuid, _matter_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_user_matters
    WHERE user_id = _user_id AND matter_id = _matter_id
  )
$$;

-- Step 2: Drop existing SELECT policy on client_documents
DROP POLICY IF EXISTS "View client_documents" ON public.client_documents;

-- Step 3: Create updated SELECT policy with matter-level check
CREATE POLICY "View client_documents"
  ON public.client_documents
  FOR SELECT
  USING (
    is_owner_or_assistant()
    OR (
      user_has_client_access(auth.uid(), client_id)
      AND (
        matter_id IS NULL
        OR user_has_matter_access(auth.uid(), matter_id)
      )
    )
  );
