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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      character_slice_write_receipts: {
        Row: {
          created_at: string
          request: Json
          request_id: string
          result: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          request: Json
          request_id: string
          result: Json
          user_id: string
        }
        Update: {
          created_at?: string
          request?: Json
          request_id?: string
          result?: Json
          user_id?: string
        }
        Relationships: []
      }
      combat_action_requests: {
        Row: {
          actor_character_id: string
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          expires_at: string
          id: string
          intent: Json
          lease_expires_at: string | null
          request_id: string
          result: Json | null
          status: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          actor_character_id: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          intent: Json
          lease_expires_at?: string | null
          request_id: string
          result?: Json | null
          status?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          actor_character_id?: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          intent?: Json
          lease_expires_at?: string | null
          request_id?: string
          result?: Json | null
          status?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: []
      }
      combat_character_owners: {
        Row: {
          assigned_at: string
          assigned_by: string
          character_id: string
          owner_user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          character_id: string
          owner_user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          character_id?: string
          owner_user_id?: string
        }
        Relationships: []
      }
      invocation_approval_requests: {
        Row: {
          approved_version: number | null
          invocation_id: string
          owner_character_id: string
          reason: string | null
          request_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          snapshot: Json
          status: string
          submission_origin: string
          submitted_at: string
          submitted_by: string
          version_submitted: number
        }
        Insert: {
          approved_version?: number | null
          invocation_id: string
          owner_character_id: string
          reason?: string | null
          request_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          snapshot: Json
          status: string
          submission_origin?: string
          submitted_at?: string
          submitted_by: string
          version_submitted: number
        }
        Update: {
          approved_version?: number | null
          invocation_id?: string
          owner_character_id?: string
          reason?: string | null
          request_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          snapshot?: Json
          status?: string
          submission_origin?: string
          submitted_at?: string
          submitted_by?: string
          version_submitted?: number
        }
        Relationships: []
      }
      map_scene_write_receipts: {
        Row: {
          created_at: string
          request: Json
          request_id: string
          result: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          request: Json
          request_id: string
          result: Json
          user_id: string
        }
        Update: {
          created_at?: string
          request?: Json
          request_id?: string
          result?: Json
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          id: string
          nick: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          id: string
          nick: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          id?: string
          nick?: string
        }
        Relationships: []
      }
      realtime_assets: {
        Row: {
          created_at: string
          data_base64: string
          id: string
          mime: string
        }
        Insert: {
          created_at?: string
          data_base64: string
          id: string
          mime?: string
        }
        Update: {
          created_at?: string
          data_base64?: string
          id?: string
          mime?: string
        }
        Relationships: []
      }
      realtime_world: {
        Row: {
          data: Json
          revision: number
          slice: string
          updated_at: string
        }
        Insert: {
          data?: Json
          revision?: number
          slice: string
          updated_at?: string
        }
        Update: {
          data?: Json
          revision?: number
          slice?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      character_invocation_catalog_is_authorized: {
        Args: {
          p_character_id: string
          p_current_character: Json
          p_proposed_character: Json
        }
        Returns: boolean
      }
      claim_first_master: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_masters: { Args: never; Returns: string[] }
      nick_em_uso: { Args: { _nick: string }; Returns: boolean }
      set_master: {
        Args: { _make: boolean; _target: string }
        Returns: undefined
      }
      write_owned_characters_slice: {
        Args: {
          p_characters: Json
          p_expected_revision: number
          p_request_id: string
        }
        Returns: Json
      }
      write_owned_map_scene: {
        Args: {
          p_expected_revision: number
          p_map_scene: Json
          p_request_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "master" | "player"
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
      app_role: ["master", "player"],
    },
  },
} as const
