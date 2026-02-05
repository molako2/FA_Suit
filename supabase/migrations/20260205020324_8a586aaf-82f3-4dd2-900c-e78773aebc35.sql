-- Drop the existing delete policy
DROP POLICY IF EXISTS "Users delete own expenses" ON public.expenses;

-- Create new delete policy:
-- - Sysadmin and Owner can delete any unlocked expense
-- - Users can only delete their own unlocked expenses
-- - Locked expenses (from validated invoices) cannot be deleted by anyone
CREATE POLICY "Delete expenses"
ON public.expenses
FOR DELETE
USING (
  (NOT locked) AND (
    is_owner() OR (user_id = auth.uid())
  )
);