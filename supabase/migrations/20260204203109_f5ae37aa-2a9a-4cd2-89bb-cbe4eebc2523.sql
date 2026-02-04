-- Replace the trigger function to remove hardcoded email backdoor
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing users with roles
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  
  -- First user becomes owner, others become collaborators
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