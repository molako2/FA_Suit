-- Add billing type and flat fee amount to matters table
ALTER TABLE public.matters 
ADD COLUMN billing_type text NOT NULL DEFAULT 'time_based' CHECK (billing_type IN ('time_based', 'flat_fee')),
ADD COLUMN flat_fee_cents integer NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.matters.billing_type IS 'Type de facturation: time_based (temps passé) ou flat_fee (forfait)';
COMMENT ON COLUMN public.matters.flat_fee_cents IS 'Montant du forfait HT en centimes (uniquement si billing_type = flat_fee)';