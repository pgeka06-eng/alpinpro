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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      climber_profiles: {
        Row: {
          avg_check: number
          created_at: string
          id: string
          portfolio_urls: string[]
          rating: number
          reliability: number
          total_orders: number
          updated_at: string
          user_id: string
          work_types: string[]
        }
        Insert: {
          avg_check?: number
          created_at?: string
          id?: string
          portfolio_urls?: string[]
          rating?: number
          reliability?: number
          total_orders?: number
          updated_at?: string
          user_id: string
          work_types?: string[]
        }
        Update: {
          avg_check?: number
          created_at?: string
          id?: string
          portfolio_urls?: string[]
          rating?: number
          reliability?: number
          total_orders?: number
          updated_at?: string
          user_id?: string
          work_types?: string[]
        }
        Relationships: []
      }
      contact_requests: {
        Row: {
          client_name: string
          client_phone: string
          climber_user_id: string
          created_at: string
          id: string
          message: string | null
          status: string
          work_type: string | null
        }
        Insert: {
          client_name: string
          client_phone: string
          climber_user_id: string
          created_at?: string
          id?: string
          message?: string | null
          status?: string
          work_type?: string | null
        }
        Update: {
          client_name?: string
          client_phone?: string
          climber_user_id?: string
          created_at?: string
          id?: string
          message?: string | null
          status?: string
          work_type?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          description: string | null
          estimate_id: string | null
          id: string
          number: string
          pdf_path: string | null
          signed_at: string | null
          signed_device: string | null
          signed_ip: string | null
          signed_user_agent: string | null
          status: string
          token: string
          total_price: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          description?: string | null
          estimate_id?: string | null
          id?: string
          number: string
          pdf_path?: string | null
          signed_at?: string | null
          signed_device?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          status?: string
          token?: string
          total_price?: number
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          description?: string | null
          estimate_id?: string | null
          id?: string
          number?: string
          pdf_path?: string | null
          signed_at?: string | null
          signed_device?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          status?: string
          token?: string
          total_price?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_settings: {
        Row: {
          created_at: string
          crew_daily_wage: number
          crew_size: number
          equipment_amortization: number
          hourly_rate: number
          hours_per_unit: number
          id: string
          material_cost_per_unit: number
          overhead_percent: number
          transport_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crew_daily_wage?: number
          crew_size?: number
          equipment_amortization?: number
          hourly_rate?: number
          hours_per_unit?: number
          id?: string
          material_cost_per_unit?: number
          overhead_percent?: number
          transport_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          crew_daily_wage?: number
          crew_size?: number
          equipment_amortization?: number
          hourly_rate?: number
          hours_per_unit?: number
          id?: string
          material_cost_per_unit?: number
          overhead_percent?: number
          transport_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      estimates: {
        Row: {
          base_price: number
          client_email: string | null
          client_name: string
          client_phone: string | null
          coeff_complexity: number
          coeff_height: number
          coeff_season: number
          coeff_urgency: number
          created_at: string
          description: string | null
          id: string
          service_name: string
          signed_at: string | null
          signed_device: string | null
          signed_ip: string | null
          signed_user_agent: string | null
          status: string
          token: string
          total_coeff: number
          total_price: number
          unit: string
          updated_at: string
          user_id: string
          volume: number
        }
        Insert: {
          base_price: number
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          coeff_complexity?: number
          coeff_height?: number
          coeff_season?: number
          coeff_urgency?: number
          created_at?: string
          description?: string | null
          id?: string
          service_name: string
          signed_at?: string | null
          signed_device?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          status?: string
          token?: string
          total_coeff?: number
          total_price: number
          unit: string
          updated_at?: string
          user_id: string
          volume: number
        }
        Update: {
          base_price?: number
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          coeff_complexity?: number
          coeff_height?: number
          coeff_season?: number
          coeff_urgency?: number
          created_at?: string
          description?: string | null
          id?: string
          service_name?: string
          signed_at?: string | null
          signed_device?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          status?: string
          token?: string
          total_coeff?: number
          total_price?: number
          unit?: string
          updated_at?: string
          user_id?: string
          volume?: number
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          expense_date: string
          id: string
          include_vat: boolean
          order_id: string | null
          payment_method: string
          user_id: string
          vat_amount: number
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          include_vat?: boolean
          order_id?: string | null
          payment_method?: string
          user_id: string
          vat_amount?: number
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          include_vat?: boolean
          order_id?: string | null
          payment_method?: string
          user_id?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_photos: {
        Row: {
          caption: string | null
          created_at: string
          file_path: string | null
          id: string
          order_id: string
          photo_url: string
          type: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          order_id: string
          photo_url: string
          type?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          order_id?: string
          photo_url?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_photos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_id: string | null
          climber_user_id: string | null
          completed_date: string | null
          created_at: string
          description: string | null
          estimate_id: string | null
          id: string
          is_repeat: boolean
          order_number: string
          paid_amount: number
          payment_date: string | null
          payment_method: string | null
          payment_status: string
          scheduled_date: string | null
          service_name: string
          site_id: string | null
          status: string
          total_price: number
          unit: string | null
          updated_at: string
          user_id: string
          volume: number | null
        }
        Insert: {
          client_id?: string | null
          climber_user_id?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          estimate_id?: string | null
          id?: string
          is_repeat?: boolean
          order_number: string
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          scheduled_date?: string | null
          service_name: string
          site_id?: string | null
          status?: string
          total_price?: number
          unit?: string | null
          updated_at?: string
          user_id: string
          volume?: number | null
        }
        Update: {
          client_id?: string | null
          climber_user_id?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          estimate_id?: string | null
          id?: string
          is_repeat?: boolean
          order_number?: string
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          scheduled_date?: string | null
          service_name?: string
          site_id?: string | null
          status?: string
          total_price?: number
          unit?: string | null
          updated_at?: string
          user_id?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          include_vat: boolean
          note: string | null
          order_id: string
          payment_date: string
          payment_method: string
          user_id: string
          vat_amount: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          include_vat?: boolean
          note?: string | null
          order_id: string
          payment_date?: string
          payment_method?: string
          user_id: string
          vat_amount?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          include_vat?: boolean
          note?: string | null
          order_id?: string
          payment_date?: string
          payment_method?: string
          user_id?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          changed_by: string
          created_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          price_item_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          price_item_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          price_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_price_item_id_fkey"
            columns: ["price_item_id"]
            isOneToOne: false
            referencedRelation: "price_items"
            referencedColumns: ["id"]
          },
        ]
      }
      price_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_verified: boolean
          price: number
          price_list_id: string
          service_name: string
          sort_order: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_verified?: boolean
          price?: number
          price_list_id: string
          service_name: string
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_verified?: boolean
          price?: number
          price_list_id?: string
          service_name?: string
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          created_at: string
          file_path: string | null
          file_url: string | null
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          file_url?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string | null
          file_url?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          description: string | null
          full_name: string | null
          id: string
          is_blocked: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          climber_user_id: string
          comment: string | null
          created_at: string
          estimate_id: string | null
          id: string
          punctuality_score: number
          quality_score: number
          rating: number
          reviewer_email: string | null
          reviewer_name: string
          safety_score: number
        }
        Insert: {
          climber_user_id: string
          comment?: string | null
          created_at?: string
          estimate_id?: string | null
          id?: string
          punctuality_score?: number
          quality_score?: number
          rating: number
          reviewer_email?: string | null
          reviewer_name: string
          safety_score?: number
        }
        Update: {
          climber_user_id?: string
          comment?: string | null
          created_at?: string
          estimate_id?: string | null
          id?: string
          punctuality_score?: number
          quality_score?: number
          rating?: number
          reviewer_email?: string | null
          reviewer_name?: string
          safety_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          period_end: string
          period_start: string
          user_id: string
          worker_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          period_end: string
          period_start: string
          user_id: string
          worker_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          period_end?: string
          period_start?: string
          user_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string
          city: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          photo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          city?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          city?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      worker_assignments: {
        Row: {
          created_at: string
          daily_pay: number | null
          hours_worked: number | null
          id: string
          notes: string | null
          order_id: string
          status: string
          user_id: string
          work_date: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string
          daily_pay?: number | null
          hours_worked?: number | null
          id?: string
          notes?: string | null
          order_id: string
          status?: string
          user_id: string
          work_date?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string
          daily_pay?: number | null
          hours_worked?: number | null
          id?: string
          notes?: string | null
          order_id?: string
          status?: string
          user_id?: string
          work_date?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          created_at: string
          daily_rate: number
          hourly_rate: number
          id: string
          name: string
          notes: string | null
          phone: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_rate?: number
          hourly_rate?: number
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_rate?: number
          hourly_rate?: number
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "climber"
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
      app_role: ["admin", "manager", "climber"],
    },
  },
} as const
