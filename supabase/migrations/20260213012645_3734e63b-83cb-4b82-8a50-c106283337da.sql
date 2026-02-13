
-- Fix: allow sysadmin to manage client_users (not just owner)
DROP POLICY "Manage client_users" ON public.client_users;
CREATE POLICY "Manage client_users"
  ON public.client_users
  FOR ALL
  USING (is_owner() OR is_sysadmin())
  WITH CHECK (is_owner() OR is_sysadmin());
