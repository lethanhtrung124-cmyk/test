create table if not exists public.automation_run_summaries (
  test_run_id text primary key,
  project_code text,
  run_code text,
  status text not null default 'running',
  counts jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  workflow_url text,
  artifact_url text,
  generated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_result_rows (
  id text primary key,
  test_run_id text not null references public.automation_run_summaries(test_run_id) on delete cascade,
  use_case_code text,
  test_case_code text,
  title text,
  status text not null,
  duration_ms integer not null default 0,
  retry_count integer not null default 0,
  failure_reason text,
  error_message text,
  commit_sha text,
  workflow_url text,
  evidence jsonb not null default '{}'::jsonb,
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists automation_result_rows_test_run_id_idx
  on public.automation_result_rows(test_run_id);

create index if not exists automation_result_rows_status_idx
  on public.automation_result_rows(test_run_id, status);

alter table public.automation_run_summaries enable row level security;
alter table public.automation_result_rows enable row level security;

drop policy if exists "Read automation run summaries" on public.automation_run_summaries;
create policy "Read automation run summaries"
  on public.automation_run_summaries for select
  using (true);

drop policy if exists "Read automation result rows" on public.automation_result_rows;
create policy "Read automation result rows"
  on public.automation_result_rows for select
  using (true);
