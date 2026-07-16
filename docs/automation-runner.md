# Quy trình kiểm thử tự động thật

## Luồng chạy

1. Người dùng chọn dự án, đợt kiểm thử, nhập URL, tài khoản, mật khẩu, trình duyệt và tag script trên ứng dụng.
2. Ứng dụng gọi Netlify Function `/.netlify/functions/run-automation`.
3. Netlify Function gọi GitHub Actions workflow `automation.yml`.
4. GitHub Actions chạy Playwright trên URL mục tiêu.
5. Playwright sinh:
   - `test-results/junit.xml`
   - `test-results/results.json`
   - `test-results/summary.json`
   - `playwright-report`
   - screenshot/video/trace khi lỗi theo cấu hình Playwright
6. GitHub Actions upload toàn bộ vào artifact `playwright-evidence-<test_run_id>`.
7. Nếu có `RESULTS_INGEST_URL` và `RESULTS_INGEST_TOKEN`, workflow publish kết quả về backend ingest.

## Cấu hình Netlify

Thêm các biến môi trường cho site Netlify:

```text
GITHUB_AUTOMATION_TOKEN=<fine-grained token co quyen Actions: write va Contents: write>
GITHUB_OWNER=lethanhtrung124-cmyk
GITHUB_REPO=test
GITHUB_REF_NAME=main
GITHUB_AUTOMATION_WORKFLOW=automation.yml
```

## Cấu hình GitHub Secrets

Token GitHub cần cấp quyền cho repo:

```text
Actions: Read and write
Contents: Read and write
Metadata: Read-only
```

Nên cấu hình credentials kiểm thử bằng GitHub Secrets:

```text
TEST_USERNAME=<tai khoan kiem thu>
TEST_PASSWORD=<mat khau kiem thu>
RESULTS_INGEST_URL=<endpoint nhan ket qua, neu co>
RESULTS_INGEST_TOKEN=<token ingest, neu co>
```

## Nơi xem minh chứng

Vào GitHub repository -> Actions -> Automation Runner -> chọn lần chạy -> Artifacts -> tải `playwright-evidence-<test_run_id>`.

Trong artifact:

- `playwright-report/index.html`: báo cáo HTML.
- `test-results/junit.xml`: kết quả JUnit.
- `test-results/results.json`: kết quả gốc từ Playwright.
- `test-results/summary.json`: kết quả đã chuẩn hóa để ingest.
- screenshot/video/trace nằm trong `test-results` khi test lỗi hoặc retry.
