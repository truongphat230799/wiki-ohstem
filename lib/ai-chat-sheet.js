import crypto from 'crypto'

const DEFAULT_TIMEOUT_MS = 8000

function parseTimeoutMs(rawValue, fallbackValue = DEFAULT_TIMEOUT_MS) {
    const parsed = Number.parseInt(rawValue ?? '', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue
}

function truncateText(text = '', limit = 1000) {
    if (!text || text.length <= limit) {
        return text
    }

    return `${text.slice(0, limit).trim()}...`
}

function getWebhookConfig() {
    return {
        url: process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim() || '',
        secret: process.env.GOOGLE_SHEETS_WEBHOOK_SECRET?.trim() || '',
        timeoutMs: parseTimeoutMs(process.env.GOOGLE_SHEETS_WEBHOOK_TIMEOUT_MS),
    }
}

export function createAiChatEntry(payload = {}) {
    const now = new Date().toISOString()

    return {
        id: payload.id || crypto.randomUUID(),
        sessionId: payload.sessionId || crypto.randomUUID(),
        question: payload.question || '',
        answer: payload.answer || '',
        answerPreview: truncateText(payload.answer || '', 240),
        pagePath: payload.pagePath || '',
        pageTitle: payload.pageTitle || '',
        hasImage: Boolean(payload.hasImage),
        imageName: payload.imageName || '',
        imageMimeType: payload.imageMimeType || '',
        historyLength: Number.isFinite(payload.historyLength) ? payload.historyLength : 0,
        provider: payload.provider || '',
        productCategory: payload.productCategory || '',
        productLabel: payload.productLabel || '',
        topicCategory: payload.topicCategory || '',
        topicLabel: payload.topicLabel || '',
        classificationTags: payload.classificationTags || '',
        classificationConfidence: payload.classificationConfidence || '',
        classificationSource: payload.classificationSource || '',
        satisfaction: payload.satisfaction ?? null,
        feedbackNote: payload.feedbackNote || '',
        createdAt: payload.createdAt || now,
        updatedAt: payload.updatedAt || now,
    }
}

export function createAiChatFeedbackEntry({
    messageId,
    sessionId,
    satisfaction,
    note,
    productCategory,
    productLabel,
    topicCategory,
    topicLabel,
    classificationTags,
    classificationConfidence,
    classificationSource,
} = {}) {
    const now = new Date().toISOString()

    return {
        id: messageId || crypto.randomUUID(),
        sessionId: sessionId || '',
        productCategory: productCategory || '',
        productLabel: productLabel || '',
        topicCategory: topicCategory || '',
        topicLabel: topicLabel || '',
        classificationTags: classificationTags || '',
        classificationConfidence: classificationConfidence || '',
        classificationSource: classificationSource || '',
        satisfaction:
            satisfaction === 'up' || satisfaction === 'down' ? satisfaction : null,
        feedbackNote: typeof note === 'string' ? note.trim() : '',
        updatedAt: now,
    }
}

function buildPayload(entry = {}, eventType = 'chat_entry') {
    const now = new Date().toISOString()

    return {
        source: 'ohstem-wiki-ai-chat',
        eventType,
        sentAt: now,
        id: entry.id || '',
        sessionId: entry.sessionId || '',
        pagePath: entry.pagePath || '',
        pageTitle: entry.pageTitle || '',
        question: entry.question || '',
        answerPreview: entry.answerPreview || truncateText(entry.answer || '', 240),
        answer: truncateText(entry.answer || '', 2000),
        hasImage: Boolean(entry.hasImage),
        imageName: entry.imageName || '',
        imageMimeType: entry.imageMimeType || '',
        historyLength: Number.isFinite(entry.historyLength) ? entry.historyLength : 0,
        provider: entry.provider || '',
        productCategory: entry.productCategory || '',
        productLabel: entry.productLabel || '',
        topicCategory: entry.topicCategory || '',
        topicLabel: entry.topicLabel || '',
        classificationTags: entry.classificationTags || '',
        classificationConfidence: entry.classificationConfidence || '',
        classificationSource: entry.classificationSource || '',
        satisfaction: entry.satisfaction ?? '',
        feedbackNote: entry.feedbackNote || '',
        createdAt: entry.createdAt || now,
        updatedAt: entry.updatedAt || now,
    }
}

function buildHeaders({ body, eventType, secret }) {
    const headers = {
        'Content-Type': 'application/json',
        'X-OhStem-Event': eventType,
    }

    if (!secret) {
        return headers
    }

    headers.Authorization = `Bearer ${secret}`
    headers['X-OhStem-Signature'] = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex')

    return headers
}

export function isGoogleSheetsWebhookConfigured() {
    const { url } = getWebhookConfig()
    return Boolean(url)
}

export async function sendAiChatEventToSheet({
    entry = {},
    eventType = 'chat_entry',
} = {}) {
    const { url, secret, timeoutMs } = getWebhookConfig()

    if (!url) {
        return { ok: false, skipped: true, reason: 'missing_webhook_url' }
    }

    const payload = buildPayload(entry, eventType)
    const body = JSON.stringify(payload)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: buildHeaders({ body, eventType, secret }),
            body,
            signal: controller.signal,
            cache: 'no-store',
        })

        const responseText = await response.text().catch(() => '')
        let responseJson = null

        if (responseText) {
            try {
                responseJson = JSON.parse(responseText)
            } catch {}
        }

        if (!response.ok) {
            throw new Error(
                `Webhook Google Sheet tra ve ${response.status}${responseText ? `: ${truncateText(responseText, 200)}` : ''}`
            )
        }

        if (responseJson && responseJson.ok === false) {
            throw new Error(
                `Webhook Google Sheet bao loi${responseJson.error ? `: ${truncateText(responseJson.error, 200)}` : '.'}`
            )
        }

        return { ok: true }
    } catch (error) {
        console.warn(
            '[ai-chat-sheet] Khong the gui log sang Google Sheet:',
            error?.message || error
        )

        return {
            ok: false,
            error: error?.message || String(error),
        }
    } finally {
        clearTimeout(timeoutId)
    }
}

export function sendAiChatEntryToSheet(entry = {}) {
    return sendAiChatEventToSheet({
        entry,
        eventType: 'chat_entry',
    })
}

export function sendAiChatFeedbackToSheet(entry = {}) {
    return sendAiChatEventToSheet({
        entry,
        eventType: 'feedback_updated',
    })
}
