-- Create is_sysadmin function
CREATE OR REPLACE FUNCTION public.is_sysadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'sysadmin'
  )
$$;

-- Update is_owner to also grant sysadmin privileges
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner', 'sysadmin')
  )
$$;

-- Update is_owner_or_assistant to also grant sysadmin privileges
CREATE OR REPLACE FUNCTION public.is_owner_or_assistant()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner', 'assistant', 'sysadmin')
  )
$$;

-- Update handle_new_user_role to assign sysadmin for specific email
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Assign sysadmin for specific admin email
  IF NEW.email = 'chtioui@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'sysadmin');
    RETURN NEW;
  END IF;
  
  -- Count existing non-sysadmin users
  SELECT COUNT(*) INTO user_count FROM public.user_roles WHERE role != 'sysadmin';
  
  -- First regular user becomes owner, others become collaborators
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

-- Update user_roles RLS policies to allow sysadmin full access
DROP POLICY IF EXISTS "Only owners can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only owners can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only owners can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Sysadmin and owners can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (is_sysadmin() OR is_owner());

CREATE POLICY "Sysadmin and owners can update roles" 
ON public.user_roles 
FOR UPDATE 
USING (is_sysadmin() OR is_owner());

CREATE POLICY "Sysadmin and owners can delete roles" 
ON public.user_roles 
FOR DELETE 
USING (is_sysadmin() OR is_owner());

CREATE POLICY "Users can view roles" 
ON public.user_roles 
FOR SELECT 
USING ((user_id = auth.uid()) OR is_sysadmin() OR is_owner());

-- Update profiles policies to allow sysadmin to manage all profiles
DROP POLICY IF EXISTS "Owners can insert profiles" ON public.profiles;
CREATE POLICY "Sysadmin and owners can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK ((id = auth.uid()) OR is_sysadmin() OR is_owner());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update profiles" 
ON public.profiles 
FOR UPDATE 
USING ((id = auth.uid()) OR is_sysadmin() OR is_owner());

-- Add delete policy for profiles (sysadmin only)
CREATE POLICY "Sysadmin can delete profiles" 
ON public.profiles 
FOR DELETE 
USING (is_sysadmin());