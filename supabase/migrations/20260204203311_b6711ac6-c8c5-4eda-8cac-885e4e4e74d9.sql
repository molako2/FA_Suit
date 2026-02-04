-- Restore the trigger function with hardcoded sysadmin email
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;