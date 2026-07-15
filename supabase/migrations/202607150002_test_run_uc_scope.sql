alter table public.test_runs
add column if not exists use_case_ids uuid[] not null default '{}'::uuid[];

comment on column public.test_runs.use_case_ids is
'Danh sách UC thuộc phạm vi của một đợt kiểm thử. Nếu rỗng, ứng dụng có thể coi là toàn bộ UC của dự án cho dữ liệu cũ.';
