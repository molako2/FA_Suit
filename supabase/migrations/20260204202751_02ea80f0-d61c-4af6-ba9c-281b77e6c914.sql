-- Drop the overly permissive SELECT policy on profiles
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create a more restrictive SELECT policy:
-- Users can only see their own profile OR owners/assistants/sysadmins can see all
CREATE POLICY "Users can view own profile or managers can view all"
ON public.profiles
FOR SELECT
USING (
  id = auth.uid() 
  OR is_owner_or_assistant()
);
