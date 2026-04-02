import {
    createAiChatFeedbackEntry,
    sendAiChatFeedbackToSheet,
} from '../../../../lib/ai-chat-sheet.js'

export async function POST(request) {
    try {
        const {
            messageId,
            sessionId,
            satisfaction,
            note = '',
            productCategory = '',
            productLabel = '',
            topicCategory = '',
            topicLabel = '',
            classificationTags = '',
            classificationConfidence = '',
            classificationSource = '',
        } = await request.json()

        if (!messageId || typeof messageId !== 'string') {
            return Response.json(
                { error: 'Thiếu messageId để lưu feedback.' },
                { status: 400 }
            )
        }

        if (
            satisfaction !== undefined &&
            satisfaction !== null &&
            satisfaction !== 'up' &&
            satisfaction !== 'down'
        ) {
            return Response.json(
                { error: 'Giá trị đánh giá không hợp lệ.' },
                { status: 400 }
            )
        }

        const updated = createAiChatFeedbackEntry({
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
        })

        const syncResult = await sendAiChatFeedbackToSheet(updated)

        if (!syncResult?.ok) {
            return Response.json(
                {
                    error:
                        syncResult?.error ||
                        'Khong the dong bo feedback sang Google Sheet.',
                },
                { status: 502 }
            )
        }

        return Response.json({
            success: true,
            entry: updated,
        })
    } catch (error) {
        return Response.json(
            { error: error.message || 'Không thể lưu feedback.' },
            { status: 500 }
        )
    }
}
