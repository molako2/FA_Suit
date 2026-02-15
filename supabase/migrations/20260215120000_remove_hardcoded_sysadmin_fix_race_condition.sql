-- Security fix: Remove hardcoded sysadmin email backdoor and fix race condition
-- in role assignment trigger.
--
-- Issues fixed:
-- 1. Hardcoded email 'chtioui@gmail.com' auto-assigned sysadmin role to anyone
--    registering with that address — this is a security backdoor.
-- 2. Race condition: concurrent signups could both get COUNT(*) = 0 and both
--    become owner. Fixed with advisory lock.

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count INTEGER;
BEGIN
  -- Use an advisory lock to prevent race condition where two concurrent
  -- signups could both see user_count = 0 and both become owner.
  PERFORM pg_advisory_xact_lock(42);

  SELECT COUNT(*) INTO user_count FROM public.user_roles;

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
