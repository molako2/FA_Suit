
ALTER TABLE public.messages 
  ADD COLUMN reply_to uuid REFERENCES public.messages(id) ON DELETE CASCADE;

CREATE INDEX idx_messages_reply_to ON public.messages(reply_to);
