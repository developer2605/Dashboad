# Ads Sheet Dashboard

## Tài liệu hướng dẫn

- [Hướng dẫn đưa app online](docs/ONLINE.md)
- [Hướng dẫn Firebase giai đoạn 2](docs/FIREBASE.md)
- [Hướng dẫn quản trị](docs/ADMIN.md)
- [Hướng dẫn người dùng](docs/USER.md)

Dashboard React + TypeScript + Vite để thống kê dữ liệu quảng cáo từ Google Sheet public CSV.

## Cấu hình Google Sheet

Tạo file `.env` ở thư mục dự án và đặt:

```env
VITE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv&gid=0
VITE_ADMIN_EMAIL=admin@gmail.com
VITE_ADMIN_PASSWORD=doi-mat-khau-nay
VITE_ADMIN_PHONE=0900000000
VITE_ADMIN_TELEGRAM=your_telegram_username
VITE_ADMIN_ZALO=0900000000
VITE_ADMIN_FACEBOOK=https://facebook.com/your.profile
```

Nếu chưa cấu hình biến này, app tự dùng dữ liệu mẫu để kiểm tra giao diện.

Trong giao diện app cũng có ô `Link Google Sheet CSV`; link nhập ở đây sẽ được lưu trên trình duyệt và ưu tiên hơn `.env`. Nút `Tải mẫu trường` tải file CSV mẫu với đúng các cột app hỗ trợ.

## Cột dữ liệu hỗ trợ

App đọc các cột chuẩn: `date`, `page`, `adAccount`, `service`, `spend`, `messages`, `comments`, `phone`, `adId`, `gender`.

Các tên cột tiếng Việt phổ biến cũng được nhận diện, ví dụ: `ngày`, `tài khoản quảng cáo`, `dịch vụ`, `số tiền chi tiêu`, `số mess`, `bình luận`, `số điện thoại`, `ad id`, `giới tính`.

## Bảng dữ liệu

- Bảng 1 tổng hợp theo `page + dịch vụ + ad id ads + tài khoản quảng cáo`, gồm chi tiêu, mess, bình luận và số lượng số điện thoại.
- Bảng 2 gom danh sách số điện thoại theo `ad id ads + tài khoản quảng cáo + page + dịch vụ`.

## Quản lý tài khoản thuê

App có màn đăng nhập tài khoản trước khi vào dashboard. Khách đăng ký bằng Gmail, xác thực Gmail, rồi liên hệ admin để được kích hoạt hoặc gia hạn thời gian sử dụng.

Tài khoản admin mặc định lấy từ `.env`. Nếu chưa cấu hình, app dùng `admin@gmail.com / admin123` để demo; nên đổi trước khi build online.

### Luồng khách hàng

1. Mở app.
2. Bấm `Tạo tài khoản khách`.
3. Đăng ký bằng Gmail và mật khẩu.
4. Nhập mã xác thực Gmail.
5. Sau khi xác thực, liên hệ admin qua điện thoại, Telegram, Zalo hoặc Facebook được cấu hình trong `.env`.
6. Khi admin kích hoạt, tài khoản sẽ vào được dashboard tới ngày hết hạn.

### Luồng admin

1. Đăng nhập bằng Gmail admin.
2. Bấm `Quản lý tài khoản`.
3. Chọn số ngày kích hoạt/gia hạn.
4. Bấm nút `+` ở tài khoản khách để kích hoạt hoặc gia hạn.
5. Khi hết hạn, admin chỉ cần gia hạn thêm ngày cho tài khoản đó.

Khu quản lý tài khoản chia thành `Chờ xác thực Gmail`, `Chờ admin kích hoạt`, `Đang hoạt động`, và `Hết hạn`. Có thể bấm `Xuất tài khoản` để tải CSV quản lý.

Lưu ý: nếu cấu hình Firebase, tài khoản và thời hạn được đồng bộ bằng Firebase Auth + Firestore để admin quản lý ở mọi nơi. Nếu chưa cấu hình Firebase, app tự chạy chế độ local demo bằng `localStorage`.

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
