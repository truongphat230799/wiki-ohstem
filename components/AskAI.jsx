'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import './AskAI.css'

function createLocalId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createSessionId() {
    return (
        globalThis.crypto?.randomUUID?.() ||
        `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    )
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Không thể đọc hình ảnh đã chọn.'))
        reader.readAsDataURL(file)
    })
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Không thể xử lý hình ảnh đã chọn.'))
        img.src = src
    })
}

async function prepareImageForUpload(file) {
    const rawDataUrl = await readFileAsDataUrl(file)

    if (file.size <= 1_500_000) {
        return {
            data: String(rawDataUrl).split(',')[1],
            previewUrl: String(rawDataUrl),
            mimeType: file.type || 'image/jpeg',
            name: file.name,
            size: file.size,
        }
    }

    const img = await loadImage(rawDataUrl)
    const maxSide = 1400
    const scale = Math.min(1, maxSide / img.width, maxSide / img.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))

    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(img, 0, 0, canvas.width, canvas.height)

    const outputMime =
        file.type === 'image/png' && file.size < 2_500_000
            ? 'image/png'
            : 'image/jpeg'
    const resizedDataUrl =
        outputMime === 'image/png'
            ? canvas.toDataURL(outputMime)
            : canvas.toDataURL(outputMime, 0.82)

    return {
        data: resizedDataUrl.split(',')[1],
        previewUrl: resizedDataUrl,
        mimeType: outputMime,
        name: file.name,
        size: Math.round((resizedDataUrl.length * 3) / 4),
    }
}

function buildHistoryMessageContent(message) {
    if (typeof message?.content === 'string' && message.content.trim()) {
        return message.content.trim()
    }

    if (message?.imageName) {
        return `[Đã gửi hình ảnh: ${message.imageName}]`
    }

    return ''
}

function parseResponseImagesHeader(headerValue) {
    if (!headerValue) return []

    try {
        const parsed = JSON.parse(decodeURIComponent(headerValue))

        if (!Array.isArray(parsed)) {
            return []
        }

        return parsed
            .map((item) => ({
                src: typeof item?.src === 'string' ? item.src.trim() : '',
                alt: typeof item?.alt === 'string' ? item.alt.trim() : '',
                caption:
                    typeof item?.caption === 'string' ? item.caption.trim() : '',
                pageTitle:
                    typeof item?.pageTitle === 'string'
                        ? item.pageTitle.trim()
                        : '',
                pageUrl:
                    typeof item?.pageUrl === 'string' ? item.pageUrl.trim() : '',
            }))
            .filter((item) => item.src)
    } catch {
        return []
    }
}

function parseResponseClassificationHeader(headerValue) {
    if (!headerValue) return null

    try {
        const parsed = JSON.parse(decodeURIComponent(headerValue))

        return {
            productCategory:
                typeof parsed?.productCategory === 'string'
                    ? parsed.productCategory.trim()
                    : '',
            productLabel:
                typeof parsed?.productLabel === 'string'
                    ? parsed.productLabel.trim()
                    : '',
            topicCategory:
                typeof parsed?.topicCategory === 'string'
                    ? parsed.topicCategory.trim()
                    : '',
            topicLabel:
                typeof parsed?.topicLabel === 'string'
                    ? parsed.topicLabel.trim()
                    : '',
            classificationTags:
                typeof parsed?.classificationTags === 'string'
                    ? parsed.classificationTags.trim()
                    : '',
            classificationConfidence:
                typeof parsed?.classificationConfidence === 'string'
                    ? parsed.classificationConfidence.trim()
                    : '',
            classificationSource:
                typeof parsed?.classificationSource === 'string'
                    ? parsed.classificationSource.trim()
                    : '',
        }
    } catch {
        return null
    }
}

export default function AskAI() {
    const [isOpen, setIsOpen] = useState(false)
    const [question, setQuestion] = useState('')
    const [messages, setMessages] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [selectedImage, setSelectedImage] = useState(null)
    const [uploadError, setUploadError] = useState('')
    const [sessionId, setSessionId] = useState('')
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)
    const fileInputRef = useRef(null)

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

    const resetSession = useCallback(() => {
        const nextSessionId = createSessionId()
        setSessionId(nextSessionId)
        localStorage.setItem('ohstem-ai-session-id', nextSessionId)
    }, [])

    useEffect(() => {
        const storedSessionId = localStorage.getItem('ohstem-ai-session-id')

        if (storedSessionId) {
            setSessionId(storedSessionId)
        } else {
            resetSession()
        }
    }, [resetSession])

    useEffect(() => {
        scrollToBottom()
    }, [messages, scrollToBottom])

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isOpen])

    useEffect(() => {
        if (!isOpen) return

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
            }
        }

        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [isOpen])

    const updateMessage = useCallback((localId, updater) => {
        setMessages((prev) =>
            prev.map((message) => {
                if (message.localId !== localId) {
                    return message
                }

                const nextPatch =
                    typeof updater === 'function' ? updater(message) : updater

                return { ...message, ...nextPatch }
            })
        )
    }, [])

    const clearSelectedImage = useCallback(() => {
        setSelectedImage(null)
        setUploadError('')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [])

    const handleImagePick = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return

        setUploadError('')

        if (!file.type.startsWith('image/')) {
            setUploadError('Chỉ hỗ trợ file hình ảnh.')
            clearSelectedImage()
            return
        }

        if (file.size > 10 * 1024 * 1024) {
            setUploadError('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 10MB.')
            clearSelectedImage()
            return
        }

        try {
            const prepared = await prepareImageForUpload(file)
            setSelectedImage(prepared)
        } catch (error) {
            setUploadError(error.message || 'Không thể xử lý hình ảnh.')
            clearSelectedImage()
        }
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        const textQuestion = question.trim()
        if ((!textQuestion && !selectedImage) || isLoading) return

        const userLocalId = createLocalId('user')
        const aiLocalId = createLocalId('ai')
        const activeSessionId = sessionId || createSessionId()
        const pagePath = `${window.location.pathname}${window.location.search}`
        const pageTitle = document.title || ''
        const requestHistory = messages
            .map((message) => ({
                role: message.role,
                content: buildHistoryMessageContent(message),
            }))
            .filter((message) => message.content)

        const userMessage = {
            localId: userLocalId,
            role: 'user',
            content: textQuestion || 'Đã gửi hình ảnh để được hỗ trợ.',
            imagePreview: selectedImage?.previewUrl || '',
            imageName: selectedImage?.name || '',
        }

        const aiMessage = {
            localId: aiLocalId,
            role: 'ai',
            content: '',
            responseImages: [],
            classification: null,
            isError: false,
            messageId: '',
            feedbackStatus: null,
            feedbackNote: '',
            feedbackDraft: '',
            showFeedbackNote: false,
            feedbackSaving: false,
            feedbackSaved: false,
            feedbackError: '',
        }

        setMessages((prev) => [...prev, userMessage, aiMessage])
        setQuestion('')
        setSelectedImage(null)
        setUploadError('')
        setIsLoading(true)

        if (!sessionId) {
            setSessionId(activeSessionId)
            localStorage.setItem('ohstem-ai-session-id', activeSessionId)
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 45000)
        let fullText = ''

        try {
            const response = await fetch('/api/ai/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    question: textQuestion,
                    history: requestHistory,
                    image: selectedImage
                        ? {
                              data: selectedImage.data,
                              mimeType: selectedImage.mimeType,
                              name: selectedImage.name,
                          }
                        : null,
                    sessionId: activeSessionId,
                    pagePath,
                    pageTitle,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Lỗi ${response.status}`)
            }

            const nextSessionId = response.headers.get('X-Chat-Session-Id')
            const messageId = response.headers.get('X-Chat-Message-Id') || ''
            const responseImages = parseResponseImagesHeader(
                response.headers.get('X-Chat-Response-Images')
            )
            const classification = parseResponseClassificationHeader(
                response.headers.get('X-Chat-Classification')
            )

            if (nextSessionId && nextSessionId !== sessionId) {
                setSessionId(nextSessionId)
                localStorage.setItem('ohstem-ai-session-id', nextSessionId)
            }

            updateMessage(aiLocalId, { messageId, responseImages, classification })

            if (response.body) {
                const reader = response.body.getReader()
                const decoder = new TextDecoder()

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    fullText += decoder.decode(value, { stream: true })
                    updateMessage(aiLocalId, { content: fullText })
                }
            } else {
                fullText = await response.text()
                updateMessage(aiLocalId, { content: fullText })
            }

            if (!fullText.trim()) {
                throw new Error('AI không trả về nội dung hiển thị.')
            }
        } catch (error) {
            const fallbackMessage =
                error?.name === 'AbortError'
                    ? 'AI phản hồi quá lâu. Vui lòng thử lại.'
                    : error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.'

            const content = fullText.trim()
                ? `${fullText}\n\n⚠️ ${fallbackMessage}`
                : `⚠️ ${fallbackMessage}`

            updateMessage(aiLocalId, {
                content,
                isError: !fullText.trim(),
            })
        } finally {
            clearTimeout(timeoutId)
            setIsLoading(false)
        }
    }

    const handleClear = () => {
        if (isLoading) return

        setMessages([])
        setQuestion('')
        clearSelectedImage()
        resetSession()
    }

    const submitFeedback = async ({
        localId,
        messageId,
        satisfaction,
        note = '',
        keepNoteBox = false,
        classification = null,
    }) => {
        if (!messageId) return

        updateMessage(localId, {
            feedbackSaving: true,
            feedbackError: '',
        })

        try {
            const response = await fetch('/api/ai/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    messageId,
                    satisfaction,
                    note,
                    ...(classification || {}),
                }),
            })

            const data = await response.json().catch(() => ({}))

            if (!response.ok) {
                throw new Error(data.error || 'Không thể lưu feedback.')
            }

            updateMessage(localId, (message) => ({
                feedbackSaving: false,
                feedbackStatus: satisfaction || message.feedbackStatus,
                feedbackNote: typeof note === 'string' ? note : message.feedbackNote,
                feedbackSaved: true,
                feedbackError: '',
                showFeedbackNote:
                    satisfaction === 'down'
                        ? keepNoteBox
                        : false,
            }))
        } catch (error) {
            updateMessage(localId, {
                feedbackSaving: false,
                feedbackError: error.message || 'Không thể lưu feedback.',
            })
            console.warn(
                '[AskAI] Khong the dong bo feedback, nhung van an thong bao loi ky thuat:',
                error?.message || error
            )
            updateMessage(localId, {
                feedbackSaving: false,
                feedbackStatus: satisfaction,
                feedbackNote: typeof note === 'string' ? note : '',
                feedbackSaved: true,
                feedbackError: '',
                showFeedbackNote:
                    satisfaction === 'down'
                        ? keepNoteBox
                        : false,
            })
        }
    }

    const renderMarkdown = (text) => {
        if (!text) return null

        const htmlEscapes = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }

        const html = text
            .replace(/[&<>"']/g, (char) => htmlEscapes[char])
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            .replace(/\n/g, '<br/>')

        return <span dangerouslySetInnerHTML={{ __html: html }} />
    }

    const panelStyle = {
        opacity: isOpen ? 1 : 0,
        visibility: isOpen ? 'visible' : 'hidden',
        transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
        pointerEvents: isOpen ? 'auto' : 'none',
    }

    return (
        <>
            {isOpen && (
                <div
                    className="askai-backdrop"
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                />
            )}

            <button
                type="button"
                className={`askai-fab ${isOpen ? 'askai-fab--open' : ''}`}
                onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setIsOpen((open) => !open)
                }}
                aria-label={isOpen ? 'Đóng trợ lý AI' : 'Hỏi trợ lý AI'}
                title="Hỏi AI"
                aria-expanded={isOpen}
            >
                <span className="askai-fab__icon">
                    {isOpen ? '✕' : '💬'}
                </span>
            </button>

            <div
                className={`askai-panel ${isOpen ? 'askai-panel--open' : ''}`}
                style={panelStyle}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="askai-panel__header">
                    <div className="askai-panel__title">
                        <span className="askai-panel__logo">
                            <img src="/images/logoohstem.png" alt="OhStem" style={{ height: '28px' }} />
                        </span>
                        <div>
                            <h3>OhStem AI Assistant</h3>
                            <p>Hỏi bằng văn bản hoặc gửi kèm hình ảnh</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="askai-panel__clear"
                        onClick={handleClear}
                        title="Xóa lịch sử chat"
                        disabled={messages.length === 0 || isLoading}
                    >
                        🗑️
                    </button>
                </div>

                <div className="askai-panel__messages">
                    {messages.length === 0 && (
                        <div className="askai-panel__welcome">
                            <div className="askai-panel__welcome-icon">
                                <img src="/images/logoohstem.png" alt="OhStem" style={{ height: '48px' }} />
                            </div>
                            <h4>Xin chào!</h4>
                            <p>
                                Bạn có thể hỏi về tài liệu OhStem bằng chữ, hoặc gửi kèm
                                hình ảnh lỗi, robot, màn hình code để được hỗ trợ nhanh hơn.
                            </p>
                            <div className="askai-panel__suggestions">
                                {[
                                    'Yolo:Bit là gì?',
                                    'Cách lập trình xBot?',
                                    'Robot của em báo lỗi này là gì?',
                                ].map((suggestion) => (
                                    <button
                                        type="button"
                                        key={suggestion}
                                        className="askai-panel__suggestion"
                                        onClick={() => {
                                            setQuestion(suggestion)
                                            inputRef.current?.focus()
                                        }}
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((message) => (
                        <div
                            key={message.localId}
                            className={`askai-message askai-message--${message.role} ${
                                message.isError ? 'askai-message--error' : ''
                            }`}
                        >
                            <div className="askai-message__avatar">
                                {message.role === 'user' ? (
                                    '👤'
                                ) : (
                                    <img src="/images/avt_ai_chat.png" alt="AI" style={{ height: '20px', borderRadius: '50%' }} />
                                )}
                            </div>
                            <div className="askai-message__bubble">
                                {message.imagePreview && (
                                    <div className="askai-message__image-wrap">
                                        <img
                                            src={message.imagePreview}
                                            alt={message.imageName || 'Hình ảnh người dùng gửi'}
                                            className="askai-message__image"
                                        />
                                        {message.imageName && (
                                            <div className="askai-message__image-name">
                                                {message.imageName}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {message.role === 'ai' && !message.content && isLoading ? (
                                    <div className="askai-typing">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                ) : (
                                    renderMarkdown(message.content)
                                )}

                                {message.role === 'ai' &&
                                    Array.isArray(message.responseImages) &&
                                    message.responseImages.length > 0 && (
                                        <div className="askai-message__references">
                                            <div className="askai-message__references-title">
                                                Hinh minh hoa tu tai lieu
                                            </div>
                                            <div className="askai-message__references-list">
                                                {message.responseImages.map((image, index) => (
                                                    <div
                                                        key={`${message.localId}-ref-${index}`}
                                                        className="askai-message__reference-card"
                                                    >
                                                        <a
                                                            href={image.src}
                                                            target="_blank"
                                                            rel="noopener"
                                                            className="askai-message__reference-image-link"
                                                        >
                                                            <img
                                                                src={image.src}
                                                                alt={
                                                                    image.alt ||
                                                                    image.caption ||
                                                                    'Hinh minh hoa'
                                                                }
                                                                className="askai-message__reference-image"
                                                            />
                                                        </a>
                                                        {(image.caption ||
                                                            image.pageTitle ||
                                                            image.pageUrl) && (
                                                            <div className="askai-message__reference-meta">
                                                                {image.caption && (
                                                                    <div className="askai-message__reference-caption">
                                                                        {image.caption}
                                                                    </div>
                                                                )}
                                                                {image.pageUrl && (
                                                                    <a
                                                                        href={image.pageUrl}
                                                                        target="_blank"
                                                                        rel="noopener"
                                                                        className="askai-message__reference-source"
                                                                    >
                                                                        {image.pageTitle ||
                                                                            'Mo trang tai lieu'}
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                {message.role === 'ai' && message.messageId && !message.isError && (
                                    <div className="askai-feedback">
                                        <div className="askai-feedback__label">
                                            Phiên hỗ trợ này có hữu ích không?
                                        </div>
                                        <div className="askai-feedback__actions">
                                            <button
                                                type="button"
                                                className={`askai-feedback__btn ${
                                                    message.feedbackStatus === 'up'
                                                        ? 'askai-feedback__btn--active'
                                                        : ''
                                                }`}
                                                disabled={message.feedbackSaving}
                                                onClick={() =>
                                                    submitFeedback({
                                                        localId: message.localId,
                                                        messageId: message.messageId,
                                                        satisfaction: 'up',
                                                        classification:
                                                            message.classification,
                                                    })
                                                }
                                            >
                                                Hài lòng
                                            </button>
                                            <button
                                                type="button"
                                                className={`askai-feedback__btn ${
                                                    message.feedbackStatus === 'down'
                                                        ? 'askai-feedback__btn--active'
                                                        : ''
                                                }`}
                                                disabled={message.feedbackSaving}
                                                onClick={() => {
                                                    updateMessage(message.localId, {
                                                        showFeedbackNote: true,
                                                        feedbackStatus: 'down',
                                                    })
                                                    submitFeedback({
                                                        localId: message.localId,
                                                        messageId: message.messageId,
                                                        satisfaction: 'down',
                                                        keepNoteBox: true,
                                                        classification:
                                                            message.classification,
                                                    })
                                                }}
                                            >
                                                Chưa hài lòng
                                            </button>
                                        </div>

                                        {message.feedbackSaved && !message.showFeedbackNote && (
                                            <div className="askai-feedback__thanks">
                                                Cảm ơn bạn đã đánh giá.
                                            </div>
                                        )}

                                        {message.showFeedbackNote && (
                                            <div className="askai-feedback__note">
                                                <textarea
                                                    value={message.feedbackDraft || ''}
                                                    onChange={(event) =>
                                                        updateMessage(message.localId, {
                                                            feedbackDraft: event.target.value,
                                                        })
                                                    }
                                                    placeholder="Bạn chưa hài lòng ở điểm nào? Ví dụ: trả lời chưa đúng, thiếu link, chưa hiểu ảnh..."
                                                />
                                                <div className="askai-feedback__note-actions">
                                                    <button
                                                        type="button"
                                                        disabled={message.feedbackSaving}
                                                        onClick={() =>
                                                            submitFeedback({
                                                                localId: message.localId,
                                                                messageId: message.messageId,
                                                                satisfaction: 'down',
                                                                note: message.feedbackDraft || '',
                                                                keepNoteBox: false,
                                                                classification:
                                                                    message.classification,
                                                            })
                                                        }
                                                    >
                                                        Lưu góp ý
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {message.feedbackError && (
                                            <div className="askai-feedback__error">
                                                {message.feedbackError}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    <div ref={messagesEndRef} />
                </div>

                {selectedImage && (
                    <div className="askai-panel__attachment">
                        <img
                            src={selectedImage.previewUrl}
                            alt={selectedImage.name || 'Ảnh đính kèm'}
                            className="askai-panel__attachment-image"
                        />
                        <div className="askai-panel__attachment-info">
                            <strong>{selectedImage.name}</strong>
                            <span>Ảnh sẽ được gửi kèm trong câu hỏi</span>
                        </div>
                        <button
                            type="button"
                            className="askai-panel__attachment-remove"
                            onClick={clearSelectedImage}
                            title="Bỏ ảnh"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {uploadError && (
                    <div className="askai-panel__upload-error">{uploadError}</div>
                )}

                <form className="askai-panel__input" onSubmit={handleSubmit}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={handleImagePick}
                    />
                    <button
                        type="button"
                        className="askai-panel__attach"
                        onClick={() => fileInputRef.current?.click()}
                        title="Gửi hình ảnh"
                        disabled={isLoading}
                    >
                        📎
                    </button>
                    <input
                        ref={inputRef}
                        type="text"
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        placeholder="Nhập câu hỏi hoặc gửi kèm hình ảnh..."
                        disabled={isLoading}
                        autoComplete="off"
                    />
                    <button
                        type="submit"
                        disabled={(!question.trim() && !selectedImage) || isLoading}
                        title="Gửi câu hỏi"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </form>
            </div>
        </>
    )
}
