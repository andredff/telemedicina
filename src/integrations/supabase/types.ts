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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cart_items: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          prescription_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          prescription_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          prescription_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dependents: {
        Row: {
          birth_date: string
          cpf: string
          created_at: string
          full_name: string
          id: string
          relationship: string | null
          subscription_id: string
        }
        Insert: {
          birth_date: string
          cpf: string
          created_at?: string
          full_name: string
          id?: string
          relationship?: string | null
          subscription_id: string
        }
        Update: {
          birth_date?: string
          cpf?: string
          created_at?: string
          full_name?: string
          id?: string
          relationship?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependents_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          is_premium: boolean
          commission_rate: number
          monthly_fee: number
          phone: string | null
          email: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          is_premium?: boolean
          commission_rate?: number
          monthly_fee?: number
          phone?: string | null
          email?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          is_premium?: boolean
          commission_rate?: number
          monthly_fee?: number
          phone?: string | null
          email?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      pharmacy_prices: {
        Row: {
          id: string
          pharmacy_id: string
          medication_name: string
          price: number
          delivery_days: number
          in_stock: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pharmacy_id: string
          medication_name: string
          price: number
          delivery_days?: number
          in_stock?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pharmacy_id?: string
          medication_name?: string
          price?: number
          delivery_days?: number
          in_stock?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_prices_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_service_orders: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          id: string
          items: Json | null
          order_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          id?: string
          items?: Json | null
          order_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          id?: string
          items?: Json | null
          order_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "logistics_service_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          dosage: string
          duration: string
          frequency: string
          id: string
          image_url: string | null
          in_stock: boolean
          name: string
          prescription_id: string
          price: number
        }
        Insert: {
          created_at?: string
          dosage: string
          duration: string
          frequency: string
          id: string
          image_url?: string | null
          in_stock?: boolean
          name: string
          prescription_id: string
          price: number
        }
        Update: {
          created_at?: string
          dosage?: string
          duration?: string
          frequency?: string
          id?: string
          image_url?: string | null
          in_stock?: boolean
          name?: string
          prescription_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "medications_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          dosage: string | null
          id: string
          medication_id: string | null
          name: string
          order_id: string
          prescription_id: string | null
          price: number
          quantity: number
        }
        Insert: {
          created_at?: string
          dosage?: string | null
          id?: string
          medication_id?: string | null
          name: string
          order_id: string
          prescription_id?: string | null
          price?: number
          quantity?: number
        }
        Update: {
          created_at?: string
          dosage?: string | null
          id?: string
          medication_id?: string | null
          name?: string
          order_id?: string
          prescription_id?: string | null
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notifications: {
        Row: {
          body: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          estimated_delivery: string | null
          id: string
          order_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subject: string | null
          tracking_code: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          estimated_delivery?: string | null
          id?: string
          order_id: string
          sent_at?: string | null
          status: Database["public"]["Enums"]["order_status"]
          subject?: string | null
          tracking_code?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          estimated_delivery?: string | null
          id?: string
          order_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subject?: string | null
          tracking_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          id: string
          payment_id: string | null
          payment_method: string | null
          payment_status: string | null
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_url: string | null
          shipping: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          tracking_code: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          id: string
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_url?: string | null
          shipping?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          tracking_code?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          id?: string
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_url?: string | null
          shipping?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          tracking_code?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string
          date: string
          doctor_crm: string
          doctor_name: string
          id: string
          patient_name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          doctor_crm: string
          doctor_name: string
          id: string
          patient_name: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          doctor_crm?: string
          doctor_name?: string
          id?: string
          patient_name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          date: string
          delivery_address: string
          id: string
          installments: number | null
          items: Json | null
          payment_id: string | null
          payment_method: string | null
          shipping_cost: number
          status: string
          subtotal: number
          total: number
          tracking_code: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          delivery_address: string
          id?: string
          installments?: number | null
          items?: Json | null
          payment_id?: string | null
          payment_method?: string | null
          shipping_cost?: number
          status?: string
          subtotal?: number
          total?: number
          tracking_code?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          delivery_address?: string
          id?: string
          installments?: number | null
          items?: Json | null
          payment_id?: string | null
          payment_method?: string | null
          shipping_cost?: number
          status?: string
          subtotal?: number
          total?: number
          tracking_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notifications: {
        Row: {
          body: string
          created_at: string
          customer_email: string
          customer_name: string
          estimated_delivery: string | null
          id: string
          order_id: string
          sent_at: string | null
          status: string
          subject: string
          tracking_code: string | null
        }
        Insert: {
          body: string
          created_at?: string
          customer_email: string
          customer_name: string
          estimated_delivery?: string | null
          id?: string
          order_id: string
          sent_at?: string | null
          status: string
          subject: string
          tracking_code?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          estimated_delivery?: string | null
          id?: string
          order_id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          tracking_code?: string | null
        }
        Relationships: []
      }
      logistics_service_orders: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          id: string
          items: Json | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          id?: string
          items?: Json | null
          order_id: string
          status?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          id?: string
          items?: Json | null
          order_id?: string
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          city: string | null
          complement: string | null
          created_at: string
          email: string
          email_telemedicina: string | null
          full_name: string
          id: string
          neighborhood: string | null
          number: string | null
          role: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          email: string
          email_telemedicina?: string | null
          full_name: string
          id: string
          neighborhood?: string | null
          number?: string | null
          role?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          email?: string
          email_telemedicina?: string | null
          full_name?: string
          id?: string
          neighborhood?: string | null
          number?: string | null
          role?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          includes_checkup: boolean | null
          is_active: boolean | null
          max_dependents: number | null
          name: string
          price_monthly: number
          price_yearly: number | null
          specialist_consultations_per_year: number | null
          type: Database["public"]["Enums"]["subscription_plan_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          includes_checkup?: boolean | null
          is_active?: boolean | null
          max_dependents?: number | null
          name: string
          price_monthly: number
          price_yearly?: number | null
          specialist_consultations_per_year?: number | null
          type: Database["public"]["Enums"]["subscription_plan_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          includes_checkup?: boolean | null
          is_active?: boolean | null
          max_dependents?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          specialist_consultations_per_year?: number | null
          type?: Database["public"]["Enums"]["subscription_plan_type"]
          updated_at?: string
        }
        Relationships: []
      }
      payment_logs: {
        Row: {
          id: string
          order_id: string
          payment_type: string
          payment_id: string | null
          amount: number
          status: string
          cielo_response: Json | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          payment_type: string
          payment_id?: string | null
          amount: number
          status: string
          cielo_response?: Json | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          payment_type?: string
          payment_id?: string | null
          amount?: number
          status?: string
          cielo_response?: Json | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      cielo_webhooks: {
        Row: {
          id: string
          order_id: string | null
          payment_id: string
          recurrent_payment_id: string | null
          old_status: string | null
          new_status: string | null
          status: number | null
          return_code: string | null
          return_message: string | null
          raw_payload: Json
          processed: boolean
          processed_at: string | null
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id?: string | null
          payment_id: string
          recurrent_payment_id?: string | null
          old_status?: string | null
          new_status?: string | null
          status?: number | null
          return_code?: string | null
          return_message?: string | null
          raw_payload: Json
          processed?: boolean
          processed_at?: string | null
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string | null
          payment_id?: string
          recurrent_payment_id?: string | null
          old_status?: string | null
          new_status?: string | null
          status?: number | null
          return_code?: string | null
          return_message?: string | null
          raw_payload?: Json
          processed?: boolean
          processed_at?: string | null
          error?: string | null
          created_at?: string
        }
        Relationships: []
      }
      saved_cards: {
        Row: {
          id: string
          user_id: string
          card_token: string
          card_brand: string | null
          card_last_four: string
          card_holder_name: string | null
          card_expiration_date: string | null
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          card_token: string
          card_brand?: string | null
          card_last_four: string
          card_holder_name?: string | null
          card_expiration_date?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          card_token?: string
          card_brand?: string | null
          card_last_four?: string
          card_holder_name?: string | null
          card_expiration_date?: string | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          order_id: string | null
          plan_id: string | null
          recurrent_payment_id: string
          payment_id: string | null
          status: string
          interval: string
          amount: number
          current_period_start: string | null
          current_period_end: string | null
          next_payment_date: string | null
          cancelled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          order_id?: string | null
          plan_id?: string | null
          recurrent_payment_id: string
          payment_id?: string | null
          status?: string
          interval: string
          amount: number
          current_period_start?: string | null
          current_period_end?: string | null
          next_payment_date?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          order_id?: string | null
          plan_id?: string | null
          recurrent_payment_id?: string
          payment_id?: string | null
          status?: string
          interval?: string
          amount?: number
          current_period_start?: string | null
          current_period_end?: string | null
          next_payment_date?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_credits: {
        Row: {
          id: string
          user_id: string
          type: string
          amount: number
          payment_id: string | null
          status: string
          consultation_id: number | null
          created_at: string
          used_at: string | null
          expires_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          amount: number
          payment_id?: string | null
          status?: string
          consultation_id?: number | null
          created_at?: string
          used_at?: string | null
          expires_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          amount?: number
          payment_id?: string | null
          status?: string
          consultation_id?: number | null
          created_at?: string
          used_at?: string | null
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_reminders: {
        Row: {
          id: string
          consultation_id: string
          user_id: string | null
          user_email: string
          user_name: string
          especialidade: string | null
          profissional: string | null
          scheduled_at: string
          reminder_sent: boolean
          reminded_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          consultation_id: string
          user_id?: string | null
          user_email: string
          user_name: string
          especialidade?: string | null
          profissional?: string | null
          scheduled_at: string
          reminder_sent?: boolean
          reminded_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          consultation_id?: string
          user_id?: string | null
          user_email?: string
          user_name?: string
          especialidade?: string | null
          profissional?: string | null
          scheduled_at?: string
          reminder_sent?: boolean
          reminded_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events_log: {
        Row: {
          id: string
          event_type: string
          recipient: string
          job_id: string | null
          payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          recipient: string
          job_id?: string | null
          payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          recipient?: string
          job_id?: string | null
          payload?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          billing_cycle: string | null
          cancelled_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          payment_id: string | null
          plan_id: string
          specialist_consultations_used: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string | null
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          plan_id: string
          specialist_consultations_used?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string | null
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          plan_id?: string
          specialist_consultations_used?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      order_status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
      subscription_plan_type:
        | "bronze"
        | "prata"
        | "ouro"
        | "platina"
        | "diamante"
        | "coletivo"
        | "bronze-coletivo"
        | "prata-coletivo"
        | "ouro-coletivo"
        | "platina-coletivo"
        | "diamante-coletivo"
      subscription_status: "active" | "inactive" | "cancelled" | "pending"
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
      order_status: ["pending", "processing", "shipped", "delivered", "cancelled"],
      subscription_plan_type: [
        "bronze",
        "prata",
        "ouro",
        "platina",
        "coletivo",
      ],
      subscription_status: ["active", "inactive", "cancelled", "pending"],
    },
  },
} as const
