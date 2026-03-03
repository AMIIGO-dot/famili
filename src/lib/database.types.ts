/**
 * FAMILJ – Supabase Database Type Definitions
 *
 * These types mirror the Supabase PostgreSQL schema.
 * Generate fresh from Supabase CLI:
 *   npx supabase gen types typescript --project-id <YOUR_PROJECT_ID> > src/lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type EventType = 'activity' | 'homework' | 'test' | 'other';
export type MemberRole = 'parent' | 'child';
export type SubscriptionStatus = 'active' | 'expired' | 'trial' | 'cancelled';
export type SubscriptionPlan = 'free' | 'monthly' | 'yearly';
export type SubscriptionPlatform = 'ios' | 'android';

export interface RecurrenceRule {
  frequency: 'weekly' | 'biweekly' | 'weekdays';
  interval: number;
  byWeekday?: string[];
  timezone: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          language: string;
          timezone: string;
          locale: string;
          week_start_preference: 0 | 1; // 0=Sunday, 1=Monday
          time_format_preference: '12h' | '24h';
          created_at: string;
        };
        Insert: {
          id: string;
          language?: string;
          timezone?: string;
          locale?: string;
          week_start_preference?: 0 | 1;
          time_format_preference?: '12h' | '24h';
          created_at?: string;
        };
        Update: {
          id?: string;
          language?: string;
          timezone?: string;
          locale?: string;
          week_start_preference?: 0 | 1;
          time_format_preference?: '12h' | '24h';
        };
        Relationships: [];
      };
      families: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          family_id: string;
          name: string;
          color: string;
          role: MemberRole;
          user_id: string | null; // Supabase auth UID — null until the member creates an account
        };
        Insert: {
          id?: string;
          family_id: string;
          name: string;
          color: string;
          role: MemberRole;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          family_id?: string;
          name?: string;
          color?: string;
          role?: MemberRole;
          user_id?: string | null;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          family_id: string;
          title: string;
          start_time_utc: string; // ISO 8601 UTC
          end_time_utc: string;   // ISO 8601 UTC
          timezone: string;        // IANA timezone
          type: EventType;
          recurrence_rule: RecurrenceRule | null;
          member_ids: string[];
          reminder_minutes: number | null;
          is_parents_only: boolean; // Hidden from children
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          title: string;
          start_time_utc: string;
          end_time_utc: string;
          timezone: string;
          type?: EventType;
          recurrence_rule?: RecurrenceRule | null;
          member_ids?: string[];
          reminder_minutes?: number | null;
          is_parents_only?: boolean;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          title?: string;
          start_time_utc?: string;
          end_time_utc?: string;
          timezone?: string;
          type?: EventType;
          recurrence_rule?: RecurrenceRule | null;
          member_ids?: string[];
          reminder_minutes?: number | null;
          is_parents_only?: boolean;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          user_id: string;
          status: SubscriptionStatus;
          plan: SubscriptionPlan;
          expires_at: string | null;
          platform: SubscriptionPlatform;
        };
        Insert: {
          user_id: string;
          status: SubscriptionStatus;
          plan: SubscriptionPlan;
          expires_at?: string | null;
          platform: SubscriptionPlatform;
        };
        Update: {
          status?: SubscriptionStatus;
          plan?: SubscriptionPlan;
          expires_at?: string | null;
          platform?: SubscriptionPlatform;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      event_type: EventType;
      member_role: MemberRole;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
