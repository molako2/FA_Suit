import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Assignment {
  id: string;
  matter_id: string;
  user_id: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export function useAssignments() {
  return useQuery({
    queryKey: ['assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Assignment[];
    }
  });
}

export function useUserAssignments(userId: string | undefined) {
  return useQuery({
    queryKey: ['assignments', 'user', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('user_id', userId)
        .lte('start_date', today)
        .or(`end_date.is.null,end_date.gte.${today}`);
      
      if (error) throw error;
      return data as Assignment[];
    },
    enabled: !!userId
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (assignment: Omit<Assignment, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('assignments')
        .insert(assignment)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    }
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Assignment> & { id: string }) => {
      const { data, error } = await supabase
        .from('assignments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    }
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    }
  });
}
