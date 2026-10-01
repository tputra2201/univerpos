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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_releases: {
        Row: {
          created_at: string
          id: string
          notes: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string
          version?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          app_icon: string
          app_name: string
          contact_email: string
          contact_phone: string
          id: number
          updated_at: string
        }
        Insert: {
          app_icon?: string
          app_name?: string
          contact_email?: string
          contact_phone?: string
          id?: number
          updated_at?: string
        }
        Update: {
          app_icon?: string
          app_name?: string
          contact_email?: string
          contact_phone?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      business_types: {
        Row: {
          base_kind: string
          created_at: string
          description: string
          id: string
          name: string
        }
        Insert: {
          base_kind?: string
          created_at?: string
          description?: string
          id?: string
          name: string
        }
        Update: {
          base_kind?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      device_slots: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          label: string
          one_time_key: string
          slot_code: string
          store_id: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          label?: string
          one_time_key?: string
          slot_code: string
          store_id: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          label?: string
          one_time_key?: string
          slot_code?: string
          store_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_slots_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "store_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_slots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_devices: {
        Row: {
          created_at: string
          current_user_name: string
          current_user_role: string
          device_model: string
          device_name: string
          device_token: string
          id: string
          is_active: boolean
          is_developer: boolean
          last_seen_at: string
          shift_open: boolean
          store_id: string
        }
        Insert: {
          created_at?: string
          current_user_name?: string
          current_user_role?: string
          device_model?: string
          device_name?: string
          device_token: string
          id?: string
          is_active?: boolean
          is_developer?: boolean
          last_seen_at?: string
          shift_open?: boolean
          store_id: string
        }
        Update: {
          created_at?: string
          current_user_name?: string
          current_user_role?: string
          device_model?: string
          device_name?: string
          device_token?: string
          id?: string
          is_active?: boolean
          is_developer?: boolean
          last_seen_at?: string
          shift_open?: boolean
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_devices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_records: {
        Row: {
          collection: string
          created_at: string
          data: Json | null
          deleted: boolean
          device_id: string | null
          id: string
          record_id: string
          seq: number
          store_id: string
          updated_at: string
        }
        Insert: {
          collection: string
          created_at?: string
          data?: Json | null
          deleted?: boolean
          device_id?: string | null
          id?: string
          record_id: string
          seq?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          collection?: string
          created_at?: string
          data?: Json | null
          deleted?: boolean
          device_id?: string | null
          id?: string
          record_id?: string
          seq?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          activation_key: string
          active: boolean
          app_version: string
          business_type_id: string | null
          code: string
          created_at: string
          device_count: number
          expires_at: string | null
          id: string
          last_activated_at: string | null
          last_activated_by: string
          max_devices: number
          mode: string
          name: string
          notes: string
        }
        Insert: {
          activation_key?: string
          active?: boolean
          app_version?: string
          business_type_id?: string | null
          code: string
          created_at?: string
          device_count?: number
          expires_at?: string | null
          id?: string
          last_activated_at?: string | null
          last_activated_by?: string
          max_devices?: number
          mode?: string
          name: string
          notes?: string
        }
        Update: {
          activation_key?: string
          active?: boolean
          app_version?: string
          business_type_id?: string | null
          code?: string
          created_at?: string
          device_count?: number
          expires_at?: string | null
          id?: string
          last_activated_at?: string | null
          last_activated_by?: string
          max_devices?: number
          mode?: string
          name?: string
          notes?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_business_type_id_fkey"
            columns: ["business_type_id"]
            isOneToOne: false
            referencedRelation: "business_types"
            referencedColumns: ["id"]
          },
        ]
      }
      update_requests: {
        Row: {
          created_at: string
          current_version: string
          decided_at: string | null
          id: string
          requested_by: string
          status: string
          store_id: string
          target_version: string
        }
        Insert: {
          created_at?: string
          current_version?: string
          decided_at?: string | null
          id?: string
          requested_by?: string
          status?: string
          store_id: string
          target_version?: string
        }
        Update: {
          created_at?: string
          current_version?: string
          decided_at?: string | null
          id?: string
          requested_by?: string
          status?: string
          store_id?: string
          target_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
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
      _sync_device: {
        Args: { _code: string; _token: string }
        Returns: {
          device_id: string
          store_id: string
        }[]
      }
      activate_device: {
        Args: {
          _code: string
          _device_name: string
          _key: string
          _token: string
        }
        Returns: {
          base_kind: string
          business_type_name: string
          code: string
          device_count: number
          expires_at: string
          max_devices: number
          mode: string
          name: string
        }[]
      }
      activate_slot: {
        Args: {
          _code: string
          _device_name: string
          _key: string
          _slot: string
          _token: string
        }
        Returns: {
          admin_key: string
          base_kind: string
          business_type_name: string
          code: string
          device_count: number
          expires_at: string
          max_devices: number
          mode: string
          name: string
        }[]
      }
      activate_store: {
        Args: { _store_id: string }
        Returns: {
          code: string
          mode: string
          name: string
        }[]
      }
      app_branding: {
        Args: never
        Returns: {
          app_icon: string
          app_name: string
        }[]
      }
      check_device: {
        Args: { _code: string; _token: string }
        Returns: boolean
      }
      check_store: {
        Args: { _code: string }
        Returns: {
          active: boolean
          expires_at: string
          has_data: boolean
          mode: string
        }[]
      }
      dev_attach_device: {
        Args: { _code: string; _device_name: string; _token: string }
        Returns: {
          activation_key: string
          business_type_name: string
          code: string
          expires_at: string
          has_data: boolean
          mode: string
          name: string
        }[]
      }
      developer_contact: {
        Args: never
        Returns: {
          contact_email: string
          contact_phone: string
        }[]
      }
      developer_exists: { Args: never; Returns: boolean }
      device_heartbeat: {
        Args: {
          _code: string
          _model?: string
          _shift_open?: boolean
          _token: string
          _user_name?: string
          _user_role?: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      latest_release: {
        Args: never
        Returns: {
          notes: string
          version: string
        }[]
      }
      mark_update_applied: {
        Args: { _id: string; _version: string }
        Returns: undefined
      }
      release_device: {
        Args: { _code: string; _device_id: string; _key: string }
        Returns: number
      }
      request_update: {
        Args: { _by: string; _code: string; _current: string }
        Returns: string
      }
      store_devices_list: {
        Args: { _code: string; _key: string }
        Returns: {
          created_at: string
          current_user_name: string
          current_user_role: string
          device_model: string
          device_name: string
          id: string
          is_active: boolean
          last_seen_at: string
          max_devices: number
          shift_open: boolean
        }[]
      }
      sync_pull: {
        Args: { _code: string; _since: number; _token: string }
        Returns: {
          collection: string
          data: Json
          deleted: boolean
          record_id: string
          seq: number
        }[]
      }
      sync_push: {
        Args: { _code: string; _records: Json; _token: string }
        Returns: number
      }
      update_request_status: {
        Args: { _id: string }
        Returns: {
          status: string
          target_version: string
        }[]
      }
    }
    Enums: {
      app_role: "developer" | "installer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["developer", "installer"],
    },
  },
} as const
