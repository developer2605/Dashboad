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

Cần chuẩn bị 2 nguồn Google Sheet public CSV.

Nguồn hiệu quả ads nên có các cột:

```csv
date,adId,spend,messages,comments,phoneCount,adAccount,page,service
```

Nguồn danh sách SĐT nên có các cột:

```csv
date,phone,adId,adAccount,page,service,gender
```

Cách lấy link CSV thường dùng:

```text
https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0
```

Trong app có 2 ô link: `Link nguồn hiệu quả ads` và `Link nguồn danh sách SĐT`. Link nhập trong giao diện được lưu trên trình duyệt và ưu tiên hơn link trong `.env`.

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
VITE_PERFORMANCE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/YOUR_PERFORMANCE_SHEET_ID/export?format=csv&gid=0
VITE_PHONE_SHEET_CSV_URL=https://docs.google.com/spreadsheets/d/YOUR_PHONE_SHEET_ID/export?format=csv&gid=0
VITE_ADMIN_EMAIL=admin@gmail.com
VITE_ADMIN_PHONE=0900000000
VITE_ADMIN_TELEGRAM=your_telegram_username
VITE_ADMIN_ZALO=0900000000
VITE_ADMIN_FACEBOOK=https://facebook.com/your.profile
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

Lưu ý: biến bắt đầu bằng `VITE_` sẽ được đóng gói vào mã chạy trên trình duyệt. Firebase web config không phải mật khẩu bí mật; bảo mật thật nằm ở Firebase Authentication và Firestore Rules.

## 5. Giới hạn của bản hiện tại

Nếu chưa cấu hình Firebase, app tự chạy fallback local demo và lưu tài khoản trong `localStorage`. Chế độ này chỉ phù hợp để thử giao diện.

Khi đã cấu hình Firebase:

- Đăng ký, đăng nhập, xác thực Gmail và quên mật khẩu dùng Firebase Auth.
- Danh sách tài khoản, trạng thái kích hoạt và thời hạn dùng lưu trong Firestore.
- Admin có thể quản lý tài khoản từ mọi máy.
- Cần publish Firestore Rules đúng như hướng dẫn trong [FIREBASE.md](FIREBASE.md).

## 6. Khuyến nghị khi cho thuê thật

- Bắt buộc dùng Firebase mode, không dùng local demo.
- Không để Firestore ở test mode.
- Thay `YOUR_ADMIN_GMAIL` trong `firestore.rules` bằng Gmail admin thật.
- Nếu muốn xóa luôn tài khoản Firebase Auth từ màn admin, cần bổ sung Cloud Functions hoặc Admin SDK.

## 7. Nguồn tham khảo

- Vercel Vite docs: https://vercel.com/docs/frameworks/frontend/vite
- Vercel Environment Variables: https://vercel.com/docs/environment-variables
- Vite Env Variables and Modes: https://vite.dev/guide/env-and-mode
