# Hướng Dẫn Firebase Giai Đoạn 2

Mục tiêu: tài khoản, trạng thái kích hoạt và thời hạn sử dụng được đồng bộ online bằng Firebase Auth + Firestore. Admin có thể đăng nhập và quản lý từ mọi máy.

## 1. Việc bạn cần thao tác trên Firebase

1. Vào https://console.firebase.google.com và tạo Firebase project.
2. Vào `Build > Authentication > Get started`.
3. Trong `Sign-in method`, bật `Email/Password`.
4. Vào `Build > Firestore Database`, tạo database ở chế độ production.
5. Vào `Project settings > General`, tạo Web app và copy Firebase config.
6. Dán config vào `.env` local và Environment Variables trên Vercel.
7. Vào `Firestore Database > Rules`, copy nội dung file `firestore.rules`.
8. Thay `YOUR_ADMIN_GMAIL` bằng Gmail admin thật, ví dụ `admincuaban@gmail.com`.
9. Publish rules.
10. Sau khi deploy, thêm domain app vào `Authentication > Settings > Authorized domains`.

## 2. Biến môi trường cần thêm

```env
VITE_ADMIN_EMAIL=admincuaban@gmail.com
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`VITE_ADMIN_PASSWORD` không còn dùng để xác thực admin khi bật Firebase. Mật khẩu admin nằm trong Firebase Auth.

## 3. Tạo tài khoản admin lần đầu

Cách dễ nhất:

1. Mở app đã cấu hình Firebase.
2. Bấm `Tạo tài khoản khách`.
3. Đăng ký đúng Gmail đã đặt trong `VITE_ADMIN_EMAIL` và trong `firestore.rules`.
4. Mở Gmail, bấm link xác thực email.
5. Quay lại app và đăng nhập.

App sẽ tự tạo document `accounts/{uid}` với `role: "admin"` nếu Gmail trùng `VITE_ADMIN_EMAIL`.

## 4. Luồng user sau khi bật Firebase

1. User đăng ký bằng Gmail và mật khẩu.
2. Firebase gửi email xác thực thật.
3. User bấm link xác thực trong Gmail.
4. User quay lại app, bấm kiểm tra xác thực.
5. User liên hệ admin để kích hoạt.
6. Admin đăng nhập ở bất kỳ máy nào, mở `Quản lý tài khoản`, bấm `+` để kích hoạt/gia hạn.

## 5. Quên mật khẩu

Khi Firebase đã cấu hình, nút `Quên mật khẩu` sẽ gọi Firebase gửi email đặt lại mật khẩu thật. User mở Gmail và làm theo link trong email.

## 6. Dữ liệu Firestore

Collection đang dùng:

```text
accounts/{uid}
```

Các field chính:

```json
{
  "email": "khach@gmail.com",
  "displayName": "Khách A",
  "role": "user",
  "createdAt": "2026-06-19T00:00:00.000Z",
  "emailVerifiedAt": "2026-06-19T00:10:00.000Z",
  "activatedAt": "2026-06-19T00:15:00.000Z",
  "expiresAt": "2026-07-19T00:15:00.000Z"
}
```

Admin được đọc danh sách toàn bộ account. User chỉ đọc được hồ sơ của chính họ.

## 7. Lưu ý quan trọng

- Không để Firestore ở test mode khi cho thuê thật.
- `VITE_FIREBASE_API_KEY` không phải mật khẩu bí mật; bảo mật nằm ở Firebase Auth và Firestore Rules.
- Nút xóa trong app hiện xóa hồ sơ Firestore. Nếu muốn xóa luôn tài khoản Firebase Auth, cần Cloud Functions hoặc Firebase Admin SDK.
- Nếu đổi Gmail admin, phải đổi cả `VITE_ADMIN_EMAIL` và dòng `YOUR_ADMIN_GMAIL` trong `firestore.rules`.

## 8. Nguồn Firebase chính thức

- Firebase Auth Web: https://firebase.google.com/docs/auth/web/start
- Firebase Manage Users: https://firebase.google.com/docs/auth/web/manage-users
- Firestore Quickstart: https://firebase.google.com/docs/firestore/quickstart
- Firebase Security Rules: https://firebase.google.com/docs/rules
