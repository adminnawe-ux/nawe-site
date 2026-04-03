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
      articles: {
        Row: {
          author_id: string
          category: string
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      commission_tiers: {
        Row: {
          commission_rate: number
          created_at: string
          currency: string
          id: string
          max_revenue: number | null
          min_revenue: number
          updated_at: string
        }
        Insert: {
          commission_rate: number
          created_at?: string
          currency?: string
          id?: string
          max_revenue?: number | null
          min_revenue?: number
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          currency?: string
          id?: string
          max_revenue?: number | null
          min_revenue?: number
          updated_at?: string
        }
        Relationships: []
      }
      intake_responses: {
        Row: {
          additional_notes: string | null
          age_range: string | null
          budget_range: string | null
          completed: boolean | null
          created_at: string
          crisis_flag: boolean | null
          cultural_background: string | null
          cultural_background_important: boolean | null
          experience_level_preference: string | null
          frequency_preference: string | null
          gender_identity: string | null
          id: string
          insurance_coverage: string | null
          language_preference: string | null
          presenting_concerns: string[] | null
          previous_therapy: boolean | null
          session_format_preference: string[] | null
          session_time_preference: string | null
          sliding_scale_needed: boolean | null
          specialisation_importance: number | null
          therapist_gender_preference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          age_range?: string | null
          budget_range?: string | null
          completed?: boolean | null
          created_at?: string
          crisis_flag?: boolean | null
          cultural_background?: string | null
          cultural_background_important?: boolean | null
          experience_level_preference?: string | null
          frequency_preference?: string | null
          gender_identity?: string | null
          id?: string
          insurance_coverage?: string | null
          language_preference?: string | null
          presenting_concerns?: string[] | null
          previous_therapy?: boolean | null
          session_format_preference?: string[] | null
          session_time_preference?: string | null
          sliding_scale_needed?: boolean | null
          specialisation_importance?: number | null
          therapist_gender_preference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          age_range?: string | null
          budget_range?: string | null
          completed?: boolean | null
          created_at?: string
          crisis_flag?: boolean | null
          cultural_background?: string | null
          cultural_background_important?: boolean | null
          experience_level_preference?: string | null
          frequency_preference?: string | null
          gender_identity?: string | null
          id?: string
          insurance_coverage?: string | null
          language_preference?: string | null
          presenting_concerns?: string[] | null
          previous_therapy?: boolean | null
          session_format_preference?: string[] | null
          session_time_preference?: string | null
          sliding_scale_needed?: boolean | null
          specialisation_importance?: number | null
          therapist_gender_preference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          location: string | null
          phone: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          location?: string | null
          phone?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          location?: string | null
          phone?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          client_id: string
          created_at: string
          id: string
          rating: number
          session_id: string | null
          text: string | null
          therapist_id: string
          verified: boolean | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          rating: number
          session_id?: string | null
          text?: string | null
          therapist_id: string
          verified?: boolean | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          rating?: number
          session_id?: string | null
          text?: string | null
          therapist_id?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          cancellation_reason: string | null
          client_id: string
          created_at: string
          currency: string | null
          duration_minutes: number | null
          id: string
          notes_client: string | null
          price: number | null
          scheduled_at: string
          session_format: string | null
          session_link: string | null
          session_type: string | null
          status: string | null
          therapist_id: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          client_id: string
          created_at?: string
          currency?: string | null
          duration_minutes?: number | null
          id?: string
          notes_client?: string | null
          price?: number | null
          scheduled_at: string
          session_format?: string | null
          session_link?: string | null
          session_type?: string | null
          status?: string | null
          therapist_id: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          client_id?: string
          created_at?: string
          currency?: string | null
          duration_minutes?: number | null
          id?: string
          notes_client?: string | null
          price?: number | null
          scheduled_at?: string
          session_format?: string | null
          session_link?: string | null
          session_type?: string | null
          status?: string | null
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          session_id: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          session_id: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          session_id?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          therapist_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          therapist_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          therapist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_availability_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
        ]
      }
      therapists: {
        Row: {
          bio: string | null
          buffer_minutes: number | null
          cancellation_policy: string | null
          client_populations: string[] | null
          created_at: string
          cultural_competencies: string[] | null
          currency: string | null
          education: string | null
          id: string
          insurance_accepted: string[] | null
          issuing_body: string | null
          languages: string[] | null
          license_number: string | null
          max_sessions_per_day: number | null
          modalities: string[] | null
          photo_url: string | null
          price_per_session: number | null
          professional_title: string | null
          session_formats: string[] | null
          sliding_scale: boolean | null
          sliding_scale_min: number | null
          specialisations: string[] | null
          tagline: string | null
          updated_at: string
          user_id: string
          verification_status: string | null
          verified: boolean | null
          video_url: string | null
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          buffer_minutes?: number | null
          cancellation_policy?: string | null
          client_populations?: string[] | null
          created_at?: string
          cultural_competencies?: string[] | null
          currency?: string | null
          education?: string | null
          id?: string
          insurance_accepted?: string[] | null
          issuing_body?: string | null
          languages?: string[] | null
          license_number?: string | null
          max_sessions_per_day?: number | null
          modalities?: string[] | null
          photo_url?: string | null
          price_per_session?: number | null
          professional_title?: string | null
          session_formats?: string[] | null
          sliding_scale?: boolean | null
          sliding_scale_min?: number | null
          specialisations?: string[] | null
          tagline?: string | null
          updated_at?: string
          user_id: string
          verification_status?: string | null
          verified?: boolean | null
          video_url?: string | null
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          buffer_minutes?: number | null
          cancellation_policy?: string | null
          client_populations?: string[] | null
          created_at?: string
          cultural_competencies?: string[] | null
          currency?: string | null
          education?: string | null
          id?: string
          insurance_accepted?: string[] | null
          issuing_body?: string | null
          languages?: string[] | null
          license_number?: string | null
          max_sessions_per_day?: number | null
          modalities?: string[] | null
          photo_url?: string | null
          price_per_session?: number | null
          professional_title?: string | null
          session_formats?: string[] | null
          sliding_scale?: boolean | null
          sliding_scale_min?: number | null
          specialisations?: string[] | null
          tagline?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: string | null
          verified?: boolean | null
          video_url?: string | null
          years_experience?: number | null
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
      therapist_public_profiles: {
        Row: {
          avatar_url: string | null
          first_name: string | null
          last_name: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "client" | "therapist" | "admin"
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
      app_role: ["client", "therapist", "admin"],
    },
  },
} as const
