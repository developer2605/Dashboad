# Hướng Dẫn Đưa App Online

Tài liệu này dùng cho app React + TypeScript + Vite hiện tại trong thư mục `C:\Users\hungnv\Desktop\Dashboad`.

## 1. Kiểm tra app trước khi đưa online

Chạy tại thư mục dự án:

```bash
npm.cmd install --cache .\.npm-cache
npm.cmd run build
```

Nếu build thành công, thư mục production sẽ nằm trong `dist`.

Chạy thử bản build:

```bash
npm.cmd run serve:dist
```

Mở địa chỉ app in ra trên terminal, thường là `http://127.0.0.1:5173`.

## 2. Chuẩn bị Google Sheet

Sheet của khách không cần ẩn, nhưng phải publish hoặc chia sẻ public để trình duyệt đọc được CSV.

Cột dữ liệu nên dùng:

```csv
date,page,adAccount,service,spend,messages,comments,phone,adId,gender
```

Cách lấy link CSV thường dùng:

```text
https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0
```

Trong app có ô `Link Google Sheet CSV`, user có thể đổi link trực tiếp trên giao diện. Link nhập trong giao diện được lưu trên trình duyệt và ưu tiên hơn link trong `.env`.

## 3. Deploy lên Vercel

Vercel hỗ trợ Vite và có thể import trực tiếp từ GitHub. Theo tài liệu Vercel, với dự án Vite có sẵn, có thể chạy `vercel` trong thư mục dự án hoặc import repo từ dashboard Vercel.

Các bước khuyến nghị:

1. Đưa mã nguồn lên GitHub.
2. Vào Vercel, chọn `Add New Project`.
3. Import repo dashboard này.
4. Chọn framework preset là `Vite` nếu Vercel chưa tự nhận.
5. Build command: `npm run build`.
6. Output directory: `dist`.
7. Thêm Environment Variables ở mục Project Settings.
8. Deploy.

## 4. Biến môi trường cần cấu hình

Tạo các biến này trên Vercel hoặc trong file `.env` khi chạy local:

```env
VITE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv&gid=0
VITE_ADMIN_EMAIL=admin@gmail.com
VITE_ADMIN_PASSWORD=doi-mat-khau-nay
VITE_ADMIN_PHONE=0900000000
VITE_ADMIN_TELEGRAM=your_telegram_username
VITE_ADMIN_ZALO=0900000000
VITE_ADMIN_FACEBOOK=https://facebook.com/your.profile
```

Lưu ý quan trọng: biến bắt đầu bằng `VITE_` sẽ được đóng gói vào mã chạy trên trình duyệt. Vì vậy bản quản lý tài khoản hiện tại phù hợp để demo, thử nghiệm, hoặc dùng nội bộ đơn giản. Nếu cho thuê online thật, không nên xem `VITE_ADMIN_PASSWORD` là bí mật.

## 5. Giới hạn của bản hiện tại

Bản hiện tại lưu tài khoản, trạng thái kích hoạt, thời hạn dùng và mã quên mật khẩu trong `localStorage` của trình duyệt. Điều này có nghĩa là:

- Dữ liệu tài khoản không tự đồng bộ giữa nhiều máy.
- Admin và user không dùng chung một cơ sở dữ liệu thật.
- Xác thực Gmail và quên mật khẩu là luồng demo, chưa gửi email thật.
- Người dùng có kiến thức kỹ thuật có thể can thiệp dữ liệu phía trình duyệt.

## 6. Khuyến nghị khi cho thuê thật

Khi bán hoặc cho thuê cho nhiều khách, nên nâng cấp thêm backend:

- Dùng Firebase Authentication hoặc Supabase Auth để đăng ký Gmail, xác thực email và quên mật khẩu bằng email thật.
- Dùng Firestore, Supabase Database hoặc một backend riêng để lưu tài khoản, vai trò admin, ngày hết hạn và trạng thái kích hoạt.
- Chỉ backend mới được quyền quyết định tài khoản còn hạn hay hết hạn.
- Admin dashboard gọi API/backend để kích hoạt, khóa hoặc gia hạn user.

## 7. Nguồn tham khảo

- Vercel Vite docs: https://vercel.com/docs/frameworks/frontend/vite
- Vercel Environment Variables: https://vercel.com/docs/environment-variables
- Vite Env Variables and Modes: https://vite.dev/guide/env-and-mode
