import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TodoAttachment {
  id: string;
  todo_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  created_by: string;
  created_at: string;
}

const MAX_TOTAL_SIZE = 15 * 1024 * 1024; // 15 MB

export function useTodoAttachments(todoId?: string) {
  return useQuery({
    queryKey: ['todo-attachments', todoId],
    queryFn: async () => {
      if (!todoId) return [];
      const { data, error } = await supabase
        .from('todo_attachments')
        .select('*')
        .eq('todo_id', todoId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as TodoAttachment[];
    },
    enabled: !!todoId,
  });
}

export function useUploadTodoAttachments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      todoId,
      files,
      userId,
      existingSize,
    }: {
      todoId: string;
      files: File[];
      userId: string;
      existingSize: number;
    }) => {
      const newSize = files.reduce((s, f) => s + f.size, 0);
      if (existingSize + newSize > MAX_TOTAL_SIZE) {
        throw new Error('SIZE_EXCEEDED');
      }

      const results: TodoAttachment[] = [];

      for (const file of files) {
        const filePath = `${todoId}/${crypto.randomUUID()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('todo-attachments')
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data, error: insertError } = await supabase
          .from('todo_attachments')
          .insert({
            todo_id: todoId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            created_by: userId,
          })
          .select()
          .single();
        if (insertError) throw insertError;
        results.push(data as TodoAttachment);
      }

      return results;
    },
    onSuccess: (_, { todoId }) => {
      queryClient.invalidateQueries({ queryKey: ['todo-attachments', todoId] });
      queryClient.invalidateQueries({ queryKey: ['todo-attachments-count'] });
    },
  });
}

export function useDeleteTodoAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, filePath, todoId }: { id: string; filePath: string; todoId: string }) => {
      const { error: storageError } = await supabase.storage
        .from('todo-attachments')
        .remove([filePath]);
      if (storageError) throw storageError;

      const { error } = await supabase
        .from('todo_attachments')
        .delete()
        .eq('id', id);
      if (error) throw error;

      return todoId;
    },
    onSuccess: (todoId) => {
      queryClient.invalidateQueries({ queryKey: ['todo-attachments', todoId] });
      queryClient.invalidateQueries({ queryKey: ['todo-attachments-count'] });
    },
  });
}

export async function downloadTodoAttachment(filePath: string, fileName: string) {
  const { data, error } = await supabase.storage
    .from('todo-attachments')
    .download(filePath);
  if (error) throw error;

  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Hook to check which todos have attachments (for paperclip icon) */
export function useTodoAttachmentCounts(todoIds: string[]) {
  return useQuery({
    queryKey: ['todo-attachments-count', todoIds],
    queryFn: async () => {
      if (!todoIds.length) return new Map<string, number>();
      const { data, error } = await supabase
        .from('todo_attachments')
        .select('todo_id, id')
        .in('todo_id', todoIds);
      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of data) {
        counts.set(row.todo_id, (counts.get(row.todo_id) || 0) + 1);
      }
      return counts;
    },
    enabled: todoIds.length > 0,
  });
}

export const MAX_ATTACHMENT_SIZE = MAX_TOTAL_SIZE;
