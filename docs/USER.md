# Hướng Dẫn Người Dùng

Tài liệu này dành cho khách hàng sử dụng dashboard.

## 1. Đăng ký tài khoản

1. Mở app dashboard.
2. Bấm `Tạo tài khoản khách`.
3. Nhập tên hiển thị, Gmail và mật khẩu.
4. Bấm `Đăng ký Gmail`.
5. Nếu app đã bật Firebase, mở Gmail và bấm link xác thực email.
6. Quay lại app, bấm nút kiểm tra xác thực Gmail.

Sau khi xác thực, tài khoản vẫn cần admin kích hoạt trước khi dùng dashboard.

## 2. Liên hệ admin để kích hoạt

Sau khi xác thực Gmail, app sẽ hiển thị thông tin liên hệ admin:

- Số điện thoại
- Telegram
- Zalo
- Facebook

Gửi Gmail đã đăng ký cho admin để được kích hoạt hoặc gia hạn tài khoản.

## 3. Đăng nhập

Khi admin đã kích hoạt:

1. Mở app.
2. Nhập Gmail và mật khẩu.
3. Bấm `Đăng nhập`.

Nếu tài khoản còn hạn, app sẽ mở dashboard.

Nếu tài khoản hết hạn, app sẽ yêu cầu liên hệ admin để gia hạn.

## 4. Quên mật khẩu

Nếu quên mật khẩu:

1. Tại màn đăng nhập, bấm `Quên mật khẩu`.
2. Nhập Gmail đã đăng ký.
3. Nếu app đã bật Firebase, bấm gửi email đặt lại mật khẩu.
4. Mở Gmail và làm theo link trong email.
5. Đăng nhập lại bằng mật khẩu mới.

Nếu app đang chạy chế độ local demo, app sẽ hiển thị mã đặt lại để nhập thủ công trên màn hình.

## 5. Nhập link Google Sheet

Khi đã vào dashboard:

1. Dán link CSV nguồn hiệu quả ads vào ô `Link nguồn hiệu quả ads`.
2. Dán link CSV nguồn danh sách SĐT vào ô `Link nguồn danh sách SĐT`.
3. Bấm nút áp dụng link.
4. App sẽ tải 2 nguồn dữ liệu và cập nhật bảng/biểu đồ.

Link CSV thường có dạng:

```text
https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0
```

## 6. Tải mẫu trường dữ liệu

Bấm `Mẫu ads` để tải file TSV mẫu cho nguồn hiệu quả ads. Sheet nên có các cột:

```tsv
date	adId	spend	messages	comments	phoneCount	adAccount	page	service
```

Bấm `Mẫu SĐT` để tải file TSV mẫu cho nguồn danh sách SĐT. Sheet nên có các cột:

```tsv
date	phone	adId	adAccount	page	service	gender
```

TSV dùng tab để mở/import vào Google Sheet hoặc Excel không bị gộp vào một cột.

App cũng nhận một số tên cột tiếng Việt phổ biến như `ngày`, `tài khoản quảng cáo`, `dịch vụ`, `chi tiêu`, `mess`, `bình luận`, `sđt`, `số lượng sđt`, `ad id`, `giới tính`.

## 7. Xem dữ liệu

Dashboard có:

- KPI tổng quan: chi tiêu, mess, bình luận, lead từ nguồn hiệu quả ads; SĐT hợp lệ và duy nhất từ nguồn danh sách SĐT.
- Biểu đồ xu hướng theo ngày từ nguồn hiệu quả ads.
- Biểu đồ so sánh theo page, tài khoản quảng cáo, dịch vụ và ad id từ nguồn hiệu quả ads.
- Biểu đồ giới tính từ nguồn danh sách SĐT.
- Bảng 1 tổng hợp theo ad id ads.
- Bảng 2 danh sách số điện thoại theo từng SĐT + ad id ads + tài khoản quảng cáo + page + dịch vụ.

Có thể dùng bộ lọc phía trên để lọc theo ngày, page, tài khoản quảng cáo, dịch vụ, giới tính và ad id.
