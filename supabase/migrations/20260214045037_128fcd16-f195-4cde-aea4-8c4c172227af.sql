
-- Table for agenda/calendar entries
CREATE TABLE public.agenda_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entry_date DATE NOT NULL,
  note TEXT NOT NULL CHECK (char_length(note) <= 128),
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agenda_entries ENABLE ROW LEVEL SECURITY;

-- Users can view their own entries
CREATE POLICY "View own agenda entries" ON public.agenda_entries
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own entries
CREATE POLICY "Insert own agenda entries" ON public.agenda_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own entries
CREATE POLICY "Update own agenda entries" ON public.agenda_entries
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own entries
CREATE POLICY "Delete own agenda entries" ON public.agenda_entries
  FOR DELETE USING (user_id = auth.uid());

-- Owner/assistant can view all entries
CREATE POLICY "Owner view all agenda entries" ON public.agenda_entries
  FOR SELECT USING (is_owner_or_assistant());

-- Trigger for updated_at
CREATE TRIGGER update_agenda_entries_updated_at
  BEFORE UPDATE ON public.agenda_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
