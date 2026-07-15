# UC Test Platform

Nền tảng quản lý và kiểm thử chức năng theo Use Case, triển khai baseline v2.0.0 theo tài liệu thiết kế ngày 15/07/2026.

## Năng lực chính

- Quản lý dự án, môi trường, phiên bản ứng dụng, UC, scenario, Test Case và RTM.
- Theo dõi Test Run, kết quả Pass/Fail/Blocked/Not Run/Flaky/Infrastructure Error.
- Lưu evidence gồm screenshot, video, trace, log, JUnit và HTML report với checksum.
- Quản lý defect liên kết từ kết quả Fail.
- Supabase migration có RLS, audit log và cơ chế chặn sửa result khi Test Run đã khóa.
- Playwright framework có tag theo dự án, module, suite và tên test chứa UC ID/Test Case ID.
- GitHub Actions nhận tham số `test_run_id`, `base_url`, `suite` và xuất JUnit/HTML/JSON summary.

## Chạy cục bộ

```bash
npm install
npm run dev
```

Ứng dụng mặc định chạy bằng dữ liệu mock pilot. Để nối Supabase thật, cấu hình:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Build và kiểm thử

```bash
npm run build
npm run test
npm run test:e2e
```

Playwright tạo:

- `test-results/junit.xml`
- `test-results/results.json`
- `test-results/summary.json`
- `playwright-report/`

## Supabase

Áp dụng migration và seed:

```bash
supabase db push
supabase db seed
supabase functions deploy ingest-test-results
```

Không đưa `SUPABASE_SERVICE_ROLE_KEY` vào frontend hoặc Netlify public environment. Service key chỉ dùng trong Edge Functions hoặc GitHub Secrets.

Migration baseline bật RLS và cung cấp policy cho các luồng đọc/ghi lõi. Trước production, tạo user thật trong Supabase Auth, thêm bản ghi `project_members`, sau đó chạy smoke test quyền truy cập theo từng vai trò.

## GitHub Actions

Workflow `.github/workflows/ci.yml` hỗ trợ `workflow_dispatch`:

- `test_run_id`
- `base_url`
- `suite`, ví dụ `@suite:smoke`

Secrets khuyến nghị:

- `RESULTS_INGEST_URL`
- `RESULTS_INGEST_TOKEN`
- `TEST_USERNAME`
- `TEST_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY`

## Netlify

Netlify dùng `netlify.toml`:

- build: `npm run build`
- publish: `dist`
- SPA redirect về `index.html`

## Tài liệu

- [docs/UC-TEST-SDD.md](docs/UC-TEST-SDD.md)
- [docs/architecture/context.md](docs/architecture/context.md)
- [docs/architecture/container.md](docs/architecture/container.md)
- [docs/architecture/deployment.md](docs/architecture/deployment.md)
- [docs/architecture/data-model.md](docs/architecture/data-model.md)
- [docs/decisions/ADR-001-use-supabase.md](docs/decisions/ADR-001-use-supabase.md)
- [docs/releases/v2.0.0.md](docs/releases/v2.0.0.md)
- [docs/changelog.md](docs/changelog.md)
