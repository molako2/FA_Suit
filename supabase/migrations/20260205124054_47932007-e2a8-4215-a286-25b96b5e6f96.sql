-- Add intervention nature and client sector fields to matters table
ALTER TABLE public.matters 
ADD COLUMN intervention_nature text,
ADD COLUMN client_sector text;