# 🤖 OhStem Wiki Hub

Hệ thống Wiki thông minh cho OhStem Education, xây dựng trên **Nextra 4** + **Gemini 1.5 Flash AI**.

## Tính năng

- 📘 **Wiki tĩnh**: Render nhanh từ file Markdown/MDX, SEO tối ưu
- 🤖 **Trợ lý AI**: Chatbot tích hợp, trả lời dựa trên nội dung wiki
- 🔍 **Tìm kiếm**: Pagefind search engine (full-text, offline)
- 🌗 **Dark/Light mode**: Tự động theo hệ thống
- 📱 **Responsive**: Hiển thị tốt trên mọi thiết bị
- ☁️ **Serverless**: Deploy trên Vercel, không cần server

## Cài đặt

```bash
# Clone repository
git clone https://github.com/AITT-VN/wiki-app.git
cd wiki-app

# Cài đặt dependencies
npm install

# Tạo file .env.local
cp .env.example .env.local
# Sửa GEMINI_API_KEY trong .env.local

# Chạy dev server
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) để xem wiki.

## Cấu trúc thư mục

```
wiki-app/
├── app/                      # Next.js App Router
│   ├── layout.jsx            # Root layout (Nextra theme)
│   ├── [[...mdxPath]]/       # Catch-all MDX route
│   │   └── page.jsx
│   └── api/ai/ask/           # AI Q&A API endpoint
│       └── route.js
├── components/               # React components
│   ├── AskAI.jsx             # AI chat widget
│   └── AskAI.css
├── content/                  # Wiki content (Markdown/MDX)
│   ├── _meta.js              # Navigation config
│   ├── index.mdx             # Homepage
│   ├── getting-started.mdx
│   └── products/
│       ├── _meta.js
│       ├── yolo-bit.mdx
│       └── xbot.mdx
├── lib/                      # Utilities
│   └── wiki-context.js       # RAG context builder
├── next.config.mjs
├── mdx-components.jsx
└── package.json
```

## Thêm nội dung Wiki

1. Tạo file `.mdx` trong thư mục `content/`
2. Thêm frontmatter title:

   ```mdx
   ---
   title: Tiêu đề trang
   ---
   # Nội dung trang
   ```

3. Cập nhật `_meta.js` tương ứng để hiển thị trong sidebar
4. Nội dung mới sẽ tự động xuất hiện trong câu trả lời AI

## API cho bên thứ 3

Ứng dụng khác (LMS, Mobile App) có thể gọi API:

```bash
curl -X POST https://wiki.ohstem.vn/api/ai/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Yolo:Bit là gì?", "apiKey": "YOUR_GEMINI_KEY"}'
```

## Deploy lên Vercel

1. Push code lên GitHub
2. Import project trên [Vercel](https://vercel.com)
3. Thêm environment variable `GEMINI_API_KEY`
4. Deploy!

## License

© 2025 OhStem Education. All rights reserved.
