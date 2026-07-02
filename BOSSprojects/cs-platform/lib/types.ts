export type UserRole = 'admin' | 'manager' | 'member'
export type InquiryStatus = 'open' | 'pending' | 'resolved' | 'spam'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageSenderType = 'customer' | 'staff' | 'system' | 'ai'
export type SourceChannel = 'email' | 'rakuten' | 'yahoo' | 'line' | 'manual'
export type IdentifierType = 'email' | 'masked_email' | 'order_number' | 'line_user_id' | 'phone' | 'name'

// activity_logs.action の想定値（TEXT型・拡張容易性優先）
export type ActivityAction =
  | 'assigned' | 'replied' | 'status_changed' | 'snoozed' | 'commented'
  | 'ai_draft_generated' | 'ai_draft_accepted' | 'ai_draft_edited'
  | 'knowledge_applied' | 'manufacturer_contacted'
  | 'locked' | 'unlocked' | 'lock_expired'
  | 'snooze_expired'
  | (string & {})

export type AiLogActionType = 'classify' | 'draft' | 'search'
export type AiLogFeedback = 'accepted' | 'edited' | 'rejected'
export type ManufacturerChannel = 'wechat' | 'email' | 'phone' | 'other'
export type ManufacturerContactStatus = 'waiting' | 'replied' | 'closed' | 'escalated'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string
          avatar_url: string | null
          role: UserRole
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name: string
          avatar_url?: string | null
          role?: UserRole
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
        Relationships: []
      }
      malls: {
        Row: {
          id: string
          code: string
          name: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['malls']['Insert']>
        Relationships: []
      }
      inquiries: {
        Row: {
          id: string
          mall_id: string
          external_id: string | null
          inquiry_number: string | null
          order_number: string | null
          item_name: string | null
          customer_name: string | null
          subject: string | null
          status: InquiryStatus
          assignee_id: string | null
          customer_profile_id: string | null
          source_channel: SourceChannel | null
          external_customer_key: string | null
          ai_intent: string | null
          ai_confidence: number | null
          ai_action: string | null
          is_angry: boolean
          needs_human: boolean
          snooze_until: string | null
          first_reply_at: string | null
          resolved_at: string | null
          locked_by: string | null
          locked_at: string | null
          raw_payload: Record<string, unknown> | null
          received_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          mall_id: string
          external_id?: string | null
          inquiry_number?: string | null
          order_number?: string | null
          item_name?: string | null
          customer_name?: string | null
          subject?: string | null
          status?: InquiryStatus
          assignee_id?: string | null
          customer_profile_id?: string | null
          source_channel?: SourceChannel | null
          external_customer_key?: string | null
          ai_intent?: string | null
          ai_confidence?: number | null
          ai_action?: string | null
          is_angry?: boolean
          needs_human?: boolean
          snooze_until?: string | null
          first_reply_at?: string | null
          resolved_at?: string | null
          locked_by?: string | null
          locked_at?: string | null
          raw_payload?: Record<string, unknown> | null
          received_at?: string
        }
        Update: Partial<Database['public']['Tables']['inquiries']['Insert']>
        Relationships: []
      }
      inquiry_messages: {
        Row: {
          id: string
          inquiry_id: string
          direction: MessageDirection
          sender_type: MessageSenderType
          sender_id: string | null
          body: string
          is_ai_draft: boolean
          ai_modified: boolean
          sent_at: string
          created_at: string
          external_message_id: string | null
        }
        Insert: {
          id?: string
          inquiry_id: string
          direction: MessageDirection
          sender_type: MessageSenderType
          sender_id?: string | null
          body: string
          is_ai_draft?: boolean
          ai_modified?: boolean
          sent_at?: string
          external_message_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['inquiry_messages']['Insert']>
        Relationships: []
      }
      comments: {
        Row: {
          id: string
          inquiry_id: string
          author_id: string
          body: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          inquiry_id: string
          author_id: string
          body: string
        }
        Update: Partial<Database['public']['Tables']['comments']['Insert']>
        Relationships: []
      }
      activity_logs: {
        Row: {
          id: string
          inquiry_id: string
          actor_id: string | null
          action: string
          before_val: Record<string, unknown> | null
          after_val: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          inquiry_id: string
          actor_id?: string | null
          action: string
          before_val?: Record<string, unknown> | null
          after_val?: Record<string, unknown> | null
        }
        Update: Partial<Database['public']['Tables']['activity_logs']['Insert']>
        Relationships: []
      }
      snooze_schedules: {
        Row: {
          id: string
          inquiry_id: string
          snoozed_by: string
          snooze_until: string
          reason: string | null
          is_processed: boolean
          processed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          inquiry_id: string
          snoozed_by: string
          snooze_until: string
          reason?: string | null
          is_processed?: boolean
          processed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['snooze_schedules']['Insert']>
        Relationships: []
      }
      customer_profiles: {
        Row: {
          id: string
          display_name: string | null
          primary_email: string | null
          phone: string | null
          memo: string | null
          customer_name: string | null
          customer_email: string | null
          order_count: number
          inquiry_count: number
          return_count: number
          risk_score: number
          last_order_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          display_name?: string | null
          primary_email?: string | null
          phone?: string | null
          memo?: string | null
          customer_name?: string | null
          customer_email?: string | null
          order_count?: number
          inquiry_count?: number
          return_count?: number
          risk_score?: number
          last_order_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['customer_profiles']['Insert']>
        Relationships: []
      }
      customer_activity_logs: {
        Row: {
          id: string
          customer_profile_id: string | null
          actor_id: string | null
          action: string
          before_val: Record<string, unknown> | null
          after_val: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_profile_id?: string | null
          actor_id?: string | null
          action: string
          before_val?: Record<string, unknown> | null
          after_val?: Record<string, unknown> | null
        }
        Update: Partial<Database['public']['Tables']['customer_activity_logs']['Insert']>
        Relationships: []
      }
      customer_identities: {
        Row: {
          id: string
          customer_profile_id: string
          channel: SourceChannel
          identifier_type: IdentifierType
          identifier_value: string
          normalized_value: string
          confidence: number
          verified: boolean
          source_inquiry_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_profile_id: string
          channel: SourceChannel
          identifier_type: IdentifierType
          identifier_value: string
          normalized_value: string
          confidence?: number
          verified?: boolean
          source_inquiry_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['customer_identities']['Insert']>
        Relationships: []
      }
      knowledge: {
        Row: {
          id: string
          title: string
          category: string
          intent: string | null
          mall_code: string | null
          question_pattern: string | null
          answer_template: string
          is_active: boolean
          quality_score: number
          usage_count: number
          success_count: number
          last_used_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          category: string
          intent?: string | null
          mall_code?: string | null
          question_pattern?: string | null
          answer_template: string
          is_active?: boolean
          quality_score?: number
          usage_count?: number
          success_count?: number
          last_used_at?: string | null
          created_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['knowledge']['Insert']>
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color?: string
        }
        Update: Partial<Database['public']['Tables']['tags']['Insert']>
        Relationships: []
      }
      inquiry_tags: {
        Row: {
          inquiry_id: string
          tag_id: string
          created_at: string
        }
        Insert: {
          inquiry_id: string
          tag_id: string
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      ai_logs: {
        Row: {
          id: string
          inquiry_id: string | null
          action_type: AiLogActionType
          model: string
          prompt_tokens: number | null
          completion_tokens: number | null
          result: Record<string, unknown> | null
          confidence: number | null
          latency_ms: number | null
          feedback: AiLogFeedback | null
          feedback_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          inquiry_id?: string | null
          action_type: AiLogActionType
          model: string
          prompt_tokens?: number | null
          completion_tokens?: number | null
          result?: Record<string, unknown> | null
          confidence?: number | null
          latency_ms?: number | null
          feedback?: AiLogFeedback | null
          feedback_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['ai_logs']['Insert']>
        Relationships: []
      }
      manufacturer_contacts: {
        Row: {
          id: string
          inquiry_id: string
          channel: ManufacturerChannel
          direction: 'outbound' | 'inbound'
          body: string
          status: ManufacturerContactStatus
          contacted_by: string | null
          contacted_at: string
          created_at: string
        }
        Insert: {
          id?: string
          inquiry_id: string
          channel: ManufacturerChannel
          direction: 'outbound' | 'inbound'
          body: string
          status?: ManufacturerContactStatus
          contacted_by?: string | null
          contacted_at?: string
        }
        Update: Partial<Database['public']['Tables']['manufacturer_contacts']['Insert']>
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          customer_profile_id: string | null
          mall_id: string | null
          source_channel: string
          external_order_id: string
          order_number: string | null
          ordered_at: string
          total_amount: number | null
          currency: string
          buyer_name: string | null
          buyer_email: string | null
          status: string
          raw_payload: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_profile_id?: string | null
          mall_id?: string | null
          source_channel: string
          external_order_id: string
          order_number?: string | null
          ordered_at: string
          total_amount?: number | null
          currency?: string
          buyer_name?: string | null
          buyer_email?: string | null
          status?: string
          raw_payload?: Record<string, unknown> | null
        }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          external_item_id: string | null
          sku: string | null
          item_name: string | null
          quantity: number
          unit_price: number | null
          raw_payload: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          external_item_id?: string | null
          sku?: string | null
          item_name?: string | null
          quantity?: number
          unit_price?: number | null
          raw_payload?: Record<string, unknown> | null
        }
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>
        Relationships: []
      }
      customer_tag_definitions: {
        Row: {
          id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color?: string
        }
        Update: Partial<Database['public']['Tables']['customer_tag_definitions']['Insert']>
        Relationships: []
      }
      customer_profile_tags: {
        Row: {
          customer_profile_id: string
          tag_id: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          customer_profile_id: string
          tag_id: string
          created_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['customer_profile_tags']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      try_acquire_inquiry_lock: {
        Args: { p_inquiry_id: string; p_user_id: string }
        Returns: { acquired: boolean; was_expired: boolean; prev_locked_by: string | null }
      }
      merge_customer_profiles: {
        Args: { p_source_customer_id: string; p_target_customer_id: string; p_actor_id: string }
        Returns: { success: boolean; source: string; target: string; moved_inquiries: number; moved_identities: number }
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

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
