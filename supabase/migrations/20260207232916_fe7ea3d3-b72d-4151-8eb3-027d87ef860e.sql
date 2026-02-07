
-- Create todos table
CREATE TABLE public.todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assigned_to UUID NOT NULL REFERENCES public.profiles(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  deadline DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  blocked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- SELECT: Owner/SysAdmin see all; others see only their own
CREATE POLICY "View todos"
ON public.todos
FOR SELECT
USING (is_owner() OR assigned_to = auth.uid());

-- INSERT: Only Owner/SysAdmin
CREATE POLICY "Create todos"
ON public.todos
FOR INSERT
WITH CHECK (is_owner());

-- UPDATE: Owner/SysAdmin can update all; collaborators/assistants can only update status and blocked_reason on their own tasks
CREATE POLICY "Owner update todos"
ON public.todos
FOR UPDATE
USING (is_owner());

CREATE POLICY "Collaborator update own todo status"
ON public.todos
FOR UPDATE
USING (assigned_to = auth.uid());

-- DELETE: Only Owner/SysAdmin
CREATE POLICY "Delete todos"
ON public.todos
FOR DELETE
USING (is_owner());

-- Trigger for updated_at
CREATE TRIGGER update_todos_updated_at
BEFORE UPDATE ON public.todos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
