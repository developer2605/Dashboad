# Ads Sheet Dashboard

Dashboard React + TypeScript + Vite để thống kê dữ liệu quảng cáo từ Google Sheet public CSV.

## Cấu hình Google Sheet

Tạo file `.env` ở thư mục dự án và đặt:

```env
VITE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv&gid=0
```

Nếu chưa cấu hình biến này, app tự dùng dữ liệu mẫu để kiểm tra giao diện.

Trong giao diện app cũng có ô `Link Google Sheet CSV`; link nhập ở đây sẽ được lưu trên trình duyệt và ưu tiên hơn `.env`. Nút `Tải mẫu trường` tải file CSV mẫu với đúng các cột app hỗ trợ.

## Cột dữ liệu hỗ trợ

App đọc các cột chuẩn: `date`, `page`, `adAccount`, `service`, `spend`, `messages`, `comments`, `phone`, `adId`, `gender`.

Các tên cột tiếng Việt phổ biến cũng được nhận diện, ví dụ: `ngày`, `tài khoản quảng cáo`, `dịch vụ`, `số tiền chi tiêu`, `số mess`, `bình luận`, `số điện thoại`, `ad id`, `giới tính`.

## Bảng dữ liệu

- Bảng 1 tổng hợp theo `page + dịch vụ + ad id ads + tài khoản quảng cáo`, gồm chi tiêu, mess, bình luận và số lượng số điện thoại.
- Bảng 2 gom danh sách số điện thoại theo `ad id ads + tài khoản quảng cáo + page + dịch vụ`.

## Chạy app

```bash
npm.cmd install --cache .\\.npm-cache
npm.cmd run dev
```

Build production:

```bash
npm.cmd run build
npm.cmd run serve:dist
```
