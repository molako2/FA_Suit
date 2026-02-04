import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TimesheetEntry {
  id: string;
  user_id: string;
  matter_id: string;
  date: string;
  minutes_rounded: number;
  description: string;
  billable: boolean;
  locked: boolean;
  created_at: string;
  updated_at: string;
}

export function useTimesheetEntries(userId?: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['timesheet', userId, from, to],
    queryFn: async () => {
      let query = supabase
        .from('timesheet_entries')
        .select('*')
        .order('date', { ascending: false });
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      if (from) {
        query = query.gte('date', from);
      }
      if (to) {
        query = query.lte('date', to);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as TimesheetEntry[];
    }
  });
}

export function useCreateTimesheetEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entry: Omit<TimesheetEntry, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('timesheet_entries')
        .insert(entry)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
    }
  });
}

export function useUpdateTimesheetEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TimesheetEntry> & { id: string }) => {
      const { data, error } = await supabase
        .from('timesheet_entries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
    }
  });
}

export function useDeleteTimesheetEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('timesheet_entries')
        .delete()
        .eq('id', entryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
    }
  });
}

export function useLockTimesheetEntries() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entryIds: string[]) => {
      const { error } = await supabase
        .from('timesheet_entries')
        .update({ locked: true })
        .in('id', entryIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
    }
  });
}

// Round minutes to 15-minute increments (ceiling)
export function roundMinutes(minutes: number): number {
  if (minutes <= 0) return 15;
  return Math.ceil(minutes / 15) * 15;
}

// Format minutes to hours display
export function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins}`;
}
