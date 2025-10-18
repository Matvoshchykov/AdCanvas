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
      pixels: {
        Row: {
          id: string
          x: number
          y: number
          color: string
          link: string | null
          owner_id: string
          owner_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          x: number
          y: number
          color: string
          link?: string | null
          owner_id: string
          owner_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          x?: number
          y?: number
          color?: string
          link?: string | null
          owner_id?: string
          owner_name?: string | null
          created_at?: string
        }
      }
      user_cooldowns: {
        Row: {
          user_id: string
          last_placement: string
          created_at: string
        }
        Insert: {
          user_id: string
          last_placement?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          last_placement?: string
          created_at?: string
        }
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
  }
}

