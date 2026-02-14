import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AgendaEntry {
  id: string;
  user_id: string;
  entry_date: string;
  note: string;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

export function useAgendaEntries() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['agenda-entries', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agenda_entries')
        .select('*')
        .eq('user_id', user!.id)
        .order('entry_date', { ascending: true });
      if (error) throw error;
      return data as AgendaEntry[];
    },
    enabled: !!user,
  });
}

export function useCreateAgendaEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entry_date, note }: { entry_date: string; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('agenda_entries')
        .insert({ user_id: user.id, entry_date, note })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda-entries'] }),
  });
}

export function useUpdateAgendaEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note, entry_date }: { id: string; note: string; entry_date: string }) => {
      const { data, error } = await supabase
        .from('agenda_entries')
        .update({ note, entry_date })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda-entries'] }),
  });
}

export function useDeleteAgendaEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('agenda_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agenda-entries'] }),
  });
}
