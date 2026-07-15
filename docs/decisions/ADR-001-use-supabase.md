# ADR-001-use-supabase

## Trạng thái

Accepted, hiệu lực từ 15/07/2026.

## Bối cảnh

Baseline v2.0 cần Auth, PostgreSQL, Storage, Edge Functions và RLS để triển khai nhanh nhưng vẫn có phân quyền theo dự án.

## Quyết định

Sử dụng Supabase làm lớp dịch vụ ứng dụng và dữ liệu cho baseline v2.0.

## Phương án đã xem xét

- Backend riêng bằng Node/NestJS: linh hoạt hơn nhưng tăng chi phí vận hành baseline.
- Firebase: thuận tiện realtime nhưng mô hình truy vấn quan hệ/RTM phức tạp hơn.

## Hệ quả

- Migration và RLS phải được review như mã nguồn.
- Service-role key chỉ được dùng trong Edge Functions hoặc CI secrets.
- Khi yêu cầu enterprise tăng lên, có thể tách backend riêng mà vẫn giữ PostgreSQL làm lõi dữ liệu.
