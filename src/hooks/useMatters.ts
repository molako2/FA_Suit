import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Matter {
  id: string;
  code: string;
  label: string;
  client_id: string;
  status: 'open' | 'closed';
  rate_cents: number | null;
  vat_rate: number;
  billing_type: 'time_based' | 'flat_fee';
  flat_fee_cents: number | null;
  intervention_nature: string | null;
  client_sector: string | null;
  created_at: string;
  updated_at: string;
}

export function useMatters() {
  return useQuery({
    queryKey: ['matters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matters')
        .select('*')
        .order('code');
      
      if (error) throw error;
      return data as Matter[];
    }
  });
}

export function useMatter(matterId: string | undefined) {
  return useQuery({
    queryKey: ['matter', matterId],
    queryFn: async () => {
      if (!matterId) return null;
      
      const { data, error } = await supabase
        .from('matters')
        .select('*')
        .eq('id', matterId)
        .single();
      
      if (error) throw error;
      return data as Matter;
    },
    enabled: !!matterId
  });
}

export function useCreateMatter() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (matter: Omit<Matter, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('matters')
        .insert(matter)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
    }
  });
}

export function useUpdateMatter() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Matter> & { id: string }) => {
      const { data, error } = await supabase
        .from('matters')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
    }
  });
}

export function useDeleteMatter() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (matterId: string) => {
      const { error } = await supabase
        .from('matters')
        .delete()
        .eq('id', matterId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
    }
  });
}

export function generateMatterCode(matters: Matter[], clientCode: string): string {
  // Filter matters for this specific client
  const clientMatters = matters.filter(m => m.code.startsWith(clientCode + '-'));
  const existingCodes = matters.map(m => m.code);
  
  let num = clientMatters.length + 1;
  let code = `${clientCode}-DOS${String(num).padStart(4, '0')}`;
  while (existingCodes.includes(code)) {
    num++;
    code = `${clientCode}-DOS${String(num).padStart(4, '0')}`;
  }
  return code;
}
