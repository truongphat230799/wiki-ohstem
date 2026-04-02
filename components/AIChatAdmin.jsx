'use client'

import { useEffect, useMemo, useState } from 'react'

function formatDate(value) {
    if (!value) return '--'

    try {
        return new Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'short',
            timeStyle: 'short',
        }).format(new Date(value))
    } catch {
        return value
    }
}

function StatCard({ label, value, tone = 'default' }) {
    const tones = {
        default: {
            background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(59,130,246,0.08))',
            border: 'rgba(99,102,241,0.16)',
        },
        success: {
            background: 'linear-gradient(135deg, rgba(34,197,94,0.14), rgba(16,185,129,0.08))',
            border: 'rgba(34,197,94,0.16)',
        },
        danger: {
            background: 'linear-gradient(135deg, rgba(239,68,68,0.14), rgba(244,63,94,0.08))',
            border: 'rgba(239,68,68,0.16)',
        },
    }

    return (
        <div
            style={{
                padding: '18px',
                borderRadius: '18px',
                border: `1px solid ${tones[tone].border}`,
                background: tones[tone].background,
                minWidth: 0,
            }}
        >
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>{label}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>{value}</div>
        </div>
    )
}

function TableSection({ title, columns, rows, emptyText }) {
    return (
        <section
            style={{
                background: '#fff',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 8px 30px rgba(15,23,42,0.05)',
            }}
        >
            <div
                style={{
                    padding: '18px 20px',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                }}
            >
                <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>{title}</h2>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{rows.length} mục</span>
            </div>
            {rows.length === 0 ? (
                <div style={{ padding: '24px 20px', color: '#64748b', fontSize: '14px' }}>
                    {emptyText}
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                {columns.map((column) => (
                                    <th
                                        key={column.key}
                                        style={{
                                            textAlign: 'left',
                                            padding: '12px 14px',
                                            fontSize: '12px',
                                            color: '#475569',
                                            fontWeight: 700,
                                            borderBottom: '1px solid #e2e8f0',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => (
                                <tr key={row.id || `${title}-${index}`}>
                                    {columns.map((column) => (
                                        <td
                                            key={column.key}
                                            style={{
                                                padding: '12px 14px',
                                                fontSize: '13px',
                                                color: '#0f172a',
                                                borderBottom:
                                                    index === rows.length - 1
                                                        ? 'none'
                                                        : '1px solid #f1f5f9',
                                                verticalAlign: 'top',
                                            }}
                                        >
                                            {column.render ? column.render(row) : row[column.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}

export default function AIChatAdmin() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const fetchData = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/admin/ai-chat')

            if (response.status === 401) {
                window.location.href = '/admin/login'
                return
            }

            const payload = await response.json()
            if (!response.ok) {
                throw new Error(payload.error || 'Không thể tải thống kê AI chat.')
            }

            setData(payload)
            setError('')
        } catch (fetchError) {
            setError(fetchError.message || 'Không thể tải thống kê AI chat.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const stats = data?.stats || {
        totalQuestions: 0,
        totalSessions: 0,
        ratedCount: 0,
        satisfiedCount: 0,
        unsatisfiedCount: 0,
        satisfactionRate: 0,
        withImagesCount: 0,
    }

    const topQuestions = data?.topQuestions || []
    const topPages = data?.topPages || []
    const unhappyEntries = data?.unhappyEntries || []
    const recentEntries = data?.recentEntries || []
    const isDisabled = Boolean(data?.disabled)
    const disabledMessage = data?.message || ''
    const analyticsUrl = data?.analyticsUrl || ''

    const wrapperStyle = useMemo(
        () => ({
            minHeight: '100vh',
            background:
                'linear-gradient(180deg, #f8fafc 0%, #eef2ff 48%, #f8fafc 100%)',
            padding: '28px 20px 40px',
        }),
        []
    )

    return (
        <div style={wrapperStyle}>
            <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '16px',
                        flexWrap: 'wrap',
                        marginBottom: '20px',
                    }}
                >
                    <div>
                        <h1 style={{ margin: 0, fontSize: '30px', color: '#0f172a' }}>
                            AI Chat Analytics
                        </h1>
                        <p style={{ margin: '8px 0 0', color: '#475569', fontSize: '14px' }}>
                            Theo dõi câu hỏi khách hàng hay hỏi, mức độ hài lòng và các vấn đề
                            cần cải thiện của AI chat.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => {
                                window.location.href = '/admin'
                            }}
                            style={{
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#0f172a',
                                borderRadius: '12px',
                                padding: '10px 14px',
                                cursor: 'pointer',
                                fontWeight: 600,
                            }}
                        >
                            ← Quay lại quản trị
                        </button>
                        <button
                            type="button"
                            onClick={fetchData}
                            style={{
                                border: 'none',
                                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                color: '#fff',
                                borderRadius: '12px',
                                padding: '10px 14px',
                                cursor: 'pointer',
                                fontWeight: 600,
                            }}
                        >
                            Làm mới dữ liệu
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div
                        style={{
                            padding: '28px',
                            borderRadius: '20px',
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            color: '#475569',
                        }}
                    >
                        Đang tải thống kê AI chat...
                    </div>
                ) : error ? (
                    <div
                        style={{
                            padding: '20px',
                            borderRadius: '20px',
                            background: '#fff1f2',
                            border: '1px solid #fecdd3',
                            color: '#9f1239',
                        }}
                    >
                        {error}
                    </div>
                ) : isDisabled ? (
                    <div
                        style={{
                            padding: '24px',
                            borderRadius: '20px',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1e3a8a',
                        }}
                    >
                        <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>
                            Thong ke local da tat
                        </div>
                        <div style={{ fontSize: '14px', lineHeight: 1.7, maxWidth: '760px' }}>
                            {disabledMessage ||
                                'He thong da chuyen sang luu log AI chat tren Google Sheet de phu hop voi moi truong deploy.'}
                        </div>
                        {analyticsUrl ? (
                            <div style={{ marginTop: '16px' }}>
                                <a
                                    href={analyticsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        textDecoration: 'none',
                                        borderRadius: '12px',
                                        background: '#1d4ed8',
                                        color: '#fff',
                                        padding: '10px 14px',
                                        fontWeight: 600,
                                    }}
                                >
                                    Mo dashboard Google Sheet
                                </a>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: '14px',
                                marginBottom: '22px',
                            }}
                        >
                            <StatCard label="Tổng câu hỏi" value={stats.totalQuestions} />
                            <StatCard label="Tổng phiên hỗ trợ" value={stats.totalSessions} />
                            <StatCard label="Có đính kèm ảnh" value={stats.withImagesCount} />
                            <StatCard
                                label="Tỉ lệ hài lòng"
                                value={`${stats.satisfactionRate}%`}
                                tone="success"
                            />
                            <StatCard
                                label="Lượt chưa hài lòng"
                                value={stats.unsatisfiedCount}
                                tone="danger"
                            />
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1.1fr 0.9fr',
                                gap: '18px',
                                marginBottom: '18px',
                            }}
                        >
                            <TableSection
                                title="Câu hỏi hay gặp"
                                rows={topQuestions}
                                emptyText="Chưa có dữ liệu câu hỏi."
                                columns={[
                                    { key: 'question', label: 'Câu hỏi' },
                                    { key: 'count', label: 'Số lần' },
                                    {
                                        key: 'lastAskedAt',
                                        label: 'Lần gần nhất',
                                        render: (row) => formatDate(row.lastAskedAt),
                                    },
                                ]}
                            />
                            <TableSection
                                title="Trang hay phát sinh câu hỏi"
                                rows={topPages}
                                emptyText="Chưa có dữ liệu trang."
                                columns={[
                                    {
                                        key: 'pageTitle',
                                        label: 'Trang',
                                        render: (row) => (
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{row.pageTitle}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                    {row.pagePath}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    { key: 'count', label: 'Số câu hỏi' },
                                ]}
                            />
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr',
                                gap: '18px',
                            }}
                        >
                            <TableSection
                                title="Các phản hồi chưa hài lòng / cần lưu ý"
                                rows={unhappyEntries}
                                emptyText="Chưa có phản hồi tiêu cực nào."
                                columns={[
                                    {
                                        key: 'question',
                                        label: 'Câu hỏi',
                                        render: (row) => (
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{row.question}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                                    {row.pageTitle || row.pagePath || 'Không rõ trang'}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'satisfaction',
                                        label: 'Đánh giá',
                                        render: (row) =>
                                            row.satisfaction === 'down'
                                                ? 'Chưa hài lòng'
                                                : row.satisfaction === 'up'
                                                  ? 'Hài lòng'
                                                  : 'Có ghi chú',
                                    },
                                    {
                                        key: 'feedbackNote',
                                        label: 'Ghi chú',
                                        render: (row) => row.feedbackNote || '--',
                                    },
                                    {
                                        key: 'createdAt',
                                        label: 'Thời gian',
                                        render: (row) => formatDate(row.createdAt),
                                    },
                                ]}
                            />

                            <TableSection
                                title="Nhật ký gần đây"
                                rows={recentEntries}
                                emptyText="Chưa có dữ liệu phiên chat."
                                columns={[
                                    {
                                        key: 'question',
                                        label: 'Câu hỏi',
                                        render: (row) => (
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{row.question}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                                    {row.pageTitle || row.pagePath || 'Không rõ trang'}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'hasImage',
                                        label: 'Ảnh',
                                        render: (row) => (row.hasImage ? 'Có' : 'Không'),
                                    },
                                    {
                                        key: 'satisfaction',
                                        label: 'Đánh giá',
                                        render: (row) =>
                                            row.satisfaction === 'up'
                                                ? 'Hài lòng'
                                                : row.satisfaction === 'down'
                                                  ? 'Chưa hài lòng'
                                                  : '--',
                                    },
                                    {
                                        key: 'answerPreview',
                                        label: 'Tóm tắt trả lời',
                                        render: (row) => row.answerPreview || '--',
                                    },
                                    {
                                        key: 'createdAt',
                                        label: 'Thời gian',
                                        render: (row) => formatDate(row.createdAt),
                                    },
                                ]}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
