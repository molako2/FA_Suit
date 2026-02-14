import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const resend = new Resend(resendApiKey);

    // Find entries where entry_date is tomorrow and reminder not yet sent
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const { data: entries, error: fetchError } = await supabase
      .from('agenda_entries')
      .select('id, user_id, entry_date, note')
      .eq('entry_date', tomorrowStr)
      .eq('reminder_sent', false);

    if (fetchError) {
      console.error('Error fetching entries:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ message: 'No reminders to send', count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get unique user IDs
    const userIds = [...new Set(entries.map(e => e.user_id))];

    // Fetch profiles for emails
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, name')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    let sentCount = 0;

    for (const entry of entries) {
      const profile = profileMap.get(entry.user_id);
      if (!profile?.email) continue;

      const dateFormatted = new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
          <h2 style="color:#1e293b;">⏰ Rappel FlowAssist</h2>
          <p>Bonjour <strong>${profile.name}</strong>,</p>
          <p>Vous avez une échéance demain :</p>
          <div style="background:#f1f5f9;border-left:4px solid #3b82f6;padding:12px 16px;margin:16px 0;border-radius:4px;">
            <p style="margin:0;font-weight:600;">${dateFormatted}</p>
            <p style="margin:8px 0 0;color:#334155;">${entry.note}</p>
          </div>
          <p style="color:#64748b;font-size:13px;">Cet email a été envoyé automatiquement par FlowAssist.</p>
        </div>
      `;

      try {
        await resend.emails.send({
          from: 'FlowAssist <noreply@flowassist.cloud>',
          to: [profile.email],
          subject: `⏰ Rappel : ${entry.note.substring(0, 60)}`,
          html,
        });

        // Mark as sent
        await supabase
          .from('agenda_entries')
          .update({ reminder_sent: true })
          .eq('id', entry.id);

        sentCount++;
      } catch (emailErr) {
        console.error(`Failed to send reminder for entry ${entry.id}:`, emailErr);
      }
    }

    return new Response(JSON.stringify({ message: `Sent ${sentCount} reminders`, count: sentCount }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
