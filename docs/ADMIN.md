# Hướng Dẫn Quản Trị

Tài liệu này dành cho tài khoản quản trị viên của dashboard.

## 1. Đăng nhập admin

Khi đã bật Firebase, tài khoản admin là tài khoản Firebase Auth có Gmail trùng:

```env
VITE_ADMIN_EMAIL=admin@gmail.com
```

Gmail này cũng phải được thay vào `YOUR_ADMIN_GMAIL` trong file `firestore.rules` trước khi publish rules.

Nếu chưa cấu hình Firebase, app chạy chế độ local demo và dùng `VITE_ADMIN_PASSWORD` hoặc `admin123` để thử giao diện.

## 2. Mở khu quản lý tài khoản

Sau khi đăng nhập bằng admin:

1. Bấm `Quản lý tài khoản`.
2. Xem các nhóm tài khoản:
   - `Chờ xác thực Gmail`
   - `Chờ admin kích hoạt`
   - `Đang hoạt động`
   - `Hết hạn`
3. Nhập số ngày muốn kích hoạt hoặc gia hạn.
4. Bấm nút `+` tại dòng user để kích hoạt/gia hạn.

## 3. Trạng thái tài khoản

`Chờ xác thực Gmail`: user đã đăng ký nhưng chưa nhập mã xác thực Gmail demo.

`Chờ admin kích hoạt`: user đã xác thực Gmail và đang chờ admin mở quyền.

`Đang hoạt động`: user còn hạn và có thể vào dashboard.

`Hết hạn`: user đã hết thời gian dùng, cần gia hạn nếu tiếp tục sử dụng.

## 4. Gia hạn hoặc khóa user

Gia hạn:

1. Nhập số ngày trong ô `Số ngày kích hoạt/gia hạn`.
2. Bấm nút `+` ở dòng user.
3. Nếu user đang còn hạn, app cộng thêm thời gian từ ngày hết hạn hiện tại.
4. Nếu user đã hết hạn, app tính lại từ ngày hiện tại.

Khóa quyền:

1. Bấm nút khóa tại dòng user.
2. Tài khoản chuyển sang trạng thái hết hạn.

Xóa tài khoản:

1. Bấm nút xóa tại dòng user.
2. Tài khoản bị xóa khỏi danh sách quản lý trên trình duyệt hiện tại.

## 5. Quên mật khẩu

Khi đã bật Firebase, user tự lấy lại mật khẩu bằng email thật:

1. Bấm `Quên mật khẩu`.
2. Nhập Gmail đã đăng ký.
3. Firebase gửi email đặt lại mật khẩu.
4. User mở Gmail và làm theo link trong email.

Nếu chưa cấu hình Firebase, app dùng luồng mã đặt lại demo trên trình duyệt.

## 6. Xuất danh sách tài khoản

Bấm `Xuất tài khoản` để tải CSV danh sách user, trạng thái, ngày kích hoạt và ngày hết hạn.

File này hữu ích để lưu lịch sử bán/gia hạn bên ngoài app.

## 7. Thông tin liên hệ admin

Các biến này hiển thị cho user khi họ cần kích hoạt hoặc gia hạn:

```env
VITE_ADMIN_PHONE=0900000000
VITE_ADMIN_TELEGRAM=your_telegram_username
VITE_ADMIN_ZALO=0900000000
VITE_ADMIN_FACEBOOK=https://facebook.com/your.profile
```

Có thể bỏ trống biến không dùng.

## 8. Lưu ý bảo mật

Bản online cần chạy bằng Firebase Auth + Firestore Rules. Không để Firestore ở test mode. Nút xóa trong app xóa hồ sơ Firestore; muốn xóa luôn tài khoản Auth cần Cloud Functions hoặc Firebase Admin SDK.
