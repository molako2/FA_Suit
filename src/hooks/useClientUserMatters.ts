import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClientUserMatter {
  id: string;
  user_id: string;
  client_id: string;
  matter_id: string;
  created_at: string;
}

export function useClientUserMatters(userId?: string) {
  return useQuery({
    queryKey: ['client-user-matters', userId],
    queryFn: async () => {
      let query = supabase.from('client_user_matters' as any).select('*');
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown) as ClientUserMatter[];
    },
  });
}

export function useSetClientUserMatters() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, mattersByClient }: { userId: string; mattersByClient: Record<string, string[]> }) => {
      // Delete existing associations for this user
      const { error: deleteError } = await supabase
        .from('client_user_matters' as any)
        .delete()
        .eq('user_id', userId);
      if (deleteError) throw deleteError;

      // Build rows from mattersByClient
      const rows: { user_id: string; client_id: string; matter_id: string }[] = [];
      for (const [clientId, matterIds] of Object.entries(mattersByClient)) {
        for (const matterId of matterIds) {
          rows.push({ user_id: userId, client_id: clientId, matter_id: matterId });
        }
      }

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('client_user_matters' as any)
          .insert(rows);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-user-matters'] });
      toast.success('Associations dossiers mises à jour');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour des associations dossiers');
    },
  });
}
