
DROP POLICY "View matters" ON public.matters;

CREATE POLICY "View matters"
ON public.matters
FOR SELECT
USING (
  is_owner_or_assistant()
  OR user_is_assigned_to_matter(id)
  OR EXISTS (
    SELECT 1 FROM public.client_user_matters
    WHERE matter_id = matters.id
    AND user_id = auth.uid()
  )
);
