insert into public.projects (id, code, name, owner_unit, status)
values ('11111111-1111-1111-1111-111111111111', 'PRJ-KTKT', 'Nền tảng kiểm thử UC', 'Đơn vị quản lý hệ thống', 'Active')
on conflict (id) do nothing;

insert into public.environments (id, project_id, code, name, base_url, runner_type, status)
values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'UAT', 'UAT công khai', 'https://uat.example.test', 'github-hosted', 'Ready'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'INTERNAL', 'Mạng nội bộ', 'https://internal.example.test', 'self-hosted', 'Degraded')
on conflict (id) do nothing;

insert into public.application_versions (id, project_id, version, build, commit_sha, deployed_at)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'v2.0.0', '20260715.1', 'local-pilot', '2026-07-15T03:30:00Z')
on conflict (id) do nothing;

insert into public.use_cases (id, project_id, code, title, module, approved_version, status, expected_business_result)
values
  ('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111', 'UC-USER-001', 'Quản lý người dùng và vai trò', 'user', '1.0', 'Approved', 'Người dùng chỉ truy cập dự án và chức năng được phân quyền.'),
  ('44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111', 'UC-TC-001', 'Quản lý Test Case và RTM', 'test-case', '1.0', 'Approved', 'Test Case truy vết được về UC đã phê duyệt.'),
  ('44444444-4444-4444-4444-444444444443', '11111111-1111-1111-1111-111111111111', 'UC-RUN-001', 'Tạo và khóa Test Run', 'test-run', '1.0', 'Locked', 'Kết quả sau khóa không bị sửa trực tiếp.')
on conflict (id) do nothing;

insert into public.test_scenarios (id, use_case_id, code, title, scenario_type)
values
  ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444441', 'TS-USER-001', 'Phân quyền theo vai trò dự án', 'permission'),
  ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444442', 'TS-TC-001', 'Liên kết UC với Test Case', 'integration'),
  ('55555555-5555-5555-5555-555555555553', '44444444-4444-4444-4444-444444444443', 'TS-RUN-001', 'Khóa run ngăn sửa kết quả', 'negative')
on conflict (id) do nothing;

insert into public.test_cases (id, project_id, scenario_id, code, title, priority, suite, automation_status, expected_result)
values
  ('66666666-6666-6666-6666-666666666661', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555551', 'TC-USER-001', 'Viewer chỉ xem dashboard được phân quyền', 'P1', 'smoke', 'Automated', 'Viewer không thấy thao tác quản trị hoặc cấu hình secret.'),
  ('66666666-6666-6666-6666-666666666662', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555552', 'TC-TC-001', 'Test Case bắt buộc liên kết ít nhất một UC', 'P0', 'smoke', 'Automated', 'Test Case không có UC bị từ chối.'),
  ('66666666-6666-6666-6666-666666666663', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555553', 'TC-RUN-001', 'Run đã khóa không cho sửa result trực tiếp', 'P0', 'regression', 'Automated', 'Hệ thống chặn sửa và ghi audit log yêu cầu phiên bản mới.')
on conflict (id) do nothing;

insert into public.test_case_use_cases (test_case_id, use_case_id)
values
  ('66666666-6666-6666-6666-666666666661', '44444444-4444-4444-4444-444444444441'),
  ('66666666-6666-6666-6666-666666666662', '44444444-4444-4444-4444-444444444442'),
  ('66666666-6666-6666-6666-666666666663', '44444444-4444-4444-4444-444444444443')
on conflict do nothing;

insert into public.automation_scripts (test_case_id, path, tags, commit_sha, review_status)
values
  ('66666666-6666-6666-6666-666666666661', 'tests/target-app/specs/user-permission.spec.ts', array['@project:KTKT','@module:user','@suite:smoke'], 'local-pilot', 'Approved'),
  ('66666666-6666-6666-6666-666666666662', 'tests/platform-e2e/rtm.spec.ts', array['@project:KTKT','@module:test-case','@suite:smoke'], 'local-pilot', 'Approved'),
  ('66666666-6666-6666-6666-666666666663', 'tests/platform-e2e/test-run-lock.spec.ts', array['@project:KTKT','@module:test-run','@suite:regression'], 'local-pilot', 'Needs Review')
on conflict do nothing;
