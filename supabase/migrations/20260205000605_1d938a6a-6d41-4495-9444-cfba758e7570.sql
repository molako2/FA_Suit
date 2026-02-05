-- Add payment tracking fields to invoices
ALTER TABLE public.invoices 
ADD COLUMN paid boolean NOT NULL DEFAULT false,
ADD COLUMN payment_date date NULL;