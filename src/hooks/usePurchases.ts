import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Purchase {
  id: string;
  invoice_number: string;
  designation: string;
  amount_ht_cents: number;
  amount_tva_cents: number;
  amount_ttc_cents: number;
  num_if: string | null;
  supplier: string;
  ice: string | null;
  rate: number | null;
  prorata: number | null;
  payment_mode: number;
  payment_date: string | null;
  invoice_date: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export const PAYMENT_MODES = [
  { id: 1, label: 'Espèces' },
  { id: 2, label: 'Chèque' },
  { id: 3, label: 'Prélèvement' },
  { id: 4, label: 'Virement' },
  { id: 5, label: 'Effets' },
  { id: 6, label: 'Compensation' },
  { id: 7, label: 'Autres' },
];

export function usePurchases(from?: string, to?: string) {
  return useQuery({
    queryKey: ['purchases', from, to],
    queryFn: async () => {
      let query = supabase
        .from('purchases')
        .select('*')
        .order('invoice_date', { ascending: false });
      
      if (from) {
        query = query.gte('invoice_date', from);
      }
      if (to) {
        query = query.lte('invoice_date', to);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Purchase[];
    }
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (purchase: Omit<Purchase, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('purchases')
        .insert(purchase)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    }
  });
}

export function useUpdatePurchase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Purchase> & { id: string }) => {
      const { data, error } = await supabase
        .from('purchases')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    }
  });
}

export function useDeletePurchase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (purchaseId: string) => {
      const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchaseId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    }
  });
}

export function formatCentsToMAD(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }) + ' MAD';
}
