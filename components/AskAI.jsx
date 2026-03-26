'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import './AskAI.css'

export default function AskAI() {
    const [isOpen, setIsOpen] = useState(false)
    const [question, setQuestion] = useState('')
    const [messages, setMessages] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [])

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

    const updateLastAiMessage = (content, isError = false) => {
        setMessages((prev) => {
            const updated = [...prev]

            for (let i = updated.length - 1; i >= 0; i -= 1) {
                if (updated[i].role === 'ai') {
                    updated[i] = { role: 'ai', content, isError }
                    return updated
                }
            }

            return [...updated, { role: 'ai', content, isError }]
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const q = question.trim()
        if (!q || isLoading) return

        const requestHistory = messages.filter(
            (msg) => typeof msg?.content === 'string' && msg.content.trim()
        )

        setMessages((prev) => [
            ...prev,
            { role: 'user', content: q },
            { role: 'ai', content: '' },
        ])
        setQuestion('')
        setIsLoading(true)

        let fullText = ''
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 45000)

        try {
            const res = await fetch('/api/ai/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    question: q,
                    history: requestHistory,
                }),
            })

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || `Lỗi ${res.status}`)
            }

            if (!res.body) {
                throw new Error('AI không trả về dữ liệu.')
            }

            const reader = res.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                fullText += chunk
                updateLastAiMessage(fullText)
            }

            if (!fullText.trim()) {
                throw new Error('MiniMax không trả về nội dung hiển thị.')
            }
        } catch (err) {
            const fallbackMessage =
                err?.name === 'AbortError'
                    ? 'AI phản hồi quá lâu. Vui lòng thử lại.'
                    : err.message || 'Đã xảy ra lỗi. Vui lòng thử lại.'
            const content = fullText.trim()
                ? `${fullText}\n\n⚠️ ${fallbackMessage}`
                : `⚠️ ${fallbackMessage}`

            updateLastAiMessage(content, !fullText.trim())
        } finally {
            clearTimeout(timeoutId)
            setIsLoading(false)
        }
    }

    const handleClear = () => {
        if (isLoading) return
        setMessages([])
        setQuestion('')
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

        let html = text
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
            {/* Floating Action Button */}
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

            {/* Chat Panel */}
            <div
                className={`askai-panel ${isOpen ? 'askai-panel--open' : ''}`}
                style={panelStyle}
                onClick={(event) => event.stopPropagation()}
            >
                {/* Header */}
                <div className="askai-panel__header">
                    <div className="askai-panel__title">
                        <span className="askai-panel__logo"><img src="/images/logoohstem.png" alt="OhStem" style={{ height: '28px' }} /></span>
                        <div>
                            <h3>OhStem AI Assistant</h3>
                            <p>Hỏi bất kỳ điều gì về OhStem</p>
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

                {/* Messages */}
                <div className="askai-panel__messages">
                    {messages.length === 0 && (
                        <div className="askai-panel__welcome">
                            <div className="askai-panel__welcome-icon"><img src="/images/logoohstem.png" alt="OhStem" style={{ height: '48px' }} /></div>
                            <h4>Xin chào!</h4>
                            <p>
                                Tôi là trợ lý AI của OhStem. Hãy hỏi tôi bất kỳ câu hỏi nào
                                về sản phẩm, lập trình, hoặc hướng dẫn sử dụng.
                            </p>
                            <div className="askai-panel__suggestions">
                                {[
                                    'Yolo:Bit là gì?',
                                    'Cách lập trình xBot?',
                                    'Bắt đầu từ đâu?',
                                ].map((s) => (
                                    <button
                                        type="button"
                                        key={s}
                                        className="askai-panel__suggestion"
                                        onClick={() => {
                                            setQuestion(s)
                                            inputRef.current?.focus()
                                        }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`askai-message askai-message--${msg.role} ${msg.isError ? 'askai-message--error' : ''
                                }`}
                        >
                            <div className="askai-message__avatar">
                                {msg.role === 'user' ? '👤' : <img src="/images/avt_ai_chat.png" alt="AI" style={{ height: '20px', borderRadius: '50%' }} />}
                            </div>
                            <div className="askai-message__bubble">
                                {msg.role === 'ai' && !msg.content && isLoading ? (
                                    <div className="askai-typing">
                                        <span></span><span></span><span></span>
                                    </div>
                                ) : (
                                    renderMarkdown(msg.content)
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form className="askai-panel__input" onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Nhập câu hỏi của bạn..."
                        disabled={isLoading}
                        autoComplete="off"
                    />
                    <button
                        type="submit"
                        disabled={!question.trim() || isLoading}
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
