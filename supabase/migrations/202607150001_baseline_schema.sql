create extension if not exists "pgcrypto";

create type app_role as enum (
  'System Admin',
  'Project Admin',
  'Test Manager',
  'Test Analyst',
  'Manual Tester',
  'Automation Engineer',
  'Viewer/Auditor'
);

create type result_status as enum ('Pass', 'Fail', 'Blocked', 'Not Run', 'Flaky', 'Infrastructure Error');
create type run_status as enum ('Planning', 'Running', 'Completed', 'Locked');
create type severity_level as enum ('Critical', 'High', 'Medium', 'Low');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  owner_unit text not null,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table public.environments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  name text not null,
  base_url text not null,
  runner_type text not null check (runner_type in ('github-hosted', 'self-hosted')),
  status text not null default 'Ready',
  non_secret_config jsonb not null default '{}'::jsonb,
  unique (project_id, code)
);

create table public.application_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version text not null,
  build text not null,
  commit_sha text,
  deployed_at timestamptz not null,
  unique (project_id, version, build)
);

create table public.use_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  title text not null,
  module text not null,
  approved_version text not null,
  status text not null check (status in ('Approved', 'Draft', 'Locked')),
  description text,
  expected_business_result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

create table public.use_case_versions (
  id uuid primary key default gen_random_uuid(),
  use_case_id uuid not null references public.use_cases(id) on delete cascade,
  version text not null,
  content jsonb not null,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.test_scenarios (
  id uuid primary key default gen_random_uuid(),
  use_case_id uuid not null references public.use_cases(id) on delete cascade,
  code text not null,
  title text not null,
  scenario_type text not null,
  unique (use_case_id, code)
);

create table public.test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scenario_id uuid references public.test_scenarios(id) on delete set null,
  code text not null,
  title text not null,
  priority text not null check (priority in ('P0', 'P1', 'P2', 'P3')),
  suite text not null check (suite in ('smoke', 'regression', 'functional')),
  automation_status text not null check (automation_status in ('Automated', 'Manual', 'Candidate', 'Blocked')),
  expected_result text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

create table public.test_case_use_cases (
  test_case_id uuid not null references public.test_cases(id) on delete cascade,
  use_case_id uuid not null references public.use_cases(id) on delete restrict,
  primary key (test_case_id, use_case_id)
);

create table public.test_case_steps (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid not null references public.test_cases(id) on delete cascade,
  step_order integer not null,
  action text not null,
  test_data jsonb not null default '{}'::jsonb,
  expected_result text not null,
  unique (test_case_id, step_order)
);

create table public.test_case_versions (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid not null references public.test_cases(id) on delete cascade,
  version text not null,
  content jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.automation_scripts (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid not null references public.test_cases(id) on delete cascade,
  path text not null,
  tags text[] not null default '{}',
  commit_sha text not null,
  review_status text not null check (review_status in ('Approved', 'Needs Review', 'Draft')),
  unique (test_case_id, path)
);

create table public.test_suites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  name text not null,
  tags text[] not null default '{}',
  unique (project_id, code)
);

create table public.test_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  environment_id uuid not null references public.environments(id),
  application_version_id uuid not null references public.application_versions(id),
  code text not null,
  suite text not null,
  status run_status not null default 'Planning',
  requested_by uuid references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  locked_at timestamptz,
  runner_parameters jsonb not null default '{}'::jsonb,
  unique (project_id, code)
);

create table public.test_run_cases (
  id uuid primary key default gen_random_uuid(),
  test_run_id uuid not null references public.test_runs(id) on delete cascade,
  test_case_id uuid not null references public.test_cases(id),
  execution_order integer not null default 0,
  unique (test_run_id, test_case_id)
);

create table public.test_results (
  id uuid primary key default gen_random_uuid(),
  test_run_case_id uuid not null references public.test_run_cases(id) on delete cascade,
  status result_status not null,
  actual_result text not null,
  runner_type text not null check (runner_type in ('manual', 'automation')),
  commit_sha text not null,
  duration_ms integer not null default 0,
  executed_by uuid references auth.users(id),
  executed_at timestamptz not null default now(),
  retry_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  test_result_id uuid not null references public.test_results(id) on delete cascade,
  evidence_type text not null,
  file_name text not null,
  checksum text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table public.defects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  title text not null,
  severity severity_level not null,
  priority text not null check (priority in ('P0', 'P1', 'P2', 'P3')),
  status text not null,
  found_in_version text not null,
  fixed_in_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

create table public.defect_links (
  id uuid primary key default gen_random_uuid(),
  defect_id uuid not null references public.defects(id) on delete cascade,
  test_result_id uuid references public.test_results(id) on delete cascade,
  use_case_id uuid references public.use_cases(id) on delete cascade,
  test_case_id uuid references public.test_cases(id) on delete cascade
);

create table public.test_data_sets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  code text not null,
  data jsonb not null,
  contains_sensitive_data boolean not null default false,
  masking_status text not null default 'not-required',
  unique (project_id, code)
);

create table public.integration_configs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null,
  config jsonb not null,
  enabled boolean not null default true,
  unique (project_id, provider)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.environments enable row level security;
alter table public.application_versions enable row level security;
alter table public.use_cases enable row level security;
alter table public.use_case_versions enable row level security;
alter table public.test_scenarios enable row level security;
alter table public.test_cases enable row level security;
alter table public.test_case_use_cases enable row level security;
alter table public.test_case_steps enable row level security;
alter table public.test_case_versions enable row level security;
alter table public.automation_scripts enable row level security;
alter table public.test_suites enable row level security;
alter table public.test_runs enable row level security;
alter table public.test_run_cases enable row level security;
alter table public.test_results enable row level security;
alter table public.evidence enable row level security;
alter table public.defects enable row level security;
alter table public.defect_links enable row level security;
alter table public.test_data_sets enable row level security;
alter table public.integration_configs enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_project_member(target_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.project_members
    where project_id = target_project_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_project_role(target_project_id uuid, allowed_roles app_role[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.project_members
    where project_id = target_project_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create policy "members read projects" on public.projects
for select using (public.is_project_member(id));

create policy "admins manage projects" on public.projects
for all using (public.has_project_role(id, array['System Admin','Project Admin']::app_role[]))
with check (public.has_project_role(id, array['System Admin','Project Admin']::app_role[]));

create policy "members read memberships" on public.project_members
for select using (public.is_project_member(project_id));

create policy "admins manage memberships" on public.project_members
for all using (public.has_project_role(project_id, array['System Admin','Project Admin']::app_role[]))
with check (public.has_project_role(project_id, array['System Admin','Project Admin']::app_role[]));

create or replace function public.prevent_locked_run_result_changes()
returns trigger
language plpgsql
as $$
declare
  current_status run_status;
begin
  select tr.status into current_status
  from public.test_runs tr
  join public.test_run_cases trc on trc.test_run_id = tr.id
  where trc.id = coalesce(new.test_run_case_id, old.test_run_case_id);

  if current_status = 'Locked' then
    raise exception 'Test Run is locked; create a new version or formal amendment instead';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger prevent_locked_result_update
before update or delete on public.test_results
for each row execute function public.prevent_locked_run_result_changes();

create or replace function public.audit_row_change()
returns trigger
language plpgsql
as $$
declare
  target_project_id uuid;
begin
  target_project_id := coalesce(new.project_id, old.project_id);

  insert into public.audit_logs(project_id, actor_id, action, entity, entity_id, before_data, after_data)
  values (
    target_project_id,
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

create trigger audit_use_cases after insert or update or delete on public.use_cases
for each row execute function public.audit_row_change();

create trigger audit_test_cases after insert or update or delete on public.test_cases
for each row execute function public.audit_row_change();

create trigger audit_test_runs after insert or update or delete on public.test_runs
for each row execute function public.audit_row_change();

create trigger audit_defects after insert or update or delete on public.defects
for each row execute function public.audit_row_change();

create policy "project members read environments" on public.environments
for select using (public.is_project_member(project_id));
create policy "project admins manage environments" on public.environments
for all using (public.has_project_role(project_id, array['System Admin','Project Admin','Test Manager']::app_role[]))
with check (public.has_project_role(project_id, array['System Admin','Project Admin','Test Manager']::app_role[]));

create policy "project members read versions" on public.application_versions
for select using (public.is_project_member(project_id));
create policy "release roles manage versions" on public.application_versions
for all using (public.has_project_role(project_id, array['System Admin','Project Admin','Test Manager']::app_role[]))
with check (public.has_project_role(project_id, array['System Admin','Project Admin','Test Manager']::app_role[]));

create policy "project members read use cases" on public.use_cases
for select using (public.is_project_member(project_id));
create policy "analysts manage use cases" on public.use_cases
for all using (public.has_project_role(project_id, array['System Admin','Project Admin','Test Analyst']::app_role[]))
with check (public.has_project_role(project_id, array['System Admin','Project Admin','Test Analyst']::app_role[]));

create policy "project members read test cases" on public.test_cases
for select using (public.is_project_member(project_id));
create policy "test designers manage test cases" on public.test_cases
for all using (public.has_project_role(project_id, array['System Admin','Project Admin','Test Manager','Test Analyst','Automation Engineer']::app_role[]))
with check (public.has_project_role(project_id, array['System Admin','Project Admin','Test Manager','Test Analyst','Automation Engineer']::app_role[]));

create policy "project members read runs" on public.test_runs
for select using (public.is_project_member(project_id));
create policy "test managers manage runs" on public.test_runs
for all using (public.has_project_role(project_id, array['System Admin','Project Admin','Test Manager']::app_role[]))
with check (public.has_project_role(project_id, array['System Admin','Project Admin','Test Manager']::app_role[]));

create policy "project members read defects" on public.defects
for select using (public.is_project_member(project_id));
create policy "test roles manage defects" on public.defects
for all using (public.has_project_role(project_id, array['System Admin','Project Admin','Test Manager','Manual Tester','Automation Engineer']::app_role[]))
with check (public.has_project_role(project_id, array['System Admin','Project Admin','Test Manager','Manual Tester','Automation Engineer']::app_role[]));

create policy "project members read audit" on public.audit_logs
for select using (project_id is null or public.is_project_member(project_id));

create policy "service role writes audit" on public.audit_logs
for insert with check (true);

-- Dependent records inherit access through parent tables. Service-role Edge Functions may write automation results.
create policy "read scenarios through use case" on public.test_scenarios
for select using (exists (select 1 from public.use_cases uc where uc.id = use_case_id and public.is_project_member(uc.project_id)));

create policy "read scripts through test case" on public.automation_scripts
for select using (exists (select 1 from public.test_cases tc where tc.id = test_case_id and public.is_project_member(tc.project_id)));

create policy "read run cases through run" on public.test_run_cases
for select using (exists (select 1 from public.test_runs tr where tr.id = test_run_id and public.is_project_member(tr.project_id)));

create policy "read results through run case" on public.test_results
for select using (
  exists (
    select 1
    from public.test_run_cases trc
    join public.test_runs tr on tr.id = trc.test_run_id
    where trc.id = test_run_case_id and public.is_project_member(tr.project_id)
  )
);

create policy "manual testers write results" on public.test_results
for insert with check (
  exists (
    select 1
    from public.test_run_cases trc
    join public.test_runs tr on tr.id = trc.test_run_id
    where trc.id = test_run_case_id
      and tr.status <> 'Locked'
      and public.has_project_role(tr.project_id, array['System Admin','Project Admin','Test Manager','Manual Tester','Automation Engineer']::app_role[])
  )
);

create policy "read evidence through result" on public.evidence
for select using (
  exists (
    select 1
    from public.test_results r
    join public.test_run_cases trc on trc.id = r.test_run_case_id
    join public.test_runs tr on tr.id = trc.test_run_id
    where r.id = test_result_id and public.is_project_member(tr.project_id)
  )
);

insert into storage.buckets (id, name, public)
values ('test-evidence', 'test-evidence', false)
on conflict (id) do nothing;
