import { GoogleGenAI } from '@google/genai'
import { buildContextString } from '../../../../lib/wiki-context'

const SYSTEM_PROMPT = `Bạn là trợ lý AI thông minh của OhStem Education — một công ty chuyên về thiết bị giáo dục STEM.

NHIỆM VỤ:
- Trả lời câu hỏi dựa HOÀN TOÀN trên nội dung tài liệu Wiki được cung cấp bên dưới.
- Nếu câu hỏi nằm ngoài phạm vi tài liệu, hãy nói rõ rằng bạn không có thông tin và gợi ý người dùng liên hệ support@ohstem.vn.

QUY TẮC:
1. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu.
2. Sử dụng markdown formatting (bold, list, code block) cho câu trả lời đẹp.
3. Khi trích dẫn thông tin, đính kèm link nguồn dạng: [Tên trang](URL).
4. Nếu câu hỏi liên quan đến code, cung cấp ví dụ code cụ thể.
5. Giữ giọng văn thân thiện, hỗ trợ, phù hợp với học sinh.`

export async function POST(request) {
    try {
        const { question, apiKey } = await request.json()

        if (!question || typeof question !== 'string' || question.trim().length === 0) {
            return Response.json(
                { error: 'Vui lòng nhập câu hỏi.' },
                { status: 400 }
            )
        }

        // Use provided apiKey (for third-party integration) or server env key
        const geminiApiKey = apiKey || process.env.GEMINI_API_KEY
        if (!geminiApiKey) {
            return Response.json(
                { error: 'Chưa cấu hình GEMINI_API_KEY. Vui lòng liên hệ quản trị viên.' },
                { status: 500 }
            )
        }

        // Build wiki context from markdown files
        const wikiContext = buildContextString()

        const ai = new GoogleGenAI({ apiKey: geminiApiKey })

        // Build the full prompt with system instructions and wiki context
        const fullPrompt = `${SYSTEM_PROMPT}\n\n--- NỘI DUNG WIKI ---\n${wikiContext}\n--- HẾT NỘI DUNG WIKI ---\n\nCâu hỏi của người dùng: ${question.trim()}`

        // Stream response using Gemini (SDK v1 format)
        const response = await ai.models.generateContentStream({
            model: 'gemini-3-flash-preview',
            contents: fullPrompt,
            config: {
                temperature: 0.3,
                maxOutputTokens: 2048,
            },
        })

        // Create a ReadableStream to stream chunks to the client
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of response) {
                        const text = chunk.text
                        if (text) {
                            controller.enqueue(new TextEncoder().encode(text))
                        }
                    }
                    controller.close()
                } catch (err) {
                    controller.error(err)
                }
            },
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Transfer-Encoding': 'chunked',
            },
        })
    } catch (error) {
        console.error('AI API Error:', error.message || error)

        let message = 'Đã xảy ra lỗi khi xử lý câu hỏi. Vui lòng thử lại.'
        let status = 500

        if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota')) {
            message = 'API đã hết quota (giới hạn miễn phí). Vui lòng kiểm tra billing hoặc thử lại sau.'
            status = 429
        } else if (error.status === 401 || error.status === 403 || error.message?.includes('API_KEY') || error.message?.includes('401')) {
            message = 'API key không hợp lệ hoặc đã bị vô hiệu hóa.'
            status = 401
        }

        return Response.json({ error: message }, { status })
    }
}
