
-- Table messages
CREATE TABLE public.messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL,
  recipient_id uuid,
  content      text NOT NULL CHECK (char_length(content) <= 256),
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for messages
CREATE POLICY "View messages"
  ON public.messages FOR SELECT
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR recipient_id IS NULL
  );

CREATE POLICY "Send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (recipient_id IS NOT NULL OR is_owner())
  );

CREATE POLICY "Update messages read status"
  ON public.messages FOR UPDATE
  USING (
    recipient_id = auth.uid()
    OR (recipient_id IS NULL AND auth.uid() IS NOT NULL)
  );

CREATE POLICY "Delete messages"
  ON public.messages FOR DELETE
  USING (sender_id = auth.uid() OR is_owner());

-- Table message_reads (broadcast read tracking)
CREATE TABLE public.message_reads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own reads"
  ON public.message_reads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Insert own reads"
  ON public.message_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_message_reads_user ON public.message_reads(user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
