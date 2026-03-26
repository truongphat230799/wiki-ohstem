import { buildSearchContextString } from '../../../../lib/wiki-context.js'

const MINIMAX_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2'
const DEFAULT_MINIMAX_MODEL = process.env.MINIMAX_MODEL?.trim() || 'MiniMax-M2.5'
const MINIMAX_TIMEOUT_MS = parseTimeoutMs(process.env.MINIMAX_TIMEOUT_MS, 40000)
const THINKING_BLOCK_RE = /<think>[\s\S]*?(<\/think>|$)/g

const SYSTEM_PROMPT = `Bạn là trợ lý AI thông minh của OhStem Education - một công ty chuyên về thiết bị giáo dục STEM.

NHIỆM VỤ:
- Trả lời câu hỏi dựa trên nội dung tài liệu Wiki được cung cấp.
- Nếu người dùng hỏi về một đối tượng cụ thể, chỉ trả lời đúng đối tượng đó.
- Nếu câu hỏi là câu hỏi nối tiếp trong cùng cuộc trò chuyện, hãy giữ mạch trả lời liền với ngữ cảnh trước đó.
- Nếu câu hỏi nằm ngoài phạm vi tài liệu, hãy nói rõ rằng bạn không có thông tin và gợi ý người dùng liên hệ support@ohstem.vn.

QUY TẮC:
1. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu.
2. Giữ chủ thể xuyên suốt theo lịch sử hội thoại; các câu như "nó", "cái đó", "vậy còn..." phải bám đúng đối tượng đang nói tới.
3. Khi câu hỏi là dạng "X là gì?", "giới thiệu X", "cách dùng X", chỉ mô tả X; không mở rộng sang sản phẩm, bảng thi, robot, module, hay chủ đề khác nếu người dùng không hỏi.
4. Ưu tiên dùng nguồn khớp nhất. Chỉ dùng thêm nguồn khác nếu nguồn chính không đủ để trả lời trực tiếp.
5. Sử dụng markdown formatting (bold, list, code block) cho câu trả lời đẹp.
6. Khi trích dẫn thông tin, đính kèm link nguồn dạng: [Tên trang](URL).
7. Nếu câu hỏi liên quan đến code, cung cấp ví dụ code cụ thể.
8. Với câu hỏi định nghĩa/giới thiệu, trả lời theo dạng: 1 câu mô tả ngắn + tối đa 3 đến 5 ý chính.
9. Bỏ các phần phụ như hotline, FAQ, liên hệ, lời mời hỏi thêm, hoặc thông tin ngoài trọng tâm nếu người dùng chưa hỏi.
10. Giữ giọng văn thân thiện, hỗ trợ, phù hợp với học sinh.`

function parseTimeoutMs(rawValue, fallbackValue) {
    const parsed = Number.parseInt(rawValue ?? '', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue
}

function getMiniMaxErrorMessage(payload, fallbackMessage) {
    return (
        payload?.base_resp?.status_msg ||
        payload?.error_msg ||
        payload?.message ||
        fallbackMessage
    )
}

function extractMiniMaxContent(payload) {
    return (
        payload?.choices?.[0]?.delta?.content ??
        payload?.choices?.[0]?.message?.content ??
        ''
    )
}

function stripThinkingBlocks(text = '') {
    return text.replace(THINKING_BLOCK_RE, '').trim()
}

function normalizeQuestionText(text = '') {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/đ/g, 'd')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
}

function isDefinitionQuestion(question = '') {
    return /(la gi|gioi thieu|cho biet|thong tin ve)/i.test(
        normalizeQuestionText(question)
    )
}

function isContextDependentQuestion(question = '') {
    const normalized = normalizeQuestionText(question)

    return (
        /(^(no|nha?u?|cai do|cai nay|thu nay|thu do|vay con|the con|con no|them nua|ro hon|chi tiet hon)\b)/i.test(normalized) ||
        /(\b(no|cai do|cai nay|thu nay|thu do|vay con|the con)\b)/i.test(normalized) ||
        /^(dung de lam gi|cach dung|lap trinh sao|lap trinh the nao|hoat dong ra sao|co gi dac biet)$/i.test(normalized)
    )
}

function trimDefinitionAnswer(text = '') {
    const blockedSections = [
        /^##+\s+thông tin liên hệ/i,
        /^##+\s+liên hệ/i,
        /^##+\s+các câu hỏi thường gặp/i,
        /^##+\s+faq/i,
    ]
    const followUpPatterns = [
        /^Bạn cần thêm thông tin/i,
        /^Bạn có muốn tìm hiểu thêm/i,
        /^Bạn có câu hỏi cụ thể nào/i,
        /^Nếu bạn cần thêm/i,
        /^Nếu bạn muốn/i,
    ]

    const lines = text.split('\n')
    const filteredLines = []
    let skipSection = false

    for (const line of lines) {
        const trimmedLine = line.trim()
        const isHeading = /^#+\s+/.test(trimmedLine)

        if (blockedSections.some((pattern) => pattern.test(trimmedLine))) {
            skipSection = true
            continue
        }

        if (skipSection && isHeading) {
            skipSection = false
        }

        if (!skipSection) {
            filteredLines.push(line)
        }
    }

    while (filteredLines.length > 0) {
        const lastLine = filteredLines[filteredLines.length - 1].trim()

        if (!lastLine || lastLine === '---') {
            filteredLines.pop()
            continue
        }

        if (followUpPatterns.some((pattern) => pattern.test(lastLine))) {
            filteredLines.pop()
            continue
        }

        break
    }

    return filteredLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function normalizeHistory(history) {
    if (!Array.isArray(history)) return []

    return history
        .filter((msg) => typeof msg?.content === 'string' && msg.content.trim())
        .slice(-10)
        .map((msg) => ({
            role: msg.role === 'ai' ? 'assistant' : 'user',
            content: msg.content.trim(),
        }))
}

function buildSearchQuery(questionText, history) {
    const normalizedQuestion = normalizeQuestionText(questionText)
    const userHistory = history.filter((msg) => msg.role === 'user')

    if (!userHistory.length) {
        return questionText
    }

    if (!isContextDependentQuestion(questionText)) {
        return questionText
    }

    const recentTopics = userHistory
        .slice(-2)
        .map((msg) => msg.content)
        .filter(Boolean)

    if (!recentTopics.length) {
        return questionText
    }

    const mergedQuery = [...recentTopics, questionText].join('\n')

    if (normalizedQuestion.length >= 20) {
        return mergedQuery
    }

    return mergedQuery
}

function createTimeoutController(timeoutMs) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    return {
        signal: controller.signal,
        cleanup() {
            clearTimeout(timeoutId)
        },
    }
}

export async function POST(request) {
    try {
        const { question, history = [] } = await request.json()
        const questionText = typeof question === 'string' ? question.trim() : ''

        if (!questionText) {
            return Response.json(
                { error: 'Vui lòng nhập câu hỏi.' },
                { status: 400 }
            )
        }

        const minimaxApiKey = process.env.MINIMAX_API_KEY?.trim()
        if (!minimaxApiKey) {
            return Response.json(
                { error: 'Chưa cấu hình MINIMAX_API_KEY. Vui lòng liên hệ quản trị viên.' },
                { status: 500 }
            )
        }

        const lastMessages = normalizeHistory(history)
        const searchQuery = buildSearchQuery(questionText, lastMessages)
        const wikiContext = buildSearchContextString(searchQuery, 3)

        const messages = [
            {
                role: 'system',
                content: `${SYSTEM_PROMPT}\n\n--- NỘI DUNG WIKI LIÊN QUAN ---\n${wikiContext || 'Không tìm thấy tài liệu wiki liên quan trực tiếp.'}\n--- HẾT NỘI DUNG WIKI ---`,
            },
            ...lastMessages,
            { role: 'user', content: questionText },
        ]

        const { signal, cleanup } = createTimeoutController(MINIMAX_TIMEOUT_MS)

        try {
            const response = await fetch(MINIMAX_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${minimaxApiKey}`,
                },
                body: JSON.stringify({
                    model: DEFAULT_MINIMAX_MODEL,
                    messages,
                    stream: false,
                    temperature: 0.3,
                }),
                signal,
            })

            if (!response.ok) {
                const errorText = await response.text()
                let errorJson = null

                try {
                    errorJson = JSON.parse(errorText)
                } catch {}

                throw new Error(
                    getMiniMaxErrorMessage(
                        errorJson,
                        errorText || `MiniMax API Error: ${response.status}`
                    )
                )
            }

            const data = await response.json().catch(() => null)
            if (!data || data.base_resp?.status_code !== 0) {
                throw new Error(
                    getMiniMaxErrorMessage(
                        data,
                        'MiniMax trả về dữ liệu không hợp lệ.'
                    )
                )
            }

            let text = stripThinkingBlocks(extractMiniMaxContent(data))
            if (isDefinitionQuestion(questionText)) {
                text = trimDefinitionAnswer(text)
            }

            if (!text) {
                throw new Error('MiniMax không trả về nội dung hiển thị.')
            }

            return new Response(text, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'no-cache, no-store',
                    'X-AI-Provider': 'minimax',
                },
            })
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw new Error(
                    `MiniMax phản hồi quá lâu (${Math.round(MINIMAX_TIMEOUT_MS / 1000)} giây).`
                )
            }

            throw error
        } finally {
            cleanup()
        }
    } catch (error) {
        console.error('AI API Error:', error.message || error)
        return Response.json(
            { error: error.message || 'Đã xảy ra lỗi khi xử lý câu hỏi.' },
            { status: 500 }
        )
    }
}
