import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Todo {
  id: string;
  assigned_to: string;
  created_by: string;
  title: string;
  deadline: string;
  status: string;
  blocked_reason: string | null;
  created_at: string;
  updated_at: string;
}

export function useTodos(assignedTo?: string) {
  return useQuery({
    queryKey: ['todos', assignedTo],
    queryFn: async () => {
      let query = supabase
        .from('todos')
        .select('*')
        .order('deadline', { ascending: true });

      if (assignedTo) {
        query = query.eq('assigned_to', assignedTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Todo[];
    },
  });
}

export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (todo: { assigned_to: string; created_by: string; title: string; deadline: string }) => {
      const { data, error } = await supabase
        .from('todos')
        .insert(todo)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Todo> & { id: string }) => {
      const { data, error } = await supabase
        .from('todos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}

export function usePendingTodosCount(userId?: string) {
  return useQuery({
    queryKey: ['todos', 'pending-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from('todos')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .eq('status', 'pending');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });
}

export function useInProgressTodosCount(userId?: string) {
  return useQuery({
    queryKey: ['todos', 'in-progress-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from('todos')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .eq('status', 'in_progress');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });
}

export function useBlockedTodosCount(enabled: boolean) {
  return useQuery({
    queryKey: ['todos', 'blocked-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('todos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'blocked');
      if (error) throw error;
      return count || 0;
    },
    enabled,
  });
}
