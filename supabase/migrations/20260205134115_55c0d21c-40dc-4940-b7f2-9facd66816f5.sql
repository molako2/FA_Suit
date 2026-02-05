-- Create purchases table for expense/invoice management
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  designation TEXT NOT NULL,
  amount_ht_cents INTEGER NOT NULL DEFAULT 0,
  amount_tva_cents INTEGER NOT NULL DEFAULT 0,
  amount_ttc_cents INTEGER NOT NULL DEFAULT 0,
  num_if TEXT,
  supplier TEXT NOT NULL,
  ice TEXT,
  rate NUMERIC,
  prorata NUMERIC,
  payment_mode INTEGER NOT NULL DEFAULT 1,
  payment_date DATE,
  invoice_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for owner, assistant, sysadmin access only
CREATE POLICY "View purchases"
ON public.purchases
FOR SELECT
USING (is_owner_or_assistant() OR is_sysadmin());

CREATE POLICY "Manage purchases"
ON public.purchases
FOR ALL
USING (is_owner_or_assistant() OR is_sysadmin());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_purchases_updated_at
BEFORE UPDATE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();