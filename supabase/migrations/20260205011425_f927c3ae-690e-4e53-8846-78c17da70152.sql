-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  matter_id UUID NOT NULL REFERENCES public.matters(id),
  expense_date DATE NOT NULL,
  nature TEXT NOT NULL CHECK (char_length(nature) <= 100),
  amount_ttc_cents INTEGER NOT NULL,
  billable BOOLEAN NOT NULL DEFAULT true,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- View policy: users can view their own expenses, owners/assistants can view all
CREATE POLICY "View expenses"
ON public.expenses
FOR SELECT
USING (is_owner_or_assistant() OR (user_id = auth.uid()));

-- Insert policy: users can insert their own expenses
CREATE POLICY "Users manage own expenses"
ON public.expenses
FOR INSERT
WITH CHECK ((user_id = auth.uid()) OR is_owner_or_assistant());

-- Update policy: users can update their own unlocked expenses
CREATE POLICY "Users update own expenses"
ON public.expenses
FOR UPDATE
USING (((user_id = auth.uid()) AND (NOT locked)) OR is_owner_or_assistant());

-- Delete policy: users can delete their own unlocked expenses
CREATE POLICY "Users delete own expenses"
ON public.expenses
FOR DELETE
USING (((user_id = auth.uid()) AND (NOT locked)) OR is_owner_or_assistant());

-- Create trigger for updated_at
CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();