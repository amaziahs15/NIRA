export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          language: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name?: string
          language?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          language?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: "victim" | "professional" | "admin"
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: "victim" | "professional" | "admin"
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: "victim" | "professional" | "admin"
          created_at?: string
        }
        Relationships: []
      }
      victims: {
        Row: {
          id: string
          profile_id: string
          case_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          case_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          case_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      cases: {
        Row: {
          id: string
          victim_id: string | null
          case_number: string
          stage: string
          status_text: string
          assigned_professional: string | null
          district: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          victim_id?: string | null
          case_number: string
          stage?: string
          status_text?: string
          assigned_professional?: string | null
          district?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          victim_id?: string | null
          case_number?: string
          stage?: string
          status_text?: string
          assigned_professional?: string | null
          district?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      case_events: {
        Row: {
          id: string
          case_id: string
          event_type: string
          description: string
          occurred_at: string
        }
        Insert: {
          id?: string
          case_id: string
          event_type?: string
          description: string
          occurred_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          event_type?: string
          description?: string
          occurred_at?: string
        }
        Relationships: []
      }
      checkins: {
        Row: {
          id: string
          victim_id: string
          mood_label: string
          message_text: string | null
          voice_url: string | null
          channel: string
          response_latency_seconds: number
          created_at: string
        }
        Insert: {
          id?: string
          victim_id: string
          mood_label: string
          message_text?: string | null
          voice_url?: string | null
          channel?: string
          response_latency_seconds?: number
          created_at?: string
        }
        Update: {
          id?: string
          victim_id?: string
          mood_label?: string
          message_text?: string | null
          voice_url?: string | null
          channel?: string
          response_latency_seconds?: number
          created_at?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          id: string
          victim_id: string
          checkin_id: string | null
          composite_score: number
          sentiment_component: number
          emotion_component: number
          behaviour_component: number
          crisis_flag: boolean
          signal_quality: Json
          trend: string
          created_at: string
        }
        Insert: {
          id?: string
          victim_id: string
          checkin_id?: string | null
          composite_score?: number
          sentiment_component?: number
          emotion_component?: number
          behaviour_component?: number
          crisis_flag?: boolean
          signal_quality?: Json
          trend?: string
          created_at?: string
        }
        Update: {
          id?: string
          victim_id?: string
          checkin_id?: string | null
          composite_score?: number
          sentiment_component?: number
          emotion_component?: number
          behaviour_component?: number
          crisis_flag?: boolean
          signal_quality?: Json
          trend?: string
          created_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          id: string
          victim_id: string
          score_id: string | null
          severity: "routine" | "attention" | "priority"
          status: "open" | "reviewed" | "resolved"
          created_at: string
        }
        Insert: {
          id?: string
          victim_id: string
          score_id?: string | null
          severity: "routine" | "attention" | "priority"
          status?: "open" | "reviewed" | "resolved"
          created_at?: string
        }
        Update: {
          id?: string
          victim_id?: string
          score_id?: string | null
          severity?: "routine" | "attention" | "priority"
          status?: "open" | "reviewed" | "resolved"
          created_at?: string
        }
        Relationships: []
      }
      interventions: {
        Row: {
          id: string
          victim_id: string
          type: string
          status: "Recommended" | "Reviewed" | "Assigned" | "In Progress" | "Outcome Recorded"
          assigned_professional: string | null
          follow_up_date: string | null
          outcome_text: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          victim_id: string
          type?: string
          status?: "Recommended" | "Reviewed" | "Assigned" | "In Progress" | "Outcome Recorded"
          assigned_professional?: string | null
          follow_up_date?: string | null
          outcome_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          victim_id?: string
          type?: string
          status?: "Recommended" | "Reviewed" | "Assigned" | "In Progress" | "Outcome Recorded"
          assigned_professional?: string | null
          follow_up_date?: string | null
          outcome_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sos_requests: {
        Row: {
          id: string
          victim_id: string
          request_code: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          victim_id: string
          request_code?: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          victim_id?: string
          request_code?: string
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      micro_assessments: {
        Row: {
          id: string
          victim_id: string
          responses: Json
          created_at: string
        }
        Insert: {
          id?: string
          victim_id: string
          responses: Json
          created_at?: string
        }
        Update: {
          id?: string
          victim_id?: string
          responses?: Json
          created_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          case_id: string | null
          actor_id: string | null
          actor_name: string
          actor_role: string
          action: string
          details: string | null
          occurred_at: string
        }
        Insert: {
          id?: string
          case_id?: string | null
          actor_id?: string | null
          actor_name?: string
          actor_role?: string
          action: string
          details?: string | null
          occurred_at?: string
        }
        Update: {
          id?: string
          case_id?: string | null
          actor_id?: string | null
          actor_name?: string
          actor_role?: string
          action?: string
          details?: string | null
          occurred_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_aggregate_metrics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      complete_user_setup: {
        Args: {
          user_role?: string
          user_name?: string
          user_lang?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = Database["public"]

export type Tables<
  TableName extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][TableName]["Row"]

export type TablesInsert<
  TableName extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][TableName]["Insert"]

export type TablesUpdate<
  TableName extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][TableName]["Update"]
