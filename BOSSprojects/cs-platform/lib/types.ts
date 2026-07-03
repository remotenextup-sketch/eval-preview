export type UserRole = 'admin' | 'manager' | 'member'
export type InquiryStatus = 'open' | 'pending' | 'resolved' | 'spam'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageSenderType = 'customer' | 'staff' | 'system' | 'ai'
export type SourceChannel = 'email' | 'rakuten' | 'yahoo' | 'line' | 'manual'
export type IdentifierType = 'email' | 'masked_email' | 'order_number' | 'line_user_id' | 'phone' | 'name'

export type ActivityAction =
  | 'assigned' | 'replied' | 'status_changed' | 'snoozed' | 'commented'
  | 'ai_draft_generated' | 'ai_draft_accepted' | 'ai_draft_edited'
  | 'knowledge_applied' | 'manufacturer_contacted'
  | 'locked' | 'unlocked' | 'lock_expired'
  | 'snooze_expired' | 'scheduled_reply'
  | (string & {})

export type AiLogActionType = 'classify' | 'draft' | 'search'
export type AiLogFeedback = 'accepted' | 'edited' | 'rejected'
export type ManufacturerChannel = 'wechat' | 'email' | 'phone' | 'other'
export type ManufacturerContactStatus = 'waiting' | 'replied' | 'closed' | 'escalated'

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
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_val: Json | null
          before_val: Json | null
          created_at: string
          id: string
          inquiry_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_val?: Json | null
          before_val?: Json | null
          created_at?: string
          id?: string
          inquiry_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_val?: Json | null
          before_val?: Json | null
          created_at?: string
          id?: string
          inquiry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_logs: {
        Row: {
          action_type: string
          completion_tokens: number | null
          confidence: number | null
          created_at: string
          feedback: string | null
          feedback_at: string | null
          id: string
          inquiry_id: string | null
          latency_ms: number | null
          model: string
          prompt_tokens: number | null
          result: Json | null
        }
        Insert: {
          action_type: string
          completion_tokens?: number | null
          confidence?: number | null
          created_at?: string
          feedback?: string | null
          feedback_at?: string | null
          id?: string
          inquiry_id?: string | null
          latency_ms?: number | null
          model: string
          prompt_tokens?: number | null
          result?: Json | null
        }
        Update: {
          action_type?: string
          completion_tokens?: number | null
          confidence?: number | null
          created_at?: string
          feedback?: string | null
          feedback_at?: string | null
          id?: string
          inquiry_id?: string | null
          latency_ms?: number | null
          model?: string
          prompt_tokens?: number | null
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_logs_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          inquiry_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          inquiry_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          inquiry_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_val: Json | null
          before_val: Json | null
          created_at: string
          customer_profile_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_val?: Json | null
          before_val?: Json | null
          created_at?: string
          customer_profile_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_val?: Json | null
          before_val?: Json | null
          created_at?: string
          customer_profile_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activity_logs_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_identities: {
        Row: {
          channel: string
          confidence: number
          created_at: string
          customer_profile_id: string
          id: string
          identifier_type: string
          identifier_value: string
          normalized_value: string
          source_inquiry_id: string | null
          verified: boolean
        }
        Insert: {
          channel: string
          confidence?: number
          created_at?: string
          customer_profile_id: string
          id?: string
          identifier_type: string
          identifier_value: string
          normalized_value: string
          source_inquiry_id?: string | null
          verified?: boolean
        }
        Update: {
          channel?: string
          confidence?: number
          created_at?: string
          customer_profile_id?: string
          id?: string
          identifier_type?: string
          identifier_value?: string
          normalized_value?: string
          source_inquiry_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "customer_identities_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_identities_source_inquiry_id_fkey"
            columns: ["source_inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profile_tags: {
        Row: {
          created_at: string
          created_by: string | null
          customer_profile_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_profile_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_profile_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_profile_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_profile_tags_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_profile_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tag_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string | null
          display_name: string | null
          id: string
          inquiry_count: number
          last_order_at: string | null
          memo: string | null
          order_count: number
          phone: string | null
          primary_email: string | null
          return_count: number
          risk_score: number
          total_purchase_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          display_name?: string | null
          id?: string
          inquiry_count?: number
          last_order_at?: string | null
          memo?: string | null
          order_count?: number
          phone?: string | null
          primary_email?: string | null
          return_count?: number
          risk_score?: number
          total_purchase_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          display_name?: string | null
          id?: string
          inquiry_count?: number
          last_order_at?: string | null
          memo?: string | null
          order_count?: number
          phone?: string | null
          primary_email?: string | null
          return_count?: number
          risk_score?: number
          total_purchase_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_tag_definitions: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      feedback_items: {
        Row: {
          assignee: string | null
          category: string
          content: string
          created_at: string
          created_by: string
          display_order: number
          id: string
          priority: string
          resolved_at: string | null
          status: string
          target_page: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          category?: string
          content: string
          created_at?: string
          created_by: string
          display_order?: number
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          target_page?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          category?: string
          content?: string
          created_at?: string
          created_by?: string
          display_order?: number
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          target_page?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedback_votes: {
        Row: {
          created_at: string
          feedback_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_votes_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          ai_action: string | null
          ai_confidence: number | null
          ai_intent: string | null
          assignee_id: string | null
          created_at: string
          customer_name: string | null
          customer_profile_id: string | null
          external_customer_key: string | null
          external_id: string | null
          first_reply_at: string | null
          id: string
          inquiry_number: string | null
          is_angry: boolean
          item_name: string | null
          locked_at: string | null
          locked_by: string | null
          mall_id: string
          needs_human: boolean
          order_number: string | null
          raw_payload: Json | null
          received_at: string
          resolved_at: string | null
          scheduled_reply_at: string | null
          scheduled_reply_body: string | null
          snooze_until: string | null
          source_channel: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          ai_action?: string | null
          ai_confidence?: number | null
          ai_intent?: string | null
          assignee_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_profile_id?: string | null
          external_customer_key?: string | null
          external_id?: string | null
          first_reply_at?: string | null
          id?: string
          inquiry_number?: string | null
          is_angry?: boolean
          item_name?: string | null
          locked_at?: string | null
          locked_by?: string | null
          mall_id: string
          needs_human?: boolean
          order_number?: string | null
          raw_payload?: Json | null
          received_at?: string
          resolved_at?: string | null
          scheduled_reply_at?: string | null
          scheduled_reply_body?: string | null
          snooze_until?: string | null
          source_channel?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          ai_action?: string | null
          ai_confidence?: number | null
          ai_intent?: string | null
          assignee_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_profile_id?: string | null
          external_customer_key?: string | null
          external_id?: string | null
          first_reply_at?: string | null
          id?: string
          inquiry_number?: string | null
          is_angry?: boolean
          item_name?: string | null
          locked_at?: string | null
          locked_by?: string | null
          mall_id?: string
          needs_human?: boolean
          order_number?: string | null
          raw_payload?: Json | null
          received_at?: string
          resolved_at?: string | null
          scheduled_reply_at?: string | null
          scheduled_reply_body?: string | null
          snooze_until?: string | null
          source_channel?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_mall_id_fkey"
            columns: ["mall_id"]
            isOneToOne: false
            referencedRelation: "malls"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_messages: {
        Row: {
          ai_modified: boolean
          body: string
          created_at: string
          direction: string
          external_message_id: string | null
          id: string
          inquiry_id: string
          is_ai_draft: boolean
          sender_id: string | null
          sender_type: string
          sent_at: string
        }
        Insert: {
          ai_modified?: boolean
          body: string
          created_at?: string
          direction: string
          external_message_id?: string | null
          id?: string
          inquiry_id: string
          is_ai_draft?: boolean
          sender_id?: string | null
          sender_type: string
          sent_at?: string
        }
        Update: {
          ai_modified?: boolean
          body?: string
          created_at?: string
          direction?: string
          external_message_id?: string | null
          id?: string
          inquiry_id?: string
          is_ai_draft?: boolean
          sender_id?: string | null
          sender_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_messages_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_tags: {
        Row: {
          created_at: string
          inquiry_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          inquiry_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          inquiry_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_tags_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge: {
        Row: {
          answer_template: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          intent: string | null
          is_active: boolean
          last_used_at: string | null
          mall_code: string | null
          quality_score: number
          question_pattern: string | null
          success_count: number
          title: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          answer_template: string
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          intent?: string | null
          is_active?: boolean
          last_used_at?: string | null
          mall_code?: string | null
          quality_score?: number
          question_pattern?: string | null
          success_count?: number
          title: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          answer_template?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          intent?: string | null
          is_active?: boolean
          last_used_at?: string | null
          mall_code?: string | null
          quality_score?: number
          question_pattern?: string | null
          success_count?: number
          title?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_cases: {
        Row: {
          answer: string | null
          confidence: number | null
          created_at: string | null
          id: number
          image_ref: string | null
          needs_sync: boolean | null
          product_name: string | null
          question: string | null
          reply_body: string | null
          source: string | null
          status: string | null
          success_count: number | null
          updated_at: string | null
        }
        Insert: {
          answer?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: number
          image_ref?: string | null
          needs_sync?: boolean | null
          product_name?: string | null
          question?: string | null
          reply_body?: string | null
          source?: string | null
          status?: string | null
          success_count?: number | null
          updated_at?: string | null
        }
        Update: {
          answer?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: number
          image_ref?: string | null
          needs_sync?: boolean | null
          product_name?: string | null
          question?: string | null
          reply_body?: string | null
          source?: string | null
          status?: string | null
          success_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      knowledge_templates: {
        Row: {
          body: string | null
          category: string | null
          created_at: string | null
          id: number
          no: string | null
          phrase: string | null
          source: string | null
          synonyms: string | null
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          category?: string | null
          created_at?: string | null
          id?: number
          no?: string | null
          phrase?: string | null
          source?: string | null
          synonyms?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          category?: string | null
          created_at?: string | null
          id?: number
          no?: string | null
          phrase?: string | null
          source?: string | null
          synonyms?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      malls: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      manufacturer_contacts: {
        Row: {
          body: string
          channel: string
          contacted_at: string
          contacted_by: string | null
          created_at: string
          direction: string
          id: string
          inquiry_id: string
          status: string
        }
        Insert: {
          body: string
          channel: string
          contacted_at?: string
          contacted_by?: string | null
          created_at?: string
          direction: string
          id?: string
          inquiry_id: string
          status?: string
        }
        Update: {
          body?: string
          channel?: string
          contacted_at?: string
          contacted_by?: string | null
          created_at?: string
          direction?: string
          id?: string
          inquiry_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "manufacturer_contacts_contacted_by_fkey"
            columns: ["contacted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturer_contacts_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          external_item_id: string | null
          id: string
          item_name: string | null
          order_id: string
          quantity: number
          raw_payload: Json | null
          sku: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          external_item_id?: string | null
          id?: string
          item_name?: string | null
          order_id: string
          quantity?: number
          raw_payload?: Json | null
          sku?: string | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          external_item_id?: string | null
          id?: string
          item_name?: string | null
          order_id?: string
          quantity?: number
          raw_payload?: Json | null
          sku?: string | null
          unit_price?: number | null
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
      orders: {
        Row: {
          buyer_address: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_postal_code: string | null
          carrier: string | null
          created_at: string
          currency: string
          customer_profile_id: string | null
          delivery_date: string | null
          external_order_id: string
          id: string
          mall_id: string | null
          order_number: string | null
          ordered_at: string
          raw_payload: Json | null
          shipment_status: string | null
          source_channel: string
          status: string
          total_amount: number | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          buyer_address?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_postal_code?: string | null
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_profile_id?: string | null
          delivery_date?: string | null
          external_order_id: string
          id?: string
          mall_id?: string | null
          order_number?: string | null
          ordered_at: string
          raw_payload?: Json | null
          shipment_status?: string | null
          source_channel: string
          status?: string
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          buyer_address?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_postal_code?: string | null
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_profile_id?: string | null
          delivery_date?: string | null
          external_order_id?: string
          id?: string
          mall_id?: string | null
          order_number?: string | null
          ordered_at?: string
          raw_payload?: Json | null
          shipment_status?: string | null
          source_channel?: string
          status?: string
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_profile_id_fkey"
            columns: ["customer_profile_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_mall_id_fkey"
            columns: ["mall_id"]
            isOneToOne: false
            referencedRelation: "malls"
            referencedColumns: ["id"]
          },
        ]
      }
      snooze_schedules: {
        Row: {
          created_at: string
          id: string
          inquiry_id: string
          is_processed: boolean
          processed_at: string | null
          reason: string | null
          snooze_until: string
          snoozed_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          inquiry_id: string
          is_processed?: boolean
          processed_at?: string | null
          reason?: string | null
          snooze_until: string
          snoozed_by: string
        }
        Update: {
          created_at?: string
          id?: string
          inquiry_id?: string
          is_processed?: boolean
          processed_at?: string | null
          reason?: string | null
          snooze_until?: string
          snoozed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "snooze_schedules_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snooze_schedules_snoozed_by_fkey"
            columns: ["snoozed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          email: string
          id: string
          is_active?: boolean
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      merge_customer_profiles: {
        Args: {
          p_actor_id: string
          p_source_customer_id: string
          p_target_customer_id: string
        }
        Returns: Json
      }
      sync_order_from_api: {
        Args: {
          p_mall_code: string
          p_order_data: Json
          p_source_channel: string
        }
        Returns: Json
      }
      try_acquire_inquiry_lock: {
        Args: { p_inquiry_id: string; p_user_id: string }
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
    Enums: {},
  },
} as const

// Convenience aliases
export type DbUser = Database['public']['Tables']['users']['Row']
export type DbMall = Database['public']['Tables']['malls']['Row']
export type DbInquiry = Database['public']['Tables']['inquiries']['Row']
export type DbInquiryMessage = Database['public']['Tables']['inquiry_messages']['Row']
export type DbComment = Database['public']['Tables']['comments']['Row']
export type DbActivityLog = Database['public']['Tables']['activity_logs']['Row']
export type DbSnoozeSchedule = Database['public']['Tables']['snooze_schedules']['Row']
export type DbCustomerProfile = Database['public']['Tables']['customer_profiles']['Row']
export type DbCustomerActivityLog = Database['public']['Tables']['customer_activity_logs']['Row']
export type DbCustomerIdentity = Database['public']['Tables']['customer_identities']['Row']
export type DbKnowledge = Database['public']['Tables']['knowledge']['Row']
export type DbTag = Database['public']['Tables']['tags']['Row']
export type DbInquiryTag = Database['public']['Tables']['inquiry_tags']['Row']
export type DbAiLog = Database['public']['Tables']['ai_logs']['Row']
export type DbManufacturerContact = Database['public']['Tables']['manufacturer_contacts']['Row']
export type DbOrder = Database['public']['Tables']['orders']['Row']
export type DbOrderItem = Database['public']['Tables']['order_items']['Row']
export type DbCustomerTagDefinition = Database['public']['Tables']['customer_tag_definitions']['Row']
export type DbCustomerProfileTag = Database['public']['Tables']['customer_profile_tags']['Row']

// Joined types for UI
export type InquiryWithAssignee = DbInquiry & {
  assignee: Pick<DbUser, 'id' | 'display_name' | 'avatar_url'> | null
  mall: Pick<DbMall, 'id' | 'code' | 'name'>
}
export type MessageWithSender = DbInquiryMessage & {
  sender: Pick<DbUser, 'id' | 'display_name' | 'avatar_url'> | null
}
export type CommentWithAuthor = DbComment & {
  author: Pick<DbUser, 'id' | 'display_name' | 'avatar_url'>
}
export type ActivityLogWithActor = DbActivityLog & {
  actor: Pick<DbUser, 'id' | 'display_name'> | null
}
export type TagWithMeta = DbTag
