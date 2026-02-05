-- Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "View credit notes" ON public.credit_notes;

-- Create new restrictive SELECT policy for owner/assistant/sysadmin only
CREATE POLICY "View credit notes" 
ON public.credit_notes 
FOR SELECT 
USING (is_owner_or_assistant());