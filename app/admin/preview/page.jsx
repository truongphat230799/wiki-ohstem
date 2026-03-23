'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

function PreviewContent() {
    const searchParams = useSearchParams()
    const articlePath = searchParams.get('path')
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!articlePath) {
            setError('Thiếu tham số path')
            setLoading(false)
            return
        }

        async function loadContent() {
            try {
                const res = await fetch('/api/admin/list-articles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'read', articlePath }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                setContent(data.content)
            } catch (err) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }
        loadContent()
    }, [articlePath])

    // Simple markdown to HTML converter
    const renderMarkdown = (md) => {
        let html = md
            // Frontmatter removal
            .replace(/^---[\s\S]*?---\n*/m, '')
            // Headers
            .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            // Bold and italic
            .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Images
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:12px 0" />')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#6366f1">$1</a>')
            // Code blocks
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#1e293b;color:#e2e8f0;padding:16px;border-radius:8px;overflow-x:auto;margin:12px 0"><code>$2</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code style="background:rgba(99,102,241,0.1);padding:2px 6px;border-radius:4px;font-size:0.9em;color:#6366f1">$1</code>')
            // Unordered lists
            .replace(/^\* (.*$)/gm, '<li>$1</li>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br/>')

        // Wrap consecutive <li> in <ul>
        html = html.replace(/(<li>.*?<\/li>(<br\/?>)?)+/g, (match) => {
            return '<ul style="margin:8px 0;padding-left:24px">' + match.replace(/<br\/?>/g, '') + '</ul>'
        })

        return '<p>' + html + '</p>'
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', flexDirection: 'column', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ color: '#6b7280' }}>Đang tải nội dung...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
        )
    }

    if (error) {
        return (
            <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#991b1b' }}>
                <h2>⚠️ Lỗi</h2>
                <p>{error}</p>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 20px' }}>
            {/* Header bar */}
            <div style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                padding: '12px 20px',
                borderRadius: '12px',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '14px'
            }}>
                <span>📄 Preview: <code style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>{articlePath}</code></span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                    >
                        🔄 Refresh
                    </button>
                    <a
                        href={articlePath}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', textDecoration: 'none', fontSize: '13px' }}
                    >
                        🔗 Wiki Page
                    </a>
                    <a
                        href="/admin"
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', textDecoration: 'none', fontSize: '13px' }}
                    >
                        ⬅ Admin
                    </a>
                </div>
            </div>
            {/* Content */}
            <div
                className="preview-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                style={{ lineHeight: '1.8', fontSize: '16px', color: '#1f2937' }}
            />
            <style>{`
                .preview-content h1 { font-size: 2em; font-weight: 700; margin: 24px 0 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
                .preview-content h2 { font-size: 1.5em; font-weight: 600; margin: 20px 0 12px; color: #4338ca; }
                .preview-content h3 { font-size: 1.25em; font-weight: 600; margin: 16px 0 8px; }
                .preview-content h4 { font-size: 1.1em; font-weight: 600; margin: 12px 0 6px; }
                .preview-content img { display: block; margin: 16px auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .preview-content p { margin: 8px 0; }
                .preview-content li { margin: 4px 0; }
            `}</style>
        </div>
    )
}

export default function PreviewPage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <p style={{ color: '#6b7280' }}>Đang tải...</p>
            </div>
        }>
            <PreviewContent />
        </Suspense>
    )
}
