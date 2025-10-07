export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          admin_username: string
          created_at: string
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          admin_id: string
          admin_username: string
          created_at?: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          admin_username?: string
          created_at?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          description_key: string
          id: string
          image_url: string
          name_key: string
          price: number
        }
        Insert: {
          created_at?: string
          description_key: string
          id?: string
          image_url: string
          name_key: string
          price: number
        }
        Update: {
          created_at?: string
          description_key?: string
          id?: string
          image_url?: string
          name_key?: string
          price?: number
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          created_at: string
          id: string
          quiz_id: string
          text_key: string
          time_limit: number
        }
        Insert: {
          created_at?: string
          id: string
          quiz_id: string
          text_key: string
          time_limit: number
        }
        Update: {
          created_at?: string
          id?: string
          quiz_id?: string
          text_key?: string
          time_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          }
        ]
      }
      quizzes: {
        Row: {
          allowed_take_roles: string[] | null
          banner_url: string | null
          created_at: string
          description_key: string
          id: string
          is_open: boolean
          last_opened_at: string | null
          logo_url: string | null
          title_key: string
        }
        Insert: {
          allowed_take_roles?: string[] | null
          banner_url?: string | null
          created_at?: string
          description_key: string
          id?: string
          is_open?: boolean
          last_opened_at?: string | null
          logo_url?: string | null
          title_key: string
        }
        Update: {
          allowed_take_roles?: string[] | null
          banner_url?: string | null
          created_at?: string
          description_key?: string
          id?: string
          is_open?: boolean
          last_opened_at?: string | null
          logo_url?: string | null
          title_key?: string
        }
        Relationships: []
      }
      rules: {
        Row: {
          content: Json
          created_at: string
          id: number
        }
        Insert: {
          content: Json
          created_at?: string
          id?: number
        }
        Update: {
          content?: Json
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      submission_answers: {
        Row: {
          answer: string
          created_at: string
          id: string
          question_id: string
          question_text: string
          submission_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question_id: string
          question_text: string
          submission_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question_id?: string
          question_text?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_answers_submission_id_fkey"
            columns: ["submission_id"]
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          }
        ]
      }
      submissions: {
        Row: {
          admin_id: string | null
          admin_username: string | null
          cheat_attempts: Json | null
          created_at: string
          id: string
          quiz_id: string
          quiz_title: string
          status: string
          user_id: string
          username: string
        }
        Insert: {
          admin_id?: string | null
          admin_username?: string | null
          cheat_attempts?: Json | null
          created_at?: string
          id?: string
          quiz_id: string
          quiz_title: string
          status?: string
          user_id: string
          username: string
        }
        Update: {
          admin_id?: string | null
          admin_username?: string | null
          cheat_attempts?: Json | null
          created_at?: string
          id?: string
          quiz_id?: string
          quiz_title?: string
          status?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
