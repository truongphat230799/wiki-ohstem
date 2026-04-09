import { GoogleGenAI, createPartFromBase64 } from '@google/genai'
import { searchWikiContext } from '../../../../lib/wiki-context.js'
import {
    createAiChatEntry,
    sendAiChatEntryToSheet,
} from '../../../../lib/ai-chat-sheet.js'
import { classifyAiChatQuestion } from '../../../../lib/ai-chat-classify.js'

const MINIMAX_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2'
const DEFAULT_MINIMAX_MODEL = process.env.MINIMAX_MODEL?.trim() || 'MiniMax-M2.5'
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
const AI_TIMEOUT_MS = parseTimeoutMs(process.env.MINIMAX_TIMEOUT_MS, 40000)
const THINKING_BLOCK_RE = /<think>[\s\S]*?(<\/think>|$)/gi
const TOOL_BLOCK_RE = /<tool_code>[\s\S]*?(<\/tool_code>|$)/gi
const TOOL_TAG_RE = /<\/?(tool_code|tool|param)\b[^>]*>/gi
const MARKDOWN_LINK_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/g
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g
const HEADING_RE = /^#{1,6}\s+(.+)$/

const LINK_ONLY_PROMPT = `Neu can dua link thi chi duoc dung URL co trong DANH SACH LINK HOP LE.
Tuyet doi khong tu tao, khong sua, khong rut gon URL.
Neu wiki khong co link phu hop thi noi ro la chua thay link tuong ung trong tai lieu.`

const TOOL_RETRY_PROMPT = `Ban khong co quyen dung tool, function calling, XML tags, hay truy cap Internet.
Tuyet doi khong tra ve cac tag nhu <tool_code>, <tool>, <param> hoac JSON/XML de goi cong cu.
Hay tra loi truc tiep cho nguoi dung bang tieng Viet dua tren noi dung wiki da duoc cung cap.`

const SYSTEM_PROMPT = `Bạn là trợ lý AI của OhStem Education.

NHIỆM VỤ:
- Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu.
- Ưu tiên trả lời dựa trên nội dung wiki đã được cung cấp bên dưới. Đọc kỹ toàn bộ nội dung wiki trước khi trả lời.
- Giữ đúng ngữ cảnh hội thoại trước đó nếu câu hỏi là câu nối tiếp.
- Nếu nội dung wiki có liên quan đến câu hỏi (dù chỉ một phần), hãy trích dẫn và trả lời dựa trên đó. Đính kèm link trang wiki tương ứng để người dùng đọc thêm.
- CHỈ KHI nội dung wiki THỰC SỰ không chứa bất kỳ thông tin nào liên quan, mới nói rằng chưa có đủ thông tin và gợi ý liên hệ support@ohstem.vn.
- Nếu người dùng gửi kèm hình ảnh, hãy mô tả ngắn những gì bạn nhìn thấy và kết hợp với tài liệu wiki để hỗ trợ.

HÌNH ẢNH MINH HỌA:
- Trong nội dung wiki có chứa các đường dẫn hình ảnh dạng ![mô tả](/images/...).
- Khi hướng dẫn từng bước, hãy CHÈN hình ảnh minh họa NGAY TẠI BƯỚC đó bằng cú pháp: ![mô tả](đường dẫn hình)
- Ví dụ: Khi hướng dẫn kết nối phần cứng, chèn ![Sơ đồ kết nối](/images/yolo_uno/.../ket_noi.png) ngay sau đoạn mô tả.
- Chỉ chèn hình có trong nội dung wiki, KHÔNG bịa link hình.
- Ưu tiên chèn 1-3 hình quan trọng nhất (sơ đồ kết nối, chương trình mẫu).

QUY TẮC:
1. Không bịa link, chỉ dùng link có trong danh sách link hợp lệ.
2. Không trả về XML/JSON/tool call.
3. Khi phù hợp, có thể dùng markdown đơn giản như danh sách hoặc in đậm.
4. Nếu không chắc về nội dung trong ảnh, phải nói rõ đó là suy luận từ hình ảnh.
5. TUYỆT ĐỐI KHÔNG nói "không tìm thấy hướng dẫn" hoặc "chưa có tài liệu" khi phần NOI DUNG WIKI LIEN QUAN bên dưới có chứa thông tin liên quan đến câu hỏi.`

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

function stripAiArtifacts(text = '') {
    return text
        .replace(THINKING_BLOCK_RE, '')
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
        deduped.set(`${page.title}::${page.path}`, {
            label: page.title,
            url: page.path,
            pageTitle: page.title,
            pageUrl: page.path,
            type: 'page',
        })

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

function cleanImageText(text = '') {
    return text
        .replace(/[*_`>#]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function truncateInlineText(text = '', limit = 140) {
    if (!text || text.length <= limit) {
        return text
    }

    return `${text.slice(0, limit).trim()}...`
}

function looksGenericImageLabel(text = '') {
    const normalized = normalizeLookupText(text)

    if (!normalized) return true
    if (/^\d+(?:\s+\d+)*$/.test(normalized)) return true

    return [
        'image',
        'img',
        'hinh',
        'anh',
        'photo',
        'screenshot',
    ].includes(normalized)
}

function buildVisualQuestionProfile(question = '') {
    const normalized = normalizeLookupText(question)
    const hasExplicitImageRequest =
        /\bhinh\b|\banh\b|\bminh hoa\b|\bshow\b|\bxem hinh\b|\bgui hinh\b/.test(
            normalized
        )
    const wantsConnectionVisual =
        /\bket noi\b|\bnoi day\b|\bso do\b|\bcach cam\b|\bcam day\b|\bcam vao\b/.test(
            normalized
        )
    const wantsAssemblyVisual =
        /\bcach lap\b|\blap rap\b|\blap dat\b|\bcau tao\b/.test(normalized)
    const wantsCodeVisual =
        /\bcode mau\b|\bchuong trinh mau\b|\bblock\b|\bkhoi lenh\b/.test(
            normalized
        )
    const wantsUiVisual =
        /\bgiao dien\b|\bman hinh\b|\bmenu\b|\bnut nao\b|\bchon muc nao\b/.test(
            normalized
        )

    return {
        normalized,
        hasExplicitImageRequest,
        wantsConnectionVisual,
        wantsAssemblyVisual,
        wantsCodeVisual,
        wantsUiVisual,
        wantsVisualAnswer:
            hasExplicitImageRequest ||
            wantsConnectionVisual ||
            wantsAssemblyVisual ||
            wantsCodeVisual ||
            wantsUiVisual,
    }
}

function questionWantsVisualAnswer(question = '') {
    return buildVisualQuestionProfile(question).wantsVisualAnswer
}

function extractHtmlImageAttributes(tag = '') {
    const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i)
    const altMatch = tag.match(/\balt=["']([^"']*)["']/i)
    const titleMatch = tag.match(/\btitle=["']([^"']*)["']/i)

    return {
        src: srcMatch?.[1]?.trim() || '',
        alt: altMatch?.[1]?.trim() || '',
        title: titleMatch?.[1]?.trim() || '',
    }
}

function createImageCandidate({
    src = '',
    alt = '',
    title = '',
    sectionTitle = '',
    contextText = '',
    page = {},
    pageIndex = 0,
}) {
    const cleanSrc = src.trim()
    if (!cleanSrc) return null

    const cleanAlt = cleanImageText(alt)
    const cleanTitle = cleanImageText(title)
    const cleanSectionTitle = cleanImageText(sectionTitle)
    const cleanContextText = cleanImageText(contextText)
    const fallbackCaption = [cleanSectionTitle, cleanContextText, page.title]
        .filter(Boolean)
        .find((value) => !looksGenericImageLabel(value))

    const caption = !looksGenericImageLabel(cleanAlt)
        ? cleanAlt
        : !looksGenericImageLabel(cleanTitle)
          ? cleanTitle
          : fallbackCaption || page.title || 'Hinh minh hoa'

    return {
        src: cleanSrc,
        alt: truncateInlineText(!looksGenericImageLabel(cleanAlt) ? cleanAlt : caption, 120),
        caption: truncateInlineText(caption, 140),
        sectionTitle: truncateInlineText(cleanSectionTitle, 120),
        contextText: truncateInlineText(cleanContextText, 140),
        pageTitle: truncateInlineText(page.title || '', 100),
        pageUrl: page.path || '',
        pageIndex,
    }
}

function extractImageCandidatesFromPage(page = {}, pageIndex = 0) {
    const lines = String(page.content || '').split(/\r?\n/)
    const candidates = []
    let currentHeading = page.title || ''
    let previousText = ''

    lines.forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed) {
            return
        }

        const headingMatch = trimmed.match(HEADING_RE)
        if (headingMatch) {
            currentHeading = cleanImageText(headingMatch[1])
            previousText = currentHeading
            return
        }

        for (const match of trimmed.matchAll(
            new RegExp(MARKDOWN_IMAGE_RE.source, MARKDOWN_IMAGE_RE.flags)
        )) {
            const candidate = createImageCandidate({
                src: match[2],
                alt: match[1],
                title: match[3] || '',
                sectionTitle: currentHeading,
                contextText: previousText,
                page,
                pageIndex,
            })

            if (candidate) {
                candidates.push(candidate)
            }
        }

        for (const match of trimmed.matchAll(/<img\b[^>]*>/gi)) {
            const attributes = extractHtmlImageAttributes(match[0])
            const candidate = createImageCandidate({
                ...attributes,
                sectionTitle: currentHeading,
                contextText: previousText,
                page,
                pageIndex,
            })

            if (candidate) {
                candidates.push(candidate)
            }
        }

        if (!/!\[[^\]]*\]\([^)]+\)/.test(trimmed) && !/<img\b/i.test(trimmed)) {
            previousText = cleanImageText(trimmed)
        }
    })

    return candidates
}

function evaluateImageCandidate(candidate = {}, question = '') {
    const profile = buildVisualQuestionProfile(question)
    const questionTokens = new Set(getLookupTokens(question))
    const haystack = normalizeLookupText(
        [
            candidate.caption,
            candidate.alt,
            candidate.sectionTitle,
            candidate.contextText,
            candidate.pageTitle,
            candidate.pageUrl,
        ].join(' ')
    )
    const hasSpecificCaption = !looksGenericImageLabel(candidate.caption)
    let tokenOverlapCount = 0

    questionTokens.forEach((token) => {
        if (haystack.includes(token)) {
            tokenOverlapCount += 1
        }
    })

    const matchesConnectionVisual =
        profile.wantsConnectionVisual &&
        /\bket noi\b|\bnoi day\b|\bso do\b|\bcam\b|\bday\b/.test(haystack)
    const matchesAssemblyVisual =
        profile.wantsAssemblyVisual &&
        /\blap rap\b|\blap\b|\bkhung\b|\bco cau\b/.test(haystack)
    const matchesCodeVisual =
        profile.wantsCodeVisual &&
        /\bcode\b|\bchuong trinh\b|\bblock\b|\bkhoi lenh\b/.test(haystack)
    const matchesUiVisual =
        profile.wantsUiVisual &&
        /\bgiao dien\b|\bman hinh\b|\bmenu\b|\bthu vien\b|\bket noi\b/.test(
            haystack
        )
    const themeMatchCount = [
        matchesConnectionVisual,
        matchesAssemblyVisual,
        matchesCodeVisual,
        matchesUiVisual,
    ].filter(Boolean).length

    // Primary page images get much higher base score to prevent cross-page image pollution
    let score = candidate.pageIndex === 0 ? 20 : Math.max(0, 4 - candidate.pageIndex * 2)
    score += tokenOverlapCount * 5
    score += themeMatchCount * 10

    if (hasSpecificCaption) {
        score += 2
    }

    const isStrongMatch =
        score >= (profile.hasExplicitImageRequest ? 16 : 22) &&
        (tokenOverlapCount >= 2 ||
            themeMatchCount >= 1 ||
            (profile.hasExplicitImageRequest &&
                tokenOverlapCount >= 1 &&
                hasSpecificCaption))

    return {
        score,
        tokenOverlapCount,
        themeMatchCount,
        isStrongMatch,
    }
}

function getResponseImages({
    questionText = '',
    relevantPages = [],
    limit = 2,
}) {
    const wantsVisual = questionWantsVisualAnswer(questionText)
    const deduped = new Map()
    const primaryPageUrl = relevantPages[0]?.path || ''

    // Always extract image candidates from at least the primary page
    const pagesToScan = wantsVisual ? relevantPages : relevantPages.slice(0, 1)

    pagesToScan.forEach((page, pageIndex) => {
        extractImageCandidatesFromPage(page, pageIndex).forEach((candidate) => {
            const key = candidate.src
            if (!deduped.has(key)) {
                deduped.set(key, candidate)
            }
        })
    })

    if (deduped.size === 0) return []

    const scored = [...deduped.values()]
        .map((candidate) => ({
            ...candidate,
            ...evaluateImageCandidate(candidate, questionText),
        }))

    if (wantsVisual) {
        // User explicitly wants images — use stricter matching but show results
        return scored
            .filter(
                (candidate) =>
                    candidate.isStrongMatch &&
                    (candidate.pageUrl === primaryPageUrl || candidate.score >= 35)
            )
            .sort((left, right) => right.score - left.score)
            .slice(0, limit)
            .map(({ src, alt, caption, pageTitle, pageUrl }) => ({
                src, alt, caption, pageTitle, pageUrl,
            }))
    }

    // Auto-attach mode: only from primary page, relaxed threshold
    // Pick images that have meaningful keyword overlap with the question
    const autoImages = scored
        .filter((candidate) => {
            // Only primary page images
            if (candidate.pageUrl !== primaryPageUrl) return false
            // Must have at least 1 keyword overlap
            if (candidate.tokenOverlapCount < 1) return false
            // Must have a specific caption (not generic "hinh 1" etc.)
            if (looksGenericImageLabel(candidate.caption) && candidate.tokenOverlapCount < 2) return false
            // Reasonable score threshold for auto-attach
            return candidate.score >= 18
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map(({ src, alt, caption, pageTitle, pageUrl }) => ({
            src, alt, caption, pageTitle, pageUrl,
        }))

    return autoImages
}

function encodeHeaderPayload(value) {
    if (!value) return ''

    try {
        return encodeURIComponent(JSON.stringify(value))
    } catch {
        return ''
    }
}

function getLookupTokens(text = '') {
    return normalizeLookupText(text)
        .split(/\s+/)
        .filter((token) => token.length > 1)
}

function buildQuestionLinkIntent(question = '') {
    const normalized = normalizeLookupText(question)
    const wantsLink = /\blink\b|\burl\b|\bduong dan\b/.test(normalized)
    const wantsGuide = /\bhuong dan\b|\btai lieu\b|\bmanual\b/.test(normalized)
    const wantsRules = /\bthe le\b|\bquy dinh\b/.test(normalized)
    const wantsRegister = /\bdang ky\b/.test(normalized)
    const wantsHandbook = /\bso tay\b/.test(normalized)
    const wantsArena = /\bfile in\b|\bsa ban\b/.test(normalized)
    const wantsResourceLink =
        wantsLink ||
        /\bpdf\b|\bvideo\b|\bcanva\b|\byoutube\b|\bdrive\b/.test(normalized) ||
        /\bduong link\b|\bduong dan\b|\blink tai lieu\b|\blink video\b/.test(normalized) ||
        (/\btai lieu\b|\bmanual\b/.test(normalized) && /\bxem\b|\bgui\b|\bcho\b|\bmo\b/.test(normalized))

    return {
        normalized,
        wantsLink,
        wantsGuide,
        wantsRules,
        wantsRegister,
        wantsHandbook,
        wantsArena,
        wantsResourceLink,
    }
}

function scoreCatalogLinkForQuestion(link, intent) {
    let score = 0

    if (intent.wantsGuide && link.type === 'guide') score += 10
    if (intent.wantsRules && link.type === 'rules') score += 10
    if (intent.wantsRegister && link.type === 'register') score += 10
    if (intent.wantsHandbook && link.type === 'handbook') score += 10
    if (intent.wantsArena && link.type === 'arena') score += 10
    if (intent.wantsLink && link.type !== 'page') score += 2

    const questionTokens = new Set(getLookupTokens(intent.normalized))

    getLookupTokens(link.label).forEach((token) => {
        if (questionTokens.has(token)) score += 2
    })

    getLookupTokens(link.pageTitle).forEach((token) => {
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
        !intent.wantsResourceLink &&
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

    const relevantLinks = getRelevantCatalogLinks(question, linkCatalog, 2)
    if (!relevantLinks.length) {
        return text.trim()
    }

    const linkLines = relevantLinks.map(
        (link) => `- [${link.label}](${link.url})`
    )

    return `${text.trim()}\n\nLink dung trong wiki:\n${linkLines.join('\n')}`.trim()
}

function formatAiText(rawText = '', questionText = '', linkCatalog = []) {
    let text = stripAiArtifacts(rawText)
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

function normalizeQuestionText(text = '') {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/\u0111/g, 'd')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
}

const SPECIFIC_PRODUCT_CATEGORIES = new Set([
    'rover',
    'rover_orc_junior',
    'orc_k2',
    'orc_k3',
    'yolo_uno',
    'yolobit',
    'ohstem_app',
    'green_house',
    'smart_home',
    'thanh_pho_thong_minh',
    'thung_rac',
])

const DEVICE_OR_SUPPORT_TAGS = new Set([
    'motion_kit',
    'servo',
    'dong_co',
    'encoder',
    'gamepad',
    'control_hub',
    'cam_bien',
    'cam_bien_goc',
    'do_line',
    'sieu_am',
    'bluetooth',
    'usb',
    'i2c',
    'receiver',
    'button',
    'module',
    'mecanum',
    'ga25',
    'ket_noi',
    'mo_rong',
    'loi',
])

function hasSpecificProductCategory(productCategory = '') {
    return SPECIFIC_PRODUCT_CATEGORIES.has(productCategory)
}

function splitClassificationTags(tagText = '') {
    return String(tagText)
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
}

function classifyQuestionWithHistoryContext({
    questionText = '',
    lastMessages = [],
    pagePath = '',
    pageTitle = '',
} = {}) {
    const directClassification = classifyAiChatQuestion({
        question: questionText,
        pagePath,
        pageTitle,
        relevantPages: [],
    })

    if (hasSpecificProductCategory(directClassification.productCategory)) {
        return directClassification
    }

    const recentUserMessages = lastMessages
        .filter((message) => message.role === 'user')
        .slice(-2)
        .map((message) => message.content.trim())
        .filter(Boolean)

    if (!recentUserMessages.length) {
        return directClassification
    }

    const historyAwareClassification = classifyAiChatQuestion({
        question: [...recentUserMessages, questionText].join('\n'),
        pagePath,
        pageTitle,
        relevantPages: [],
    })

    return hasSpecificProductCategory(historyAwareClassification.productCategory)
        ? historyAwareClassification
        : directClassification
}

function shouldAskForProductClarification({
    questionText = '',
    imagePayload = null,
    classification = null,
} = {}) {
    if (!classification || hasSpecificProductCategory(classification.productCategory)) {
        return false
    }

    const normalizedQuestion = normalizeQuestionText(questionText)
    const tags = new Set(splitClassificationTags(classification.classificationTags))
    const isErrorQuestion =
        classification.topicCategory === 'loi_su_co' ||
        /\bloi\b|\bbao loi\b|\btruc trac\b|\bsu co\b|\bkhong chay\b|\bkhong ket noi\b|\bkhong nap duoc\b/.test(
            normalizedQuestion
        )
    const isDeviceQuestion =
        [...DEVICE_OR_SUPPORT_TAGS].some((tag) => tags.has(tag)) ||
        /\bthiet bi\b|\bdong co\b|\bservo\b|\bcam bien\b|\bgamepad\b|\btay cam\b|\breceiver\b|\bencoder\b|\bhub\b|\bcontrol hub\b|\bmodule\b|\bmach\b|\bmotion kit\b|\bdo line\b|\bline\b|\bi2c\b|\busb\b|\bbluetooth\b/.test(
            normalizedQuestion
        )

    return isErrorQuestion || isDeviceQuestion || Boolean(imagePayload)
}

function buildProductClarificationText(classification = null) {
    const tags = new Set(splitClassificationTags(classification?.classificationTags))

    if (tags.has('orc_family') || tags.has('control_hub') || tags.has('gamepad')) {
        return 'Để mình khoanh vùng đúng hơn, bạn đang dùng bộ nào: ORC K2, ORC K3 hay Rover ORC Junior? Khi biết đúng bộ, mình sẽ trả lời gọn và đúng tài liệu hơn.'
    }

    if (tags.has('rover_family') || tags.has('do_line')) {
        return 'Để mình hỗ trợ đúng hơn, bạn đang dùng Robot Rover hay Rover ORC Junior? Khi biết đúng bộ, mình sẽ khoanh vùng đúng tài liệu hơn.'
    }

    if (tags.has('module') || tags.has('motion_kit') || tags.has('servo')) {
        return 'Để mình hỗ trợ đúng hơn, bạn đang gắn thiết bị này trên bộ nào? Ví dụ: Robot Rover, Rover ORC Junior, ORC K2, ORC K3, Yolo:Bit hay Yolo UNO.'
    }

    return 'Để mình khoanh vùng đúng hơn, bạn đang dùng sản phẩm nào? Ví dụ: Robot Rover, Rover ORC Junior, ORC K2, ORC K3, Yolo:Bit hay Yolo UNO.'
}

function isContextDependentQuestion(question = '') {
    const normalized = normalizeQuestionText(question)

    return (
        /^(no|cai do|cai nay|vay con|the con|them nua|chi tiet hon)\b/.test(normalized) ||
        /\b(no|cai do|cai nay|vay con|the con)\b/.test(normalized)
    )
}

function buildSearchQuery(questionText, history) {
    const userHistory = history.filter((msg) => msg.role === 'user')

    if (!userHistory.length || !isContextDependentQuestion(questionText)) {
        return questionText
    }

    return [...userHistory.slice(-2).map((msg) => msg.content), questionText].join('\n')
}

function buildSupplementalSearchQueries(questionText, classification = null) {
    const queries = [questionText]

    if (classification?.productLabel && classification.productLabel !== 'Khac') {
        queries.push(`${questionText}\n${classification.productLabel}`)
    }

    if (classification?.topicLabel && classification.topicLabel !== 'Khac') {
        queries.push(`${questionText}\n${classification.topicLabel}`)
    }

    const tagQuery = splitClassificationTags(
        classification?.classificationTags || ''
    )
        .filter((tag) => !['loi_su_co', 'lap_trinh', 'lap_rap'].includes(tag))
        .slice(0, 4)
        .map((tag) => tag.replace(/_/g, ' '))
        .join(' ')

    if (tagQuery) {
        queries.push(`${questionText}\n${tagQuery}`)
    }

    return [...new Set(queries.map((query) => query.trim()).filter(Boolean))]
}

function collectRelevantPages(queries = [], topKPerQuery = 3, overallLimit = 5) {
    const dedupedPages = new Map()

    queries.forEach((query) => {
        searchWikiContext(query, topKPerQuery).forEach((page) => {
            if (!dedupedPages.has(page.path)) {
                dedupedPages.set(page.path, page)
            }
        })
    })

    return [...dedupedPages.values()].slice(0, overallLimit)
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

function normalizeImagePayload(image) {
    if (!image || typeof image !== 'object') return null

    const data = typeof image.data === 'string' ? image.data.trim() : ''
    const mimeType = typeof image.mimeType === 'string' ? image.mimeType.trim() : ''
    const name = typeof image.name === 'string' ? image.name.trim() : ''

    if (!data || !mimeType) {
        return null
    }

    return { data, mimeType, name }
}

function buildConversationTranscript(messages = []) {
    return messages
        .map((message) => {
            const speaker = message.role === 'assistant' ? 'AI' : 'Người dùng'
            return `${speaker}: ${message.content}`
        })
        .join('\n')
}

async function withTimeout(promiseFactory, timeoutMs, timeoutMessage) {
    let timeoutId

    try {
        return await Promise.race([
            promiseFactory(),
            new Promise((_, reject) => {
                timeoutId = setTimeout(
                    () => reject(new Error(timeoutMessage)),
                    timeoutMs
                )
            }),
        ])
    } finally {
        clearTimeout(timeoutId)
    }
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

async function requestGeminiVision({
    geminiApiKey,
    questionText,
    image,
    lastMessages,
    wikiContext,
    allowedLinksBlock,
}) {
    if (false) return withTimeout(
        () =>
            requestMiniMaxVision({
                minimaxApiKey: geminiApiKey,
                questionText,
                image,
                lastMessages,
                wikiContext,
                allowedLinksBlock,
            }),
        AI_TIMEOUT_MS,
        `MiniMax pháº£n há»“i quÃ¡ lÃ¢u (${Math.round(AI_TIMEOUT_MS / 1000)} giÃ¢y).`
    )

    const ai = new GoogleGenAI({ apiKey: geminiApiKey })
    const historyText = buildConversationTranscript(lastMessages)
    const prompt = `${SYSTEM_PROMPT}

${TOOL_RETRY_PROMPT}

${LINK_ONLY_PROMPT}

--- DANH SACH LINK HOP LE ---
${allowedLinksBlock}
--- HET DANH SACH LINK HOP LE ---

--- LICH SU HOI THOAI ---
${historyText || 'Chua co lich su hoi thoai truoc do.'}
--- HET LICH SU HOI THOAI ---

--- NOI DUNG WIKI LIEN QUAN ---
${wikiContext || 'Khong tim thay tai lieu wiki lien quan truc tiep.'}
--- HET NOI DUNG WIKI ---

--- YEU CAU HIEN TAI ---
${questionText}

Hinh anh dinh kem la mot phan cua yeu cau. Neu can, hay mo ta ngan gon dieu ban nhin thay trong anh va lien he voi noi dung wiki. Neu khong chac chan, hay noi ro do la suy luan tu hinh anh.`

    const response = await withTimeout(
        () =>
            ai.models.generateContent({
                model: DEFAULT_GEMINI_MODEL,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt },
                            createPartFromBase64(image.data, image.mimeType),
                        ],
                    },
                ],
            }),
        AI_TIMEOUT_MS,
        `Gemini phản hồi quá lâu (${Math.round(AI_TIMEOUT_MS / 1000)} giây).`
    )

    return response?.text || ''
}

async function requestMiniMaxVision({
    minimaxApiKey,
    questionText,
    image,
    lastMessages,
    wikiContext,
    allowedLinksBlock,
}) {
    const historyText = buildConversationTranscript(lastMessages)
    const prompt = `${SYSTEM_PROMPT}

${TOOL_RETRY_PROMPT}

${LINK_ONLY_PROMPT}

--- DANH SACH LINK HOP LE ---
${allowedLinksBlock}
--- HET DANH SACH LINK HOP LE ---

--- LICH SU HOI THOAI ---
${historyText || 'Chua co lich su hoi thoai truoc do.'}
--- HET LICH SU HOI THOAI ---

--- NOI DUNG WIKI LIEN QUAN ---
${wikiContext || 'Khong tim thay tai lieu wiki lien quan truc tiep.'}
--- HET NOI DUNG WIKI ---

--- YEU CAU HIEN TAI ---
${questionText}

Hinh anh dinh kem la mot phan cua yeu cau. Neu can, hay mo ta ngan gon dieu ban nhin thay trong anh va lien he voi noi dung wiki. Neu khong chac chan, hay noi ro do la suy luan tu hinh anh.

Thong tin anh tai len:
- ten tep: ${image.name || 'uploaded-image'}
- dinh dang: ${image.mimeType}

Anh duoc gui kem trong du lieu base64 sau day:
[Image base64:${image.data}]`

    const response = await fetch(MINIMAX_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${minimaxApiKey}`,
        },
        body: JSON.stringify({
            model: DEFAULT_MINIMAX_VISION_MODEL,
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a helpful Vietnamese assistant for OhStem Education. Analyze the uploaded image from the provided base64 content, then answer briefly in Vietnamese based on the wiki context and user question.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            stream: false,
            temperature: 0.3,
            max_completion_tokens: 2048,
        }),
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
                errorText || `MiniMax Vision API Error: ${response.status}`
            )
        )
    }

    const data = await response.json().catch(() => null)
    if (!data || !data.choices?.length) {
        throw new Error('MiniMax khong tra ve du lieu hop le cho yeu cau hinh anh.')
    }

    return extractMiniMaxContent(data)
}

export async function POST(request) {
    try {
        const {
            question,
            history = [],
            image,
            sessionId,
            pagePath = '',
            pageTitle = '',
        } = await request.json()

        const rawQuestionText = typeof question === 'string' ? question.trim() : ''
        const imagePayload = normalizeImagePayload(image)
        const questionText =
            rawQuestionText ||
            (imagePayload
                ? 'Hãy phân tích hình ảnh này và hỗ trợ tôi dựa trên tài liệu wiki.'
                : '')

        if (!questionText) {
            return Response.json(
                { error: 'Vui lòng nhập câu hỏi hoặc gửi kèm hình ảnh.' },
                { status: 400 }
            )
        }

        const lastMessages = normalizeHistory(history)
        const requestSessionId =
            typeof sessionId === 'string' && sessionId.trim()
                ? sessionId.trim()
                : globalThis.crypto?.randomUUID?.() ||
                  `${Date.now()}-${Math.random().toString(36).slice(2)}`
        const preliminaryClassification = classifyQuestionWithHistoryContext({
            questionText,
            lastMessages,
            pagePath,
            pageTitle,
        })

        if (
            shouldAskForProductClarification({
                questionText,
                imagePayload,
                classification: preliminaryClassification,
            })
        ) {
            const clarificationText = buildProductClarificationText(
                preliminaryClassification
            )
            const clarificationEntry = createAiChatEntry({
                sessionId: requestSessionId,
                question: questionText,
                answer: clarificationText,
                pagePath,
                pageTitle,
                hasImage: Boolean(imagePayload),
                imageName: imagePayload?.name || '',
                imageMimeType: imagePayload?.mimeType || '',
                historyLength: lastMessages.length,
                provider: 'rule_clarifier',
                ...preliminaryClassification,
            })
            const sheetSyncResult = await sendAiChatEntryToSheet(
                clarificationEntry
            )
            const encodedClassification = encodeHeaderPayload(
                preliminaryClassification
            )
            const responseHeaders = {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache, no-store',
                'X-AI-Provider': 'rule_clarifier',
                'X-Chat-Message-Id': clarificationEntry.id,
                'X-Chat-Session-Id': clarificationEntry.sessionId,
                'X-Chat-Sheet-Sync': sheetSyncResult?.ok ? 'ok' : 'error',
            }

            if (!sheetSyncResult?.ok && sheetSyncResult?.error) {
                responseHeaders['X-Chat-Sheet-Error'] = encodeURIComponent(
                    sheetSyncResult.error
                )
            }

            if (encodedClassification) {
                responseHeaders['X-Chat-Classification'] = encodedClassification
            }

            return new Response(clarificationText, {
                headers: responseHeaders,
            })
        }

        const searchQuery = buildSearchQuery(questionText, lastMessages)
        const searchQueries = buildSupplementalSearchQueries(
            searchQuery,
            preliminaryClassification
        )
        const relevantPages = collectRelevantPages(searchQueries, 3, 5)
        const wikiContext = buildContextStringFromPages(relevantPages)
        const linkCatalog = buildLinkCatalog(relevantPages)
        const allowedLinksBlock = buildAllowedLinksBlock(linkCatalog)
        const systemContent = `${SYSTEM_PROMPT}\n\n${TOOL_RETRY_PROMPT}\n\n${LINK_ONLY_PROMPT}\n\n--- DANH SACH LINK HOP LE ---\n${allowedLinksBlock}\n--- HET DANH SACH LINK HOP LE ---\n\n--- NOI DUNG WIKI LIEN QUAN ---\n${wikiContext || 'Khong tim thay tai lieu wiki lien quan truc tiep den cau hoi nay. Hay tra loi dua tren kien thuc chung ve san pham OhStem neu co the, neu khong thi goi y nguoi dung lien he support@ohstem.vn hoac thu hoi cau khac cu the hon.'}\n--- HET NOI DUNG WIKI ---`

        let text = ''
        let provider = 'minimax'
        const responseImages = getResponseImages({
            questionText,
            relevantPages,
        })
        const classification = classifyAiChatQuestion({
            question: questionText,
            pagePath,
            pageTitle,
            relevantPages,
        })
        const minimaxApiKey = process.env.MINIMAX_API_KEY?.trim()

        if (!imagePayload && !minimaxApiKey) {
            return Response.json(
                { error: 'Chua cau hinh MINIMAX_API_KEY. Vui long lien he quan tri vien.' },
                { status: 500 }
            )
        }

        if (false && !minimaxApiKey) {
            return Response.json(
                { error: 'ChÆ°a cáº¥u hÃ¬nh MINIMAX_API_KEY. Vui lÃ²ng liÃªn há»‡ quáº£n trá»‹ viÃªn.' },
                { status: 500 }
            )
        }

        if (imagePayload) {
            const geminiApiKey = process.env.GEMINI_API_KEY?.trim()

            if (!geminiApiKey) {
                return Response.json(
                    { error: 'Chưa cấu hình GEMINI_API_KEY cho tính năng hỏi bằng hình ảnh.' },
                    { status: 500 }
                )
            }

            const rawText = await requestGeminiVision({
                geminiApiKey,
                questionText,
                image: imagePayload,
                lastMessages,
                wikiContext,
                allowedLinksBlock,
            })

            text = formatAiText(rawText, questionText, linkCatalog)
            provider = 'gemini'
        } else {
            const minimaxApiKey = process.env.MINIMAX_API_KEY?.trim()

            if (!minimaxApiKey) {
                return Response.json(
                    { error: 'Chưa cấu hình MINIMAX_API_KEY. Vui lòng liên hệ quản trị viên.' },
                    { status: 500 }
                )
            }

            const messages = [
                { role: 'system', content: systemContent },
                ...lastMessages,
                { role: 'user', content: questionText },
            ]
            const { signal, cleanup } = createTimeoutController(AI_TIMEOUT_MS)

            try {
                const data = await requestMiniMax({
                    minimaxApiKey,
                    messages,
                    signal,
                })

                const rawText = extractMiniMaxContent(data)
                text = formatAiText(rawText, questionText, linkCatalog)

                if ((rawText && rawText.match(TOOL_BLOCK_RE)) || !text) {
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
            } catch (error) {
                if (error?.name === 'AbortError') {
                    throw new Error(
                        `MiniMax phản hồi quá lâu (${Math.round(AI_TIMEOUT_MS / 1000)} giây).`
                    )
                }

                throw error
            } finally {
                cleanup()
            }
        }

        if (!text) {
            throw new Error('AI không trả về nội dung hiển thị.')
        }

        const entry = createAiChatEntry({
            sessionId: requestSessionId,
            question: questionText,
            answer: text,
            pagePath,
            pageTitle,
            hasImage: Boolean(imagePayload),
            imageName: imagePayload?.name || '',
            imageMimeType: imagePayload?.mimeType || '',
            historyLength: lastMessages.length,
            provider,
            ...classification,
        })

        const sheetSyncResult = await sendAiChatEntryToSheet(entry)

        const encodedResponseImages = encodeHeaderPayload(responseImages)
        const encodedClassification = encodeHeaderPayload(classification)
        const responseHeaders = {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache, no-store',
            'X-AI-Provider': provider,
            'X-Chat-Message-Id': entry.id,
            'X-Chat-Session-Id': entry.sessionId,
            'X-Chat-Sheet-Sync': sheetSyncResult?.ok ? 'ok' : 'error',
        }

        if (!sheetSyncResult?.ok && sheetSyncResult?.error) {
            responseHeaders['X-Chat-Sheet-Error'] = encodeURIComponent(
                sheetSyncResult.error
            )
        }

        if (encodedResponseImages) {
            responseHeaders['X-Chat-Response-Images'] = encodedResponseImages
        }

        if (encodedClassification) {
            responseHeaders['X-Chat-Classification'] = encodedClassification
        }

        return new Response(text, {
            headers: responseHeaders,
        })
    } catch (error) {
        console.error('AI API Error:', error.message || error)
        return Response.json(
            { error: error.message || 'Đã xảy ra lỗi khi xử lý câu hỏi.' },
            { status: 500 }
        )
    }
}
