export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          matter_id: string
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          matter_id: string
          start_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          matter_id?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cabinet_settings: {
        Row: {
          address: string | null
          credit_seq_next: number
          credit_seq_year: number
          iban: string | null
          id: string
          invoice_seq_next: number
          invoice_seq_year: number
          mentions: string | null
          name: string
          rate_cabinet_cents: number
          updated_at: string
          vat_default: number
        }
        Insert: {
          address?: string | null
          credit_seq_next?: number
          credit_seq_year?: number
          iban?: string | null
          id?: string
          invoice_seq_next?: number
          invoice_seq_year?: number
          mentions?: string | null
          name?: string
          rate_cabinet_cents?: number
          updated_at?: string
          vat_default?: number
        }
        Update: {
          address?: string | null
          credit_seq_next?: number
          credit_seq_year?: number
          iban?: string | null
          id?: string
          invoice_seq_next?: number
          invoice_seq_year?: number
          mentions?: string | null
          name?: string
          rate_cabinet_cents?: number
          updated_at?: string
          vat_default?: number
        }
        Relationships: []
      }
      clients: {
        Row: {
          active: boolean
          address: string | null
          billing_email: string | null
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          billing_email?: string | null
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          billing_email?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      credit_notes: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          issue_date: string
          number: string
          reason: string | null
          total_ht_cents: number
          total_ttc_cents: number
          total_vat_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          issue_date: string
          number: string
          reason?: string | null
          total_ht_cents: number
          total_ttc_cents: number
          total_vat_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          issue_date?: string
          number?: string
          reason?: string | null
          total_ht_cents?: number
          total_ttc_cents?: number
          total_vat_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          id: string
          issue_date: string | null
          lines: Json
          matter_id: string
          number: string | null
          paid: boolean
          payment_date: string | null
          period_from: string
          period_to: string
          status: string
          total_ht_cents: number
          total_ttc_cents: number
          total_vat_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_date?: string | null
          lines?: Json
          matter_id: string
          number?: string | null
          paid?: boolean
          payment_date?: string | null
          period_from: string
          period_to: string
          status?: string
          total_ht_cents?: number
          total_ttc_cents?: number
          total_vat_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_date?: string | null
          lines?: Json
          matter_id?: string
          number?: string | null
          paid?: boolean
          payment_date?: string | null
          period_from?: string
          period_to?: string
          status?: string
          total_ht_cents?: number
          total_ttc_cents?: number
          total_vat_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      matters: {
        Row: {
          billing_type: string
          client_id: string
          code: string
          created_at: string
          flat_fee_cents: number | null
          id: string
          label: string
          rate_cents: number | null
          status: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          billing_type?: string
          client_id: string
          code: string
          created_at?: string
          flat_fee_cents?: number | null
          id?: string
          label: string
          rate_cents?: number | null
          status?: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          billing_type?: string
          client_id?: string
          code?: string
          created_at?: string
          flat_fee_cents?: number | null
          id?: string
          label?: string
          rate_cents?: number | null
          status?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "matters_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          name: string
          rate_cents: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id: string
          name: string
          rate_cents?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          rate_cents?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      timesheet_entries: {
        Row: {
          billable: boolean
          created_at: string
          date: string
          description: string
          id: string
          locked: boolean
          matter_id: string
          minutes_rounded: number
          updated_at: string
          user_id: string
        }
        Insert: {
          billable?: boolean
          created_at?: string
          date: string
          description: string
          id?: string
          locked?: boolean
          matter_id: string
          minutes_rounded: number
          updated_at?: string
          user_id: string
        }
        Update: {
          billable?: boolean
          created_at?: string
          date?: string
          description?: string
          id?: string
          locked?: boolean
          matter_id?: string
          minutes_rounded?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
      is_owner_or_assistant: { Args: never; Returns: boolean }
      is_sysadmin: { Args: never; Returns: boolean }
      user_is_assigned_to_matter: {
        Args: { _matter_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "assistant" | "collaborator" | "sysadmin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "assistant", "collaborator", "sysadmin"],
    },
  },
} as const
