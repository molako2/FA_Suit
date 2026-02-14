import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function checkBudgetAlert(matterId: string) {
  try {
    const key = `budget-alert-${matterId}`;
    if (sessionStorage.getItem(key)) return;

    // Get matter details
    const { data: matter } = await supabase
      .from('matters')
      .select('id, code, label, max_amount_ht_cents, rate_cents, billing_type')
      .eq('id', matterId)
      .single();

    if (!matter || matter.billing_type !== 'time_based' || !matter.max_amount_ht_cents) return;

    // Get all billable entries for this matter
    const { data: entries } = await supabase
      .from('timesheet_entries')
      .select('minutes_rounded, user_id')
      .eq('matter_id', matterId)
      .eq('billable', true);

    if (!entries || entries.length === 0) return;

    // Get profiles for rate_cents
    const userIds = [...new Set(entries.map(e => e.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, rate_cents')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p.rate_cents]));

    // Calculate consumed cents
    const consumedCents = entries.reduce((sum, e) => {
      const rate = profileMap.get(e.user_id) ?? matter.rate_cents ?? 0;
      return sum + (e.minutes_rounded * rate / 60);
    }, 0);

    const percentage = (consumedCents / matter.max_amount_ht_cents) * 100;

    if (percentage < 80) return;

    // Mark as sent for this session
    sessionStorage.setItem(key, '1');

    // Get owner emails
    const { data: ownerRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['owner', 'sysadmin']);

    if (!ownerRoles || ownerRoles.length === 0) return;

    const { data: ownerProfiles } = await supabase
      .from('profiles')
      .select('email')
      .in('id', ownerRoles.map(r => r.user_id));

    const emails = (ownerProfiles || []).map(p => p.email).filter(Boolean);
    if (emails.length === 0) return;

    const pct = Math.round(percentage);
    const consumed = (consumedCents / 100).toFixed(2);
    const max = (matter.max_amount_ht_cents / 100).toFixed(2);

    await supabase.functions.invoke('send-email', {
      body: {
        to: emails,
        subject: `FlowAssist Suite - Alerte budget dossier ${matter.code}`,
        html: `
          <h2>Alerte budget - Dossier ${matter.code}</h2>
          <p>Le dossier <strong>${matter.code} - ${matter.label}</strong> a atteint <strong>${pct}%</strong> de son budget prévu.</p>
          <ul>
            <li>Montant consommé : ${consumed} MAD HT</li>
            <li>Plafond : ${max} MAD HT</li>
          </ul>
          <p>Veuillez prendre les mesures nécessaires.</p>
          <p>Connectez-vous à votre espace FlowAssist pour le consulter : <a href="https://www.flowassist.cloud">www.flowassist.cloud</a></p>
          <p>Cordialement,<br/>L'équipe FlowAssist</p>
        `,
      },
    });
  } catch (err) {
    console.error('Budget alert check failed:', err);
  }
}

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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      if (data?.matter_id) {
        checkBudgetAlert(data.matter_id);
      }
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
