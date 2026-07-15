# Context

Nền tảng phục vụ đội quản lý kiểm thử chức năng theo Use Case đã phê duyệt. Hệ thống không tự thay đổi Expected Result và không thay thế quyết định nghiệm thu của người có thẩm quyền.

## Tác nhân

- System Admin: quản trị toàn hệ thống và cấu hình tích hợp.
- Project Admin: quản lý phạm vi dự án và thành viên.
- Test Manager: duyệt Test Case, tạo/khóa Test Run, phát hành báo cáo.
- Test Analyst: quản lý UC, scenario, Test Case và RTM.
- Manual Tester: thực hiện test thủ công.
- Automation Engineer: quản lý script và phân tích automation.
- Viewer/Auditor: xem dữ liệu, báo cáo và evidence được cấp quyền.

## Hệ thống ngoài

- Supabase: Auth, PostgreSQL, Storage, Edge Functions.
- GitHub: repository, pull request, Actions, releases.
- Netlify: frontend deployment.
- Ứng dụng cần kiểm thử: môi trường UAT/Test.
