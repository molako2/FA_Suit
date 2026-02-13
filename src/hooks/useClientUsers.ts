import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClientUser {
  id: string;
  user_id: string;
  client_id: string;
  created_at: string;
}

export function useClientUsers(userId?: string) {
  return useQuery({
    queryKey: ['client-users', userId],
    queryFn: async () => {
      let query = supabase.from('client_users').select('*');
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as ClientUser[];
    },
  });
}

export function useClientUsersByClient(clientId?: string) {
  return useQuery({
    queryKey: ['client-users-by-client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_users')
        .select('*')
        .eq('client_id', clientId);
      if (error) throw error;
      return data as ClientUser[];
    },
    enabled: !!clientId,
  });
}

export function useSetClientUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, clientIds }: { userId: string; clientIds: string[] }) => {
      // Delete existing associations
      const { error: deleteError } = await supabase
        .from('client_users')
        .delete()
        .eq('user_id', userId);
      if (deleteError) throw deleteError;

      // Insert new associations
      if (clientIds.length > 0) {
        const rows = clientIds.map(clientId => ({
          user_id: userId,
          client_id: clientId,
        }));
        const { error: insertError } = await supabase
          .from('client_users')
          .insert(rows as any);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-users'] });
      toast.success('Associations client mises à jour');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour des associations');
    },
  });
}
