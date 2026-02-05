-- Add contact fields to clients table
ALTER TABLE public.clients 
ADD COLUMN contact_name text,
ADD COLUMN contact_phone text;