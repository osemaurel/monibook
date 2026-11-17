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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          content: Json | null
          created_at: string
          id: string
          job_id: string | null
          kind: Database["public"]["Enums"]["asset_kind"]
          mime_type: string | null
          project_id: string
          size_bytes: number | null
          storage_path: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          id?: string
          job_id?: string | null
          kind: Database["public"]["Enums"]["asset_kind"]
          mime_type?: string | null
          project_id: string
          size_bytes?: number | null
          storage_path?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          id?: string
          job_id?: string | null
          kind?: Database["public"]["Enums"]["asset_kind"]
          mime_type?: string | null
          project_id?: string
          size_bytes?: number | null
          storage_path?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_job_id_project_id_fkey"
            columns: ["job_id", "project_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "assets_project_id_user_id_fkey"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "project_overview"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "assets_project_id_user_id_fkey"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          details: Json
          entity_id: string | null
          entity_type: string
          id: number
          occurred_at: string
          user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: never
          occurred_at?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: never
          occurred_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      copy_texts: {
        Row: {
          angle: Database["public"]["Enums"]["copy_angle"] | null
          content: string
          created_at: string
          id: string
          job_id: string | null
          project_id: string
          title: string
          type: Database["public"]["Enums"]["copy_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          angle?: Database["public"]["Enums"]["copy_angle"] | null
          content: string
          created_at?: string
          id?: string
          job_id?: string | null
          project_id: string
          title: string
          type: Database["public"]["Enums"]["copy_type"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          angle?: Database["public"]["Enums"]["copy_angle"] | null
          content?: string
          created_at?: string
          id?: string
          job_id?: string | null
          project_id?: string
          title?: string
          type?: Database["public"]["Enums"]["copy_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          id: number
          job_id: string | null
          kind: Database["public"]["Enums"]["credit_transaction_kind"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: never
          job_id?: string | null
          kind: Database["public"]["Enums"]["credit_transaction_kind"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: never
          job_id?: string | null
          kind?: Database["public"]["Enums"]["credit_transaction_kind"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "credit_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ebook_chapters: {
        Row: {
          brief: string | null
          content: string | null
          created_at: string
          ebook_id: string
          id: string
          position: number
          status: Database["public"]["Enums"]["ebook_chapter_status"]
          summary: string | null
          title: string
          updated_at: string
          user_id: string
          word_count: number
        }
        Insert: {
          brief?: string | null
          content?: string | null
          ebook_id: string
          position: number
          title: string
        }
        Update: {
          brief?: string | null
          content?: string | null
          position?: number
          title?: string
        }
        Relationships: []
      }
      ebooks: {
        Row: {
          author_name: string | null
          bible: Json | null
          coherence_notes: string | null
          cover_path: string | null
          created_at: string
          export_template: string
          id: string
          instructions: string | null
          length: Database["public"]["Enums"]["ebook_length"] | null
          project_id: string
          step: number
          subject: string | null
          subtitle: string | null
          summary: string | null
          template: Database["public"]["Enums"]["ebook_template"] | null
          title: string | null
          title_proposals: Json
          tone: string | null
          updated_at: string
          user_id: string
          written_at: string | null
        }
        Insert: {
          project_id: string
          step?: number
          subject?: string | null
          template?: Database["public"]["Enums"]["ebook_template"] | null
        }
        Update: {
          author_name?: string | null
          cover_path?: string | null
          export_template?: string
          instructions?: string | null
          length?: Database["public"]["Enums"]["ebook_length"] | null
          step?: number
          subject?: string | null
          subtitle?: string | null
          summary?: string | null
          template?: Database["public"]["Enums"]["ebook_template"] | null
          title?: string | null
          tone?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          attempts: number
          continuation: boolean
          created_at: string
          credits_reserved: number
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          input: Json
          kind: string
          max_attempts: number
          output: Json | null
          progress: number
          project_id: string
          run_after: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          step: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          continuation?: boolean
          created_at?: string
          credits_reserved: number
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          input?: Json
          kind: string
          max_attempts?: number
          output?: Json | null
          progress?: number
          project_id: string
          run_after?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          step?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          continuation?: boolean
          created_at?: string
          credits_reserved?: number
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          input?: Json
          kind?: string
          max_attempts?: number
          output?: Json | null
          progress?: number
          project_id?: string
          run_after?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          step?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_project_id_user_id_fkey"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "project_overview"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "jobs_project_id_user_id_fkey"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          has_access: boolean
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          has_access?: boolean
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          has_access?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          angle: string | null
          audience: string | null
          benefits: string[]
          call_to_action: string | null
          cover_path: string | null
          created_at: string
          deleted_at: string | null
          guarantee: string | null
          id: string
          language: string
          name: string
          niche: string | null
          planned_price_fcfa: number | null
          promise: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          angle?: string | null
          audience?: string | null
          benefits?: string[]
          call_to_action?: string | null
          cover_path?: string | null
          created_at?: string
          deleted_at?: string | null
          guarantee?: string | null
          id?: string
          language?: string
          name: string
          niche?: string | null
          planned_price_fcfa?: number | null
          promise?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          angle?: string | null
          audience?: string | null
          benefits?: string[]
          call_to_action?: string | null
          cover_path?: string | null
          created_at?: string
          deleted_at?: string | null
          guarantee?: string | null
          id?: string
          language?: string
          name?: string
          niche?: string | null
          planned_price_fcfa?: number | null
          promise?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "credit_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      credit_balances: {
        Row: {
          available: number | null
          reserved: number | null
          user_id: string | null
        }
        Relationships: []
      }
      credit_history: {
        Row: {
          amount: number | null
          balance_after: number | null
          created_at: string | null
          id: number | null
          job_id: string | null
          job_kind: string | null
          kind: Database["public"]["Enums"]["credit_transaction_kind"] | null
          project_id: string | null
          project_name: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "credit_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_overview: {
        Row: {
          active_jobs: number | null
          angle: string | null
          audience: string | null
          benefits: string[] | null
          call_to_action: string | null
          cover_path: string | null
          created_at: string | null
          done_jobs_by_kind: Json | null
          guarantee: string | null
          id: string | null
          language: string | null
          name: string | null
          niche: string | null
          planned_price_fcfa: number | null
          promise: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "credit_balances"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      claim_jobs: {
        Args: { p_limit: number }
        Returns: Database["public"]["Tables"]["jobs"]["Row"][]
      }
      complete_job: {
        Args: {
          p_assets?: Json
          p_attempt: number
          p_job_id: string
          p_output: Json
        }
        Returns: Database["public"]["Tables"]["jobs"]["Row"]
      }
      create_job: {
        Args: {
          p_input?: Json
          p_kind: string
          p_project_id: string
          p_user_id: string
        }
        Returns: Database["public"]["Tables"]["jobs"]["Row"]
      }
      fail_job: {
        Args: {
          p_attempt: number
          p_error_code: string
          p_error_message: string
          p_job_id: string
          p_retryable: boolean
        }
        Returns: Database["public"]["Tables"]["jobs"]["Row"]
      }
      grant_credits: {
        Args: {
          p_actor_id?: string
          p_amount: number
          p_reason: string
          p_user_id: string
        }
        Returns: number
      }
      has_access: { Args: never; Returns: boolean }
      kick_job_runner: { Args: never; Returns: undefined }
      reorder_ebook_chapters: {
        Args: { p_chapter_ids: string[]; p_ebook_id: string }
        Returns: undefined
      }
      recover_stale_jobs: {
        Args: { p_error_code: string; p_error_message: string }
        Returns: number
      }
      set_job_progress: {
        Args: {
          p_attempt: number
          p_job_id: string
          p_progress: number
          p_step: string
        }
        Returns: undefined
      }
      verify_job_runner_secret: { Args: { p_secret: string }; Returns: boolean }
    }
    Enums: {
      asset_kind: "document" | "image" | "video" | "audio" | "text"
      copy_angle: "emotional" | "numbers" | "testimonial" | "urgency"
      copy_type:
        | "hooks"
        | "facebook_short"
        | "facebook_long"
        | "sales_page"
        | "email_sequence"
        | "product_description"
        | "social_captions"
        | "free"
      credit_transaction_kind: "grant" | "reservation" | "release" | "debit"
      ebook_chapter_status: "pending" | "writing" | "written"
      ebook_length: "short" | "standard" | "complete"
      ebook_template: "method_guide" | "step_by_step" | "recipes" | "business_money" | "free"
      job_status: "queued" | "running" | "done" | "failed"
      project_status: "draft" | "in_progress" | "launched" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
