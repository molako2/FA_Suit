import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CreditNote {
  id: string;
  number: string;
  invoice_id: string;
  issue_date: string;
  reason: string | null;
  total_ht_cents: number;
  total_vat_cents: number;
  total_ttc_cents: number;
  created_at: string;
}

export function useCreditNotes() {
  return useQuery({
    queryKey: ['credit_notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_notes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CreditNote[];
    }
  });
}

export function useCreditNote(creditNoteId: string | undefined) {
  return useQuery({
    queryKey: ['credit_note', creditNoteId],
    queryFn: async () => {
      if (!creditNoteId) return null;
      
      const { data, error } = await supabase
        .from('credit_notes')
        .select('*')
        .eq('id', creditNoteId)
        .single();
      
      if (error) throw error;
      return data as CreditNote;
    },
    enabled: !!creditNoteId
  });
}

export function useCreateCreditNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (creditNote: Omit<CreditNote, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('credit_notes')
        .insert(creditNote)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
    }
  });
}
