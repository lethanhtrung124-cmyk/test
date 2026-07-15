# Data Model

Quan hệ trọng yếu:

- `projects` 1-n `use_cases`
- `use_cases` 1-n `test_scenarios`
- `use_cases` n-n `test_cases` qua `test_case_use_cases`
- `test_cases` 1-n `automation_scripts`
- `test_runs` 1-n `test_run_cases`
- `test_run_cases` 1-n `test_results`
- `test_results` 1-n `evidence`
- `test_results` n-n `defects` qua `defect_links`
- `application_versions` 1-n `test_runs`

Migration baseline: `supabase/migrations/202607150001_baseline_schema.sql`.

## RLS

RLS dùng `project_members` làm nguồn phân quyền. Các bảng lõi lọc theo `project_id`; bảng phụ thuộc kiểm tra quyền thông qua bảng cha.

## Audit

Trigger `audit_row_change` ghi thay đổi quan trọng cho UC, Test Case, Test Run và Defect. Result trong Test Run đã khóa bị chặn bằng trigger `prevent_locked_run_result_changes`.
