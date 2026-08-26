-- Rivalys initial schema: profiles, competitors, site_snapshots, detected_gaps, score_history
-- RLS: every table restricted to rows owned by the authenticated user.

-- ============================================================
-- profiles
-- ============================================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  first_name text not null,
  saas_type text check (saas_type in ('b2b', 'b2c')) not null,
  industry text not null,
  product_description text,
  saas_url text not null,
  subscription_tier text check (subscription_tier in ('starter', 'pro', 'growth')) default 'starter',
  onboarding_completed boolean default false,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own"
  on profiles for select
  using (id = auth.uid());

create policy "profiles_insert_own"
  on profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_own"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_delete_own"
  on profiles for delete
  using (id = auth.uid());

-- ============================================================
-- competitors
-- ============================================================
create table competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text,
  url text not null,
  is_primary boolean default true,
  created_at timestamptz default now()
);

alter table competitors enable row level security;

create policy "competitors_select_own"
  on competitors for select
  using (user_id = auth.uid());

create policy "competitors_insert_own"
  on competitors for insert
  with check (user_id = auth.uid());

create policy "competitors_update_own"
  on competitors for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "competitors_delete_own"
  on competitors for delete
  using (user_id = auth.uid());

-- ============================================================
-- site_snapshots
-- ============================================================
create table site_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  target_type text check (target_type in ('own_saas', 'competitor')) not null,
  competitor_id uuid references competitors(id) on delete cascade,
  raw_pricing_html text,
  raw_homepage_html text,
  extracted_data jsonb not null,
  -- extracted_data shape: { pricing_tiers: [{name, price, features[]}], has_free_trial, has_free_tier, value_proposition, target_audience }
  fetched_at timestamptz default now()
);

create index site_snapshots_competitor_fetched_idx
  on site_snapshots (competitor_id, fetched_at desc);

create index site_snapshots_user_target_fetched_idx
  on site_snapshots (user_id, target_type, fetched_at desc);

alter table site_snapshots enable row level security;

create policy "site_snapshots_select_own"
  on site_snapshots for select
  using (user_id = auth.uid());

create policy "site_snapshots_insert_own"
  on site_snapshots for insert
  with check (user_id = auth.uid());

create policy "site_snapshots_update_own"
  on site_snapshots for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "site_snapshots_delete_own"
  on site_snapshots for delete
  using (user_id = auth.uid());

-- ============================================================
-- detected_gaps
-- ============================================================
create table detected_gaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  competitor_id uuid references competitors(id) on delete cascade not null,
  category text check (category in ('pricing', 'positioning', 'reviews', 'social_presence')) not null,
  title text not null,
  description text not null,
  priority text check (priority in ('high', 'medium', 'low')) not null,
  status text check (status in ('open', 'dismissed', 'done')) default 'open',
  created_at timestamptz default now()
);

create index detected_gaps_user_status_priority_idx
  on detected_gaps (user_id, status, priority);

alter table detected_gaps enable row level security;

create policy "detected_gaps_select_own"
  on detected_gaps for select
  using (user_id = auth.uid());

create policy "detected_gaps_insert_own"
  on detected_gaps for insert
  with check (user_id = auth.uid());

create policy "detected_gaps_update_own"
  on detected_gaps for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "detected_gaps_delete_own"
  on detected_gaps for delete
  using (user_id = auth.uid());

-- ============================================================
-- score_history
-- ============================================================
create table score_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  score integer check (score between 0 and 100) not null,
  recorded_at timestamptz default now()
);

create index score_history_user_recorded_idx
  on score_history (user_id, recorded_at desc);

alter table score_history enable row level security;

create policy "score_history_select_own"
  on score_history for select
  using (user_id = auth.uid());

create policy "score_history_insert_own"
  on score_history for insert
  with check (user_id = auth.uid());

create policy "score_history_delete_own"
  on score_history for delete
  using (user_id = auth.uid());
