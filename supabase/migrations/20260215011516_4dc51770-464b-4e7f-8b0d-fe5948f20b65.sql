
-- Bucket privé pour les pièces jointes des tâches
INSERT INTO storage.buckets (id, name, public) VALUES ('todo-attachments', 'todo-attachments', false);

-- Table de référence des pièces jointes
CREATE TABLE public.todo_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id uuid NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.todo_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: admins can insert
CREATE POLICY "Admin insert attachments" ON public.todo_attachments
  FOR INSERT WITH CHECK (is_owner());

-- RLS: admins can delete
CREATE POLICY "Admin delete attachments" ON public.todo_attachments
  FOR DELETE USING (is_owner());

-- RLS: view if admin or assigned to the todo
CREATE POLICY "View attachments" ON public.todo_attachments
  FOR SELECT USING (
    is_owner()
    OR EXISTS (SELECT 1 FROM public.todos WHERE todos.id = todo_attachments.todo_id AND todos.assigned_to = auth.uid())
  );

-- Storage: admin upload
CREATE POLICY "Admin upload todo attachments" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'todo-attachments'
    AND is_owner()
  );

-- Storage: admin delete
CREATE POLICY "Admin delete todo attachments" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'todo-attachments'
    AND is_owner()
  );

-- Storage: download if admin or assigned collaborator
CREATE POLICY "Download todo attachments" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'todo-attachments'
    AND (
      is_owner()
      OR EXISTS (
        SELECT 1 FROM public.todo_attachments ta
        JOIN public.todos t ON t.id = ta.todo_id
        WHERE ta.file_path = name AND t.assigned_to = auth.uid()
      )
    )
  );
