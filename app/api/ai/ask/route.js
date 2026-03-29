import { searchWikiContext } from '../../../../lib/wiki-context.js'

const MINIMAX_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2'
const DEFAULT_MINIMAX_MODEL = process.env.MINIMAX_MODEL?.trim() || 'MiniMax-M2.5'
const MINIMAX_TIMEOUT_MS = parseTimeoutMs(process.env.MINIMAX_TIMEOUT_MS, 40000)
const THINKING_BLOCK_RE = /<think>[\s\S]*?(<\/think>|$)/g
const TOOL_BLOCK_RE = /<tool_code>[\s\S]*?(<\/tool_code>|$)/gi
const TOOL_TAG_RE = /<\/?(tool_code|tool|param)\b[^>]*>/gi
const TOOL_MARKUP_RE = /<\/?(tool_code|tool|param)\b/i
const MARKDOWN_LINK_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/g
const LINK_ONLY_PROMPT = `Neu can dua link thi chi duoc dung dung URL co trong DANH SACH LINK HOP LE.
Tuyet doi khong tu tao, khong sua, khong rut gon URL.
Neu wiki khong co link phu hop thi noi ro la chua thay link tuong ung trong tai lieu.`

const TOOL_RETRY_PROMPT = `Bạn không có quyền dùng tool, function calling, XML tags, hay truy cập Internet.
Tuyệt đối không trả về các tag như <tool_code>, <tool>, <param> hoặc JSON/XML để gọi công cụ.
Hãy trả lời trực tiếp cho người dùng bằng tiếng Việt dựa trên nội dung wiki đã được cung cấp.`

const SYSTEM_PROMPT = `Bạn là trợ lý AI thông minh của OhStem Education.

NHIỆM VỤ:
- Trả lời câu hỏi dựa trên nội dung tài liệu Wiki được cung cấp.
- Nếu người dùng hỏi về một đối tượng cụ thể, chỉ trả lời đúng đối tượng đó.
- Nếu câu hỏi là câu hỏi nối tiếp trong cùng cuộc trò chuyện, hãy giữ mạch trả lời liền với ngữ cảnh trước đó.
- Nếu câu hỏi về cuộc thi robot/Robotics dành cho các đối tượng học sinh thì trả lời dựa trên nội dung cuộc thi Open Robotics Challenges (ORC), tùy từng lứa tuổi mà tư vấn cho đúng bảng thi.
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
10. Giữ giọng văn thân thiện, hỗ trợ, phù hợp với học sinh.
11. Bạn không có tool hay function calling. Không được trả về XML/HTML/JSON dạng gọi công cụ như <tool_code>, <tool>, <param>; hãy luôn trả lời trực tiếp bằng văn bản cho người dùng.`

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

function containsToolMarkup(text = '') {
    return TOOL_MARKUP_RE.test(text)
}

function stripToolMarkup(text = '') {
    return text
        .replace(TOOL_BLOCK_RE, '')
        .replace(TOOL_TAG_RE, '')
        .trim()
}

function normalizeLookupText(text = '') {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/\u0111/g, 'd')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

function buildContextStringFromPages(pages = []) {
    return pages
        .map(
            (page) =>
                `=== Trang: ${page.title} (URL: ${page.path}) ===\n${page.content}`
        )
        .join('\n\n')
}

function extractMarkdownLinks(text = '') {
    const links = []
    const linkRegex = new RegExp(MARKDOWN_LINK_RE.source, MARKDOWN_LINK_RE.flags)

    for (const match of text.matchAll(linkRegex)) {
        const label = match[1]?.trim()
        const url = match[2]?.trim()

        if (label && url) {
            links.push({ label, url })
        }
    }

    return links
}

function classifyLinkType(label = '', url = '') {
    const normalized = normalizeLookupText(`${label} ${url}`)

    if (/\bhuong dan\b|\btai lieu\b|\bmanual\b|\btutorial\b/.test(normalized)) {
        return 'guide'
    }

    if (/\bthe le\b|\bquy dinh\b/.test(normalized)) {
        return 'rules'
    }

    if (/\bdang ky\b|\bregister\b/.test(normalized)) {
        return 'register'
    }

    if (/\bso tay\b|\bhandbook\b/.test(normalized)) {
        return 'handbook'
    }

    if (/\bfile in\b|\bsa ban\b/.test(normalized)) {
        return 'arena'
    }

    return 'page'
}

function buildLinkCatalog(pages = []) {
    const deduped = new Map()

    pages.forEach((page) => {
        const pageEntry = {
            label: page.title,
            url: page.path,
            pageTitle: page.title,
            pageUrl: page.path,
            type: 'page',
        }

        deduped.set(`${pageEntry.label}::${pageEntry.url}`, pageEntry)

        extractMarkdownLinks(page.content).forEach((link) => {
            const entry = {
                label: link.label,
                url: link.url,
                pageTitle: page.title,
                pageUrl: page.path,
                type: classifyLinkType(link.label, link.url),
            }

            deduped.set(`${entry.label}::${entry.url}`, entry)
        })
    })

    return [...deduped.values()]
}

function buildAllowedLinksBlock(linkCatalog = []) {
    if (!linkCatalog.length) {
        return 'Khong co link hop le nao trong cac trang wiki da tim thay.'
    }

    return linkCatalog
        .map(
            (link) =>
                `- [${link.label}](${link.url}) | Trang: [${link.pageTitle}](${link.pageUrl})`
        )
        .join('\n')
}

function getLookupTokens(text = '') {
    return normalizeLookupText(text)
        .split(/\s+/)
        .filter((token) => token.length > 1)
}

function scoreLabelMatch(label = '', candidateLabel = '') {
    const normalizedLabel = normalizeLookupText(label)
    const normalizedCandidate = normalizeLookupText(candidateLabel)

    if (!normalizedLabel || !normalizedCandidate) {
        return 0
    }

    if (normalizedLabel === normalizedCandidate) {
        return 100
    }

    let score = 0

    if (
        normalizedCandidate.includes(normalizedLabel) ||
        normalizedLabel.includes(normalizedCandidate)
    ) {
        score += 8
    }

    const labelTokens = new Set(getLookupTokens(normalizedLabel))
    const candidateTokens = new Set(getLookupTokens(normalizedCandidate))

    labelTokens.forEach((token) => {
        if (candidateTokens.has(token)) {
            score += 3
        }
    })

    return score
}

function buildQuestionLinkIntent(question = '') {
    const normalized = normalizeQuestionText(question)

    return {
        normalized,
        wantsLink: /\blink\b|\burl\b|\bduong dan\b/.test(normalized),
        wantsGuide: /\bhuong dan\b|\btai lieu\b|\bmanual\b/.test(normalized),
        wantsRules: /\bthe le\b|\bquy dinh\b/.test(normalized),
        wantsRegister: /\bdang ky\b/.test(normalized),
        wantsHandbook: /\bso tay\b/.test(normalized),
        wantsArena: /\bfile in\b|\bsa ban\b/.test(normalized),
    }
}

function scoreCatalogLinkForQuestion(link, intent) {
    let score = 0

    if (!link) return score

    if (intent.wantsGuide && link.type === 'guide') score += 10
    if (intent.wantsRules && link.type === 'rules') score += 10
    if (intent.wantsRegister && link.type === 'register') score += 10
    if (intent.wantsHandbook && link.type === 'handbook') score += 10
    if (intent.wantsArena && link.type === 'arena') score += 10
    if (intent.wantsLink && link.type !== 'page') score += 2

    const questionTokens = new Set(getLookupTokens(intent.normalized))
    const labelTokens = getLookupTokens(link.label)
    const pageTokens = getLookupTokens(link.pageTitle)

    labelTokens.forEach((token) => {
        if (questionTokens.has(token)) score += 2
    })

    pageTokens.forEach((token) => {
        if (questionTokens.has(token)) score += 1
    })

    return score
}

function getRelevantCatalogLinks(question, linkCatalog = [], limit = 3) {
    const intent = buildQuestionLinkIntent(question)

    return linkCatalog
        .map((link) => ({
            ...link,
            questionScore: scoreCatalogLinkForQuestion(link, intent),
        }))
        .filter((link) => link.questionScore > 0)
        .sort((a, b) => b.questionScore - a.questionScore)
        .slice(0, limit)
}

function findBestLinkByLabel(label, linkCatalog = []) {
    let bestMatch = null
    let bestScore = 0

    linkCatalog.forEach((link) => {
        const score = scoreLabelMatch(label, link.label)
        if (score > bestScore) {
            bestScore = score
            bestMatch = link
        }
    })

    return bestScore >= 3 ? bestMatch : null
}

function sanitizeAnswerLinks(text = '', question = '', linkCatalog = []) {
    if (!text || !linkCatalog.length) {
        return text.trim()
    }

    const allowedUrls = new Set(linkCatalog.map((link) => link.url))
    const prioritizedLinks = getRelevantCatalogLinks(question, linkCatalog, 8)

    return text
        .replace(MARKDOWN_LINK_RE, (_, label, url) => {
            const cleanLabel = label.trim()
            const cleanUrl = url.trim()

            if (allowedUrls.has(cleanUrl)) {
                return `[${cleanLabel}](${cleanUrl})`
            }

            const matchedLink =
                findBestLinkByLabel(cleanLabel, prioritizedLinks) ||
                findBestLinkByLabel(cleanLabel, linkCatalog)

            if (matchedLink) {
                return `[${matchedLink.label}](${matchedLink.url})`
            }

            return cleanLabel
        })
        .trim()
}

function hasAllowedMarkdownLink(text = '', linkCatalog = []) {
    if (!text || !linkCatalog.length) return false

    const allowedUrls = new Set(linkCatalog.map((link) => link.url))

    return extractMarkdownLinks(text).some((link) => allowedUrls.has(link.url))
}

function ensureRelevantLinks(text = '', question = '', linkCatalog = []) {
    const intent = buildQuestionLinkIntent(question)

    if (
        !intent.wantsLink &&
        !intent.wantsGuide &&
        !intent.wantsRules &&
        !intent.wantsRegister &&
        !intent.wantsHandbook &&
        !intent.wantsArena
    ) {
        return text.trim()
    }

    if (hasAllowedMarkdownLink(text, linkCatalog)) {
        return text.trim()
    }

    const relevantLinks = getRelevantCatalogLinks(question, linkCatalog, 3)
    if (!relevantLinks.length) {
        return text.trim()
    }

    const linkLines = relevantLinks.map(
        (link) => `- [${link.label}](${link.url})`
    )

    return `${text.trim()}\n\nLink dung trong wiki:\n${linkLines.join('\n')}`.trim()
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

function formatAiText(rawText = '', questionText = '', linkCatalog = []) {
    let text = stripThinkingBlocks(rawText)
    text = stripToolMarkup(text)

    if (isDefinitionQuestion(questionText)) {
        text = trimDefinitionAnswer(text)
    }

    text = sanitizeAnswerLinks(text, questionText, linkCatalog)
    text = ensureRelevantLinks(text, questionText, linkCatalog)

    return text.trim()
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

function addSystemReminder(messages, reminder) {
    if (!reminder) return messages

    const [firstMessage, ...remainingMessages] = messages
    if (firstMessage?.role !== 'system') {
        return [{ role: 'system', content: reminder }, ...messages]
    }

    return [
        firstMessage,
        { role: 'system', content: reminder },
        ...remainingMessages,
    ]
}

async function requestMiniMax({ minimaxApiKey, messages, signal }) {
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

    return data
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
        const relevantPages = searchWikiContext(searchQuery, 3)
        const wikiContext = buildContextStringFromPages(relevantPages)
        const linkCatalog = buildLinkCatalog(relevantPages)
        const allowedLinksBlock = buildAllowedLinksBlock(linkCatalog)

        const systemContent = `${SYSTEM_PROMPT}\n\n${TOOL_RETRY_PROMPT}\n\n${LINK_ONLY_PROMPT}\n\n--- DANH SACH LINK HOP LE ---\n${allowedLinksBlock}\n--- HET DANH SACH LINK HOP LE ---\n\n--- NOI DUNG WIKI LIEN QUAN ---\n${wikiContext || 'Khong tim thay tai lieu wiki lien quan truc tiep.'}\n--- HET NOI DUNG WIKI ---`

        const messages = [
            {
                role: 'system',
                content: `${SYSTEM_PROMPT}\n\n${TOOL_RETRY_PROMPT}\n\n--- NỘI DUNG WIKI LIÊN QUAN ---\n${wikiContext || 'Không tìm thấy tài liệu wiki liên quan trực tiếp.'}\n--- HẾT NỘI DUNG WIKI ---`,
            },
            ...lastMessages,
            { role: 'user', content: questionText },
        ]
        messages[0].content = systemContent

        const { signal, cleanup } = createTimeoutController(MINIMAX_TIMEOUT_MS)

        try {
            const data = await requestMiniMax({
                minimaxApiKey,
                messages,
                signal,
            })

            const rawText = extractMiniMaxContent(data)
            let text = formatAiText(rawText, questionText, linkCatalog)

            if (containsToolMarkup(rawText) || !text) {
                const retryData = await requestMiniMax({
                    minimaxApiKey,
                    messages: addSystemReminder(
                        addSystemReminder(messages, LINK_ONLY_PROMPT),
                        TOOL_RETRY_PROMPT
                    ),
                    signal,
                })
                const retriedText = formatAiText(
                    extractMiniMaxContent(retryData),
                    questionText,
                    linkCatalog
                )

                if (retriedText) {
                    text = retriedText
                }
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
