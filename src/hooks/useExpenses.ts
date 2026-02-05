 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 
 export interface Expense {
   id: string;
   user_id: string;
   client_id: string;
   matter_id: string;
   expense_date: string;
   nature: string;
   amount_ttc_cents: number;
   billable: boolean;
   locked: boolean;
   created_at: string;
   updated_at: string;
 }
 
 export function useExpenses(userId?: string, from?: string, to?: string) {
   return useQuery({
     queryKey: ['expenses', userId, from, to],
     queryFn: async () => {
       let query = supabase
         .from('expenses')
         .select('*')
         .order('expense_date', { ascending: false });
       
       if (userId) {
         query = query.eq('user_id', userId);
       }
       if (from) {
         query = query.gte('expense_date', from);
       }
       if (to) {
         query = query.lte('expense_date', to);
       }
       
       const { data, error } = await query;
       
       if (error) throw error;
       return data as Expense[];
     }
   });
 }
 
 export function useExpensesByMatter(matterId?: string) {
   return useQuery({
     queryKey: ['expenses', 'matter', matterId],
     queryFn: async () => {
       if (!matterId) return [];
       
       const { data, error } = await supabase
         .from('expenses')
         .select('*')
         .eq('matter_id', matterId)
         .eq('billable', true)
         .eq('locked', false)
         .order('expense_date', { ascending: false });
       
       if (error) throw error;
       return data as Expense[];
     },
     enabled: !!matterId
   });
 }
 
 export function useLockExpenses() {
   const queryClient = useQueryClient();
   
   return useMutation({
     mutationFn: async (expenseIds: string[]) => {
       const { error } = await supabase
         .from('expenses')
         .update({ locked: true })
         .in('id', expenseIds);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['expenses'] });
     }
   });
 }
 
 export function useCreateExpense() {
   const queryClient = useQueryClient();
   
   return useMutation({
     mutationFn: async (expense: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'locked'>) => {
       const { data, error } = await supabase
         .from('expenses')
         .insert(expense)
         .select()
         .single();
       
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['expenses'] });
     }
   });
 }
 
 export function useUpdateExpense() {
   const queryClient = useQueryClient();
   
   return useMutation({
     mutationFn: async ({ id, ...updates }: Partial<Expense> & { id: string }) => {
       const { data, error } = await supabase
         .from('expenses')
         .update(updates)
         .eq('id', id)
         .select()
         .single();
       
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['expenses'] });
     }
   });
 }
 
 export function useDeleteExpense() {
   const queryClient = useQueryClient();
   
   return useMutation({
     mutationFn: async (expenseId: string) => {
       const { error } = await supabase
         .from('expenses')
         .delete()
         .eq('id', expenseId);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['expenses'] });
     }
   });
 }
 
 export function formatCentsTTC(cents: number): string {
   return (cents / 100).toLocaleString('fr-FR', { 
     minimumFractionDigits: 2, 
     maximumFractionDigits: 2 
   }) + ' MAD';
 }