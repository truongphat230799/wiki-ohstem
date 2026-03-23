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

    const handleSubmit = async (e) => {
        e.preventDefault()
        const q = question.trim()
        if (!q || isLoading) return

        // Add user message
        setMessages((prev) => [...prev, { role: 'user', content: q }])
        setQuestion('')
        setIsLoading(true)

        // Add placeholder for AI response
        setMessages((prev) => [...prev, { role: 'ai', content: '' }])

        try {
            const res = await fetch('/api/ai/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: q }),
            })

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || `Lỗi ${res.status}`)
            }

            // Stream the response
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let fullText = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                fullText += chunk

                setMessages((prev) => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { role: 'ai', content: fullText }
                    return updated
                })
            }
        } catch (err) {
            setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                    role: 'ai',
                    content: `⚠️ ${err.message || 'Đã xảy ra lỗi. Vui lòng thử lại.'}`,
                    isError: true,
                }
                return updated
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleClear = () => {
        setMessages([])
        setQuestion('')
    }

    const renderMarkdown = (text) => {
        if (!text) return null

        // Simple markdown rendering
        let html = text
            // Code blocks
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Bold
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            // Line breaks
            .replace(/\n/g, '<br/>')

        return <span dangerouslySetInnerHTML={{ __html: html }} />
    }

    return (
        <>
            {/* Floating Action Button */}
            <button
                className={`askai-fab ${isOpen ? 'askai-fab--open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? 'Đóng trợ lý AI' : 'Hỏi trợ lý AI'}
                title="Hỏi AI"
            >
                <span className="askai-fab__icon">
                    {isOpen ? '✕' : '💬'}
                </span>
            </button>

            {/* Chat Panel */}
            <div className={`askai-panel ${isOpen ? 'askai-panel--open' : ''}`}>
                {/* Header */}
                <div className="askai-panel__header">
                    <div className="askai-panel__title">
                        <span className="askai-panel__logo"><img src="/images/logoohstem.png" alt="OhStem" style={{height: '28px'}} /></span>
                        <div>
                            <h3>OhStem AI Assistant</h3>
                            <p>Hỏi bất kỳ điều gì về OhStem</p>
                        </div>
                    </div>
                    <button
                        className="askai-panel__clear"
                        onClick={handleClear}
                        title="Xóa lịch sử chat"
                        disabled={messages.length === 0}
                    >
                        🗑️
                    </button>
                </div>

                {/* Messages */}
                <div className="askai-panel__messages">
                    {messages.length === 0 && (
                        <div className="askai-panel__welcome">
                            <div className="askai-panel__welcome-icon"><img src="/images/logoohstem.png" alt="OhStem" style={{height: '48px'}} /></div>
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
                                {msg.role === 'user' ? '👤' : <img src="/images/avt_ai_chat.png" alt="AI" style={{height: '20px', borderRadius: '50%'}} />}
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
