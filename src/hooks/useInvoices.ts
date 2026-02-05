import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface InvoiceLine {
  id: string;
  label: string;
  minutes: number;
  rate_cents: number;
  vat_rate: number;
  amount_ht_cents: number;
  vat_cents: number;
  amount_ttc_cents: number;
  expense_id?: string;
}

export interface Invoice {
  id: string;
  number: string | null;
  matter_id: string;
  status: 'draft' | 'issued' | 'cancelled';
  period_from: string;
  period_to: string;
  issue_date: string | null;
  lines: InvoiceLine[];
  total_ht_cents: number;
  total_vat_cents: number;
  total_ttc_cents: number;
  paid: boolean;
  payment_date: string | null;
  created_at: string;
  updated_at: string;
}

interface DbInvoice {
  id: string;
  number: string | null;
  matter_id: string;
  status: string;
  period_from: string;
  period_to: string;
  issue_date: string | null;
  lines: Json;
  total_ht_cents: number;
  total_vat_cents: number;
  total_ttc_cents: number;
  paid: boolean;
  payment_date: string | null;
  created_at: string;
  updated_at: string;
}

function mapDbInvoiceToInvoice(db: DbInvoice): Invoice {
  return {
    ...db,
    status: db.status as 'draft' | 'issued' | 'cancelled',
    lines: (db.lines as unknown as InvoiceLine[]) || []
  };
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data as DbInvoice[]).map(mapDbInvoiceToInvoice);
    }
  });
}

export function useInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();
      
      if (error) throw error;
      return mapDbInvoiceToInvoice(data as DbInvoice);
    },
    enabled: !!invoiceId
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          ...invoice,
          lines: invoice.lines as unknown as Json
        })
        .select()
        .single();
      
      if (error) throw error;
      return mapDbInvoiceToInvoice(data as DbInvoice);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Invoice> & { id: string }) => {
      const dbUpdates: Record<string, unknown> = { ...updates };
      if (updates.lines) {
        dbUpdates.lines = updates.lines as unknown as Json;
      }
      
      const { data, error } = await supabase
        .from('invoices')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return mapDbInvoiceToInvoice(data as DbInvoice);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });
}
