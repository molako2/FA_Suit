import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export function useAuditLogs(limit = 100) {
  return useQuery({
    queryKey: ['audit_logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as AuditLog[];
    }
  });
}

export function useCreateAuditLog() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (log: Omit<AuditLog, 'id' | 'user_id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert([{
          action: log.action,
          entity_type: log.entity_type,
          entity_id: log.entity_id,
          details: log.details as Json,
          user_id: user?.id || null
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    }
  });
}
