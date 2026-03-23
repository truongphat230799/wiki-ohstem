# Báo Cáo Công Việc Hàng Ngày (Daily Work Log)

File này lưu trữ danh sách các công việc đã thực hiện, tiến độ và chi tiết các cập nhật từ AI.

## Ngày 16/03/2026
- **[Khởi tạo]**: Tạo file nhật ký công việc theo yêu cầu.
- **[Ghi chú]**: Tìm hiểu và báo cáo về chi phí (pricing plan) của Keystatic.
- **[Kiểm tra]**: Kiểm tra tính năng AI Chatbot (AskAI) với Gemini API và hỗ trợ người dùng dùng thử.
- **[Sửa lỗi]**: Chatbot UI hoạt động tốt (nút FAB, panel chat, suggestions). API bị lỗi 500 → Debug phát hiện:
  - Cập nhật `route.js`: đổi `contents` format từ old API (role/parts) sang SDK v1 (string), đổi model từ `gemini-1.5-flash` → `gemini-2.0-flash`.
  - **Nguyên nhân gốc**: API key đã hết quota miễn phí (429 RESOURCE_EXHAUSTED, limit: 0). Cần tạo key mới hoặc bật billing.
  - Cải thiện error handling trong `route.js` để hiển thị thông báo lỗi cụ thể (quota, invalid key, etc.) thay vì lỗi chung.
  - Xóa file test `test-gemini.mjs`.

## Ngày 17/03/2026
- **[Tính năng mới]**: Xây dựng tính năng **Xóa / Ẩn bài viết** (Mức 3 — Đầy đủ):
  - Tạo trang Admin Panel tại `/admin` với giao diện quản lý bài viết premium.
  - **API endpoints**: Consolidated vào `/api/admin/list-articles` (GET: liệt kê bài viết, POST: toggle ẩn/hiện + xóa bài).
  - **Tính năng**: Tìm kiếm bài viết, toggle ẩn/hiện (sửa `_meta.js` với `display: 'hidden'`), xóa bài (xóa file + cập nhật `_meta.js`), xác nhận trước khi xóa, toast notifications, dashboard thống kê.
  - **UI**: Dark/light mode, responsive, animations, 495 bài viết hiển thị đúng.
  - **Keystatic**: Thêm field `hidden` checkbox vào tất cả collections.
  - **Files mới**: `components/AdminPanel.jsx`, `components/AdminPanel.css`, `app/admin/page.jsx`, `app/api/admin/list-articles/route.js`, `app/api/admin/toggle-visibility/route.js`, `app/api/admin/delete-article/route.js`.
  - **Bug fix**: Sửa lỗi articles không có trong `_meta.js` sẽ tự động được thêm khi toggle.
- **[Nâng cấp]**: Nâng cấp Admin Panel `/admin` thành CMS đầy đủ:
  - Thêm tính năng **✏️ Chỉnh sửa bài viết**: Editor markdown split-pane (code + live preview), toolbar format, upload hình ảnh trực tiếp, Ctrl+S lưu.
  - Thêm tính năng **➕ Tạo bài viết mới**: Chọn section, tự sinh slug từ tiếng Việt, editor nội dung, upload ảnh.
  - Thêm tính năng **↕ Sắp xếp thứ tự**: ▲▼ arrows để di chuyển bài viết lên/xuống, cập nhật `_meta.js`.
  - **Backend API**: Mở rộng `/api/admin/list-articles` với 8 actions (list, toggle, delete, read, save, create, reorder, upload).
  - **Files mới**: `components/ArticleEditor.jsx`, `components/CreateArticle.jsx`.
  - **Files sửa**: `components/AdminPanel.jsx` (rewritten), `components/AdminPanel.css`, `list-articles/route.js`.
  - Tất cả test pass: editor, create, reorder, hide/delete đều hoạt động.
- **[Sửa lỗi]**: Fix nội dung wiki không cập nhật sau khi lưu từ Admin CMS:
  - **Nguyên nhân**: Turbopack cache compiled MDX ở bundler module level, không invalidate khi file write từ API handler.
  - Đã thử: `revalidatePath`, `force-dynamic`, touch file, `__CACHE_BUST__` comment → không hiệu quả.
  - **Giải pháp cuối**: Tạo trang Preview (`/admin/preview?path=...`) đọc nội dung trực tiếp từ disk qua API, bypass hoàn toàn Turbopack module cache.
  - Editor có 2 nút: **👁️ Preview** (nội dung mới nhất) + **🔗 Wiki Page** (trang Nextra chính thức).
  - **File mới**: `app/admin/preview/page.jsx`, `app/api/admin/refresh-page/route.js`.
  - **Files sửa**: `components/ArticleEditor.jsx`, `app/api/admin/list-articles/route.js`.
- **[Tính năng mới]**: Tích hợp **3D Model Viewer** (Babylon.js):
  - Component `components/Model3D.jsx`: load file `.glb`, auto-framing camera theo bounding box, 3-point lighting, orbit controls.
  - Babylon.js v8.55.3 + WebGL2, hỗ trợ xoay/zoom/pan.
  - Test thành công với `rover_chassis.glb`. Public — không cần login.
- **[UI]**: Thay logo OhStem toàn bộ:
  - Login: emoji 🛡️ → `logoohstem.png`. Header: "🤖 OhStem Wiki" → logo + "Wiki".
  - Trang chủ heading: emoji → logo inline. AI Chat: avatar → `avt_ai_chat.png`.
  - **Files sửa**: `app/layout.jsx`, `app/admin/login/page.jsx`, `content/index.mdx`, `components/AskAI.jsx`.
- **[Dọn dẹp]**: Ẩn trang index trống khỏi sidebar:
  - Tạo lại 105 file `index.mdx` tối giản (Nextra yêu cầu cho routing).
  - Thêm `"index": { "display": "hidden" }` vào 105 file `_meta.js`.
  - Fix orphan key `"bat-tat-den"` → `"bat-tat-den-rgb"`.
- **[Cải thiện]**: Tiếng Việt có dấu trên sidebar:
  - Cập nhật 109 file `_meta.js` với title từ frontmatter MDX.
  - Fix 3 file syntax lỗi (backslash). Khôi phục từ git + script sạch giữ nguyên thứ tự.
- **[Cải thiện]**: Sắp xếp theo số thứ tự (ưu tiên số hơn alphabet):
  - Sidebar: Sort 18 file `_meta.js` numeric (1→2→3, không 1→10→2).
  - Admin panel: Fix API sort theo `_meta.js` key order. Fix regex `getMetaKeyOrder`.
  - **Files sửa**: `app/api/admin/list-articles/route.js`.

