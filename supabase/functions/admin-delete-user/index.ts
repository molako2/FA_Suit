import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    // Verify caller is sysadmin/owner
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (!callerRole || !["sysadmin", "owner"].includes(callerRole.role)) {
      return new Response(JSON.stringify({ error: "Accès non autorisé" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (userId === caller.id) {
      return new Response(JSON.stringify({ error: "Vous ne pouvez pas supprimer votre propre compte" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean up all related data (order matters for FK constraints)
    await adminClient.from("message_reads").delete().eq("user_id", userId);
    await adminClient.from("messages").delete().eq("sender_id", userId);
    await adminClient.from("messages").delete().eq("recipient_id", userId);
    await adminClient.from("todos").delete().eq("assigned_to", userId);
    await adminClient.from("todos").delete().eq("created_by", userId);
    await adminClient.from("timesheet_entries").delete().eq("user_id", userId);
    await adminClient.from("expenses").delete().eq("user_id", userId);
    await adminClient.from("assignments").delete().eq("user_id", userId);
    await adminClient.from("client_user_matters").delete().eq("user_id", userId);
    await adminClient.from("client_users").delete().eq("user_id", userId);
    await adminClient.from("client_documents").delete().eq("uploaded_by", userId);
    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("id", userId);

    // Delete auth user
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
