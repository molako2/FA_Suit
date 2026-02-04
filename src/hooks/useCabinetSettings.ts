import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CabinetSettings {
  id: string;
  name: string;
  address: string | null;
  iban: string | null;
  mentions: string | null;
  rate_cabinet_cents: number;
  vat_default: number;
  invoice_seq_year: number;
  invoice_seq_next: number;
  credit_seq_year: number;
  credit_seq_next: number;
  updated_at: string;
}

export function useCabinetSettings() {
  return useQuery({
    queryKey: ['cabinet_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cabinet_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      
      if (error) throw error;
      return data as CabinetSettings;
    }
  });
}

export function useUpdateCabinetSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: Partial<CabinetSettings>) => {
      const { data, error } = await supabase
        .from('cabinet_settings')
        .update(updates)
        .eq('id', 'default')
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabinet_settings'] });
    }
  });
}

export function useIncrementInvoiceSeq() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data: settings } = await supabase
        .from('cabinet_settings')
        .select('invoice_seq_year, invoice_seq_next')
        .eq('id', 'default')
        .single();
      
      if (!settings) throw new Error('Cabinet settings not found');
      
      const currentYear = new Date().getFullYear();
      let nextSeq = settings.invoice_seq_next;
      let seqYear = settings.invoice_seq_year;
      
      if (seqYear !== currentYear) {
        seqYear = currentYear;
        nextSeq = 1;
      }
      
      const invoiceNumber = `${seqYear}-${String(nextSeq).padStart(4, '0')}`;
      
      await supabase
        .from('cabinet_settings')
        .update({
          invoice_seq_year: seqYear,
          invoice_seq_next: nextSeq + 1
        })
        .eq('id', 'default');
      
      return invoiceNumber;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabinet_settings'] });
    }
  });
}

export function useIncrementCreditSeq() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data: settings } = await supabase
        .from('cabinet_settings')
        .select('credit_seq_year, credit_seq_next')
        .eq('id', 'default')
        .single();
      
      if (!settings) throw new Error('Cabinet settings not found');
      
      const currentYear = new Date().getFullYear();
      let nextSeq = settings.credit_seq_next;
      let seqYear = settings.credit_seq_year;
      
      if (seqYear !== currentYear) {
        seqYear = currentYear;
        nextSeq = 1;
      }
      
      const creditNoteNumber = `AV-${seqYear}-${String(nextSeq).padStart(4, '0')}`;
      
      await supabase
        .from('cabinet_settings')
        .update({
          credit_seq_year: seqYear,
          credit_seq_next: nextSeq + 1
        })
        .eq('id', 'default');
      
      return creditNoteNumber;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabinet_settings'] });
    }
  });
}
