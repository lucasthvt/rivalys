// Hand-authored to match supabase/migrations/20260825000000_init_schema.sql.
// PLACEHOLDER: regenerate from the live project once linked, and replace this file wholesale:
//   supabase link --project-ref <ref>
//   supabase gen types typescript --linked > src/lib/supabase/database.types.ts
// Read-only for agents A/B/C/D — see CLAUDE.md Phase 0 note.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SaasType = "b2b" | "b2c";
export type SubscriptionTier = "starter" | "pro" | "growth";
export type ProductStage = "idea" | "launched" | "growing" | "mature";
export type PricingModel = "freemium" | "free_trial" | "subscription" | "one_time";
export type MainGoal = "acquisition" | "conversion" | "retention" | "pricing";
export type TargetType = "own_saas" | "competitor";
export type GapCategory =
  | "pricing"
  | "positioning"
  | "reviews"
  | "social_presence"
  | "auth"
  | "payment";
export type GapPriority = "high" | "medium" | "low";
export type GapStatus = "open" | "dismissed" | "done";

export interface PricingTier {
  name: string;
  price: string;
  features: string[];
}

export interface ExtractedSiteData {
  pricing_tiers: PricingTier[];
  has_free_trial: boolean;
  has_free_tier: boolean;
  value_proposition: string;
  target_audience: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          saas_type: SaasType;
          industry: string;
          product_description: string | null;
          saas_url: string;
          product_stage: ProductStage | null;
          pricing_model: PricingModel | null;
          main_goal: MainGoal | null;
          target_customer: string | null;
          subscription_tier: SubscriptionTier;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          subscription_current_period_end: string | null;
          onboarding_completed: boolean;
          terms_accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          first_name: string;
          saas_type: SaasType;
          industry: string;
          product_description?: string | null;
          saas_url: string;
          product_stage?: ProductStage | null;
          pricing_model?: PricingModel | null;
          main_goal?: MainGoal | null;
          target_customer?: string | null;
          subscription_tier?: SubscriptionTier;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          subscription_current_period_end?: string | null;
          onboarding_completed?: boolean;
          terms_accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          saas_type?: SaasType;
          industry?: string;
          product_description?: string | null;
          saas_url?: string;
          product_stage?: ProductStage | null;
          pricing_model?: PricingModel | null;
          main_goal?: MainGoal | null;
          target_customer?: string | null;
          subscription_tier?: SubscriptionTier;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          subscription_current_period_end?: string | null;
          onboarding_completed?: boolean;
          terms_accepted_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      competitors: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          url: string;
          is_primary: boolean;
          url_changed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          url: string;
          is_primary?: boolean;
          url_changed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string | null;
          url?: string;
          is_primary?: boolean;
          url_changed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "competitors_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      site_snapshots: {
        Row: {
          id: string;
          user_id: string;
          target_type: TargetType;
          competitor_id: string | null;
          raw_pricing_html: string | null;
          raw_homepage_html: string | null;
          extracted_data: Json;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_type: TargetType;
          competitor_id?: string | null;
          raw_pricing_html?: string | null;
          raw_homepage_html?: string | null;
          extracted_data: Json;
          fetched_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          target_type?: TargetType;
          competitor_id?: string | null;
          raw_pricing_html?: string | null;
          raw_homepage_html?: string | null;
          extracted_data?: Json;
          fetched_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_snapshots_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "site_snapshots_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      detected_gaps: {
        Row: {
          id: string;
          user_id: string;
          competitor_id: string;
          category: GapCategory;
          title: string;
          description: string;
          priority: GapPriority;
          status: GapStatus;
          created_at: string;
          /** Null while open, and on gaps closed before this column existed — see the migration. */
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          competitor_id: string;
          category: GapCategory;
          title: string;
          description: string;
          priority: GapPriority;
          status?: GapStatus;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          competitor_id?: string;
          category?: GapCategory;
          title?: string;
          description?: string;
          priority?: GapPriority;
          status?: GapStatus;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "detected_gaps_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "detected_gaps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      score_history: {
        Row: {
          id: string;
          user_id: string;
          score: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          score: number;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          score?: number;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "score_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // Ajoutées à la main faute de pouvoir relancer `supabase gen types` depuis cet
      // environnement. Elles existent bien dans la migration 20260901000000 ; une
      // régénération les produira à l'identique et écrasera ces deux blocs sans rien
      // changer. Aucune relation : ni l'une ni l'autre ne référence un utilisateur.
      public_teardowns: {
        Row: {
          pair_key: string;
          own_url: string;
          competitor_url: string;
          result: Json;
          hit_count: number;
          created_at: string;
        };
        Insert: {
          pair_key: string;
          own_url: string;
          competitor_url: string;
          result: Json;
          hit_count?: number;
          created_at?: string;
        };
        Update: {
          pair_key?: string;
          own_url?: string;
          competitor_url?: string;
          result?: Json;
          hit_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      public_teardown_quota: {
        Row: {
          ip_hash: string;
          used_at: string;
        };
        Insert: {
          ip_hash: string;
          used_at?: string;
        };
        Update: {
          ip_hash?: string;
          used_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
