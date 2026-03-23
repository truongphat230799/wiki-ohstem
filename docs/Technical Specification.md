# **Tài liệu Đặc tả Dự án: Hệ thống Wiki Thông minh OhStem (Serverless)**

## **1\. Tổng quan Dự án**

* **Tên dự án:** OhStem Wiki Hub & Universal AI Assistant.  
* **Mục tiêu:** Chuyển đổi từ ReadTheDocs sang hệ thống Wiki hiện đại, chạy Serverless, tích hợp AI (Gemini) làm trợ lý ảo phản hồi dựa trên nội dung wiki cho toàn bộ hệ sinh thái (Web Wiki, Next LMS, OhStem App).  
* **Nguyên lý cốt lõi:** "Single Source of Truth" \- Mọi kiến thức được quản lý bằng Markdown trên Wiki và tự động đồng bộ hóa làm bộ não cho AI.

## **2\. Công nghệ sử dụng (Tech Stack)**

* **Frontend Wiki:** Nextra 4 (Next.js framework) \- Tối ưu SEO, hỗ trợ MDX.  
* **Hosting:** Vercel (Serverless).  
* **AI Engine:** Google Gemini 1.5 Flash (Tốc độ nhanh, hỗ trợ ngữ cảnh lớn, chi phí thấp).  
* **Knowledge Base (RAG):** Gemini File Search (Vector Store) hoặc tích hợp Inkeep.  
* **Data Pipeline:** GitHub Actions (Tự động hóa việc crawl và index dữ liệu).  
* **Format dữ liệu:** Markdown (.md) / MDX (.mdx).

## **3\. Kiến trúc Hệ thống**

Hệ thống bao gồm 3 lớp chính:

1. **Lớp Lưu trữ (Storage Layer):** Một GitHub Repository chứa toàn bộ file Markdown.  
2. **Lớp Xử lý & Đồng bộ (Sync Layer):** GitHub Actions thực hiện nhiệm vụ:  
   * Phát hiện thay đổi trong file Markdown.  
   * Chuyển đổi/Làm sạch dữ liệu.  
   * Đẩy dữ liệu vào Gemini Vector Store (File Search).  
3. **Lớp Phân phối (Distribution Layer):**  
   * **Web Wiki:** Hiển thị nội dung tĩnh qua Nextra.  
   * **AI Endpoint (Serverless Function):** Một API trung gian (xây dựng trên Vercel Functions) để các ứng dụng khác (Next LMS, OhStem App) gọi vào để hỏi đáp kiến thức từ Wiki.

## **4\. Kịch bản Tích hợp AI**

### **4.1. Tích hợp trên Trang Wiki**

* Sử dụng UI Component "Ask AI" tích hợp ở thanh tìm kiếm hoặc góc màn hình.  
* Phản hồi nhanh các câu hỏi về hướng dẫn sử dụng, lập trình thiết bị OhStem.

### **4.2. Tích hợp liên nền tảng (LMS & App)**

* **Cơ chế:** Các ứng dụng bên thứ 3 gửi câu hỏi tới API Endpoint của Wiki kèm theo apiKey.  
* **Luồng xử lý:** 1\. User hỏi trên App.  
  2\. App gọi API POST /api/ai/ask.  
  3\. API gửi query tới Gemini \+ tham chiếu Vector Store của Wiki.  
  4\. Gemini trả về câu trả lời có trích dẫn nguồn (Link tới trang wiki tương ứng).

## **5\. Kế hoạch Triển khai (Roadmap)**

### **Giai đoạn 1: Thiết lập Wiki Nextra**

* Cấu hình Nextra 4 trên Vercel.  
* Migrate dữ liệu từ ReadTheDocs (chuyển .rst sang .md nếu cần).  
* Thiết lập cấu trúc thư mục phân cấp (Sản phẩm \-\> Hướng dẫn \-\> Bài học).

### **Giai đoạn 2: Xây dựng AI Pipeline**

* Tạo Google AI Studio project và lấy Gemini API Key.  
* Viết script Python/Node.js để tự động đồng bộ file từ GitHub lên Gemini Vector Store.  
* Cấu hình GitHub Actions chạy script này mỗi khi có lệnh git push.

### **Giai đoạn 3: Phát triển API Gateway**

* Viết Vercel Serverless Function xử lý logic RAG (Retrieval-Augmented Generation).  
* Đảm bảo API có khả năng trả về định dạng JSON phù hợp cho cả Web và Mobile App.

### **Giai đoạn 4: Tích hợp và Kiểm thử**

* Nhúng Chatbot vào Wiki.  
* Cấp quyền truy cập API cho đội ngũ phát triển Next LMS và OhStem App.

## **6\. Yêu cầu về Dữ liệu đầu vào cho AI Agent (Prompting Context)**

Khi yêu cầu AI thực hiện tác vụ trong dự án này, hãy sử dụng chỉ dẫn sau:

*"Bạn là chuyên gia về Next.js và Gemini API. Hãy giúp tôi xây dựng hệ thống Wiki dựa trên Nextra, sử dụng Gemini 1.5 Flash để làm tính năng hỏi đáp. Dữ liệu đầu vào là các file Markdown trong thư mục /pages. Hệ thống phải chạy hoàn toàn Serverless trên Vercel."*