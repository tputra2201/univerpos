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
      store_devices: {
        Row: {
          created_at: string
          device_name: string
          device_token: string
          id: string
          is_active: boolean
          last_seen_at: string
          store_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string
          device_token: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          store_id: string
        }
        Update: {
          created_at?: string
          device_name?: string
          device_token?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
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
      stores: {
        Row: {
          activation_key: string
          active: boolean
          app_version: string
          business_type_id: string | null
          code: string
          created_at: string
          device_count: number
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
      check_store: {
        Args: { _code: string }
        Returns: {
          active: boolean
          mode: string
        }[]
      }
      developer_exists: { Args: never; Returns: boolean }
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
          device_name: string
          id: string
          is_active: boolean
          last_seen_at: string
          max_devices: number
        }[]
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
