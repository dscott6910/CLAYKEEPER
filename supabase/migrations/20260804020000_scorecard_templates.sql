-- ClayKeeper reusable scorecard templates

create table if not exists public.scorecard_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  discipline text,
  orientation text not null default 'landscape',
  page_size text not null default 'letter_half',
  cards_per_page integer not null default 2,
  show_qr_code boolean not null default true,
  show_event_name boolean not null default true,
  show_event_date boolean not null default true,
  show_location boolean not null default true,
  show_host_sponsor boolean not null default true,
  show_athlete_name boolean not null default true,
  show_team_name boolean not null default true,
  show_squad_number boolean not null default true,
  show_post_number boolean not null default true,
  show_cyssa_number boolean not null default true,
  show_station_total boolean not null default true,
  show_running_total boolean not null default true,
  show_malfunctions boolean not null default true,
  show_verification_fields boolean not null default true,
  bubble_diameter numeric not null default 0.19,
  grid_columns integer not null default 10,
  station_limit integer not null default 15,
  primary_color text not null default '#111827',
  title_text text not null default 'CYSSA SCORECARD',
  footer_text text,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scorecard_templates_orientation_check
    check (orientation in ('portrait', 'landscape')),
  constraint scorecard_templates_page_size_check
    check (page_size in ('letter_half', 'letter_full')),
  constraint scorecard_templates_cards_per_page_check
    check (cards_per_page between 1 and 2),
  constraint scorecard_templates_grid_columns_check
    check (grid_columns between 1 and 10),
  constraint scorecard_templates_station_limit_check
    check (station_limit between 1 and 15),
  constraint scorecard_templates_bubble_diameter_check
    check (bubble_diameter between 0.10 and 0.30)
);

create unique index if not exists scorecard_templates_name_unique
  on public.scorecard_templates (organization_id, lower(name));

alter table public.scorecard_templates enable row level security;

drop policy if exists "scorecard_templates_select_members"
  on public.scorecard_templates;
create policy "scorecard_templates_select_members"
  on public.scorecard_templates
  for select
  using (public.is_organization_member(organization_id));

drop policy if exists "scorecard_templates_insert_members"
  on public.scorecard_templates;
create policy "scorecard_templates_insert_members"
  on public.scorecard_templates
  for insert
  with check (public.is_organization_member(organization_id));

drop policy if exists "scorecard_templates_update_members"
  on public.scorecard_templates;
create policy "scorecard_templates_update_members"
  on public.scorecard_templates
  for update
  using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

drop policy if exists "scorecard_templates_delete_admins"
  on public.scorecard_templates;
create policy "scorecard_templates_delete_admins"
  on public.scorecard_templates
  for delete
  using (
    public.has_organization_role(
      organization_id,
      array['owner', 'admin']::text[]
    )
  );
