# Container Architecture

| Container | Công nghệ | Trách nhiệm |
| --- | --- | --- |
| Web App | React, TypeScript, Vite | UI quản lý dự án, UC, RTM, Test Run, defect, report |
| Database | Supabase PostgreSQL | Lưu dữ liệu nghiệp vụ, RLS, audit log |
| Storage | Supabase Storage | Lưu screenshot, video, trace, log, report |
| Edge Function | Supabase Deno | Nhận kết quả automation bằng service role |
| Automation | Playwright | Mở trình duyệt, thao tác, assertion, evidence |
| CI | GitHub Actions | Build, test, xuất report, publish result |

## Ranh giới bí mật

Frontend chỉ dùng `VITE_SUPABASE_ANON_KEY` và phụ thuộc RLS. Service-role key nằm trong Edge Function hoặc GitHub Secrets.
