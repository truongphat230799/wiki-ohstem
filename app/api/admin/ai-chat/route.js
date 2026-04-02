import { getCurrentUser } from '../../../../lib/auth'

export async function GET(request) {
    try {
        const user = getCurrentUser(request)

        if (!user) {
            return Response.json({ error: 'Chua dang nhap' }, { status: 401 })
        }

        return Response.json({
            disabled: true,
            provider: 'google_sheets',
            message:
                'Thong ke local da duoc tat de phu hop khi deploy tren Vercel. Vui long xem log va dashboard tren Google Sheet.',
            analyticsUrl: process.env.GOOGLE_SHEETS_DASHBOARD_URL?.trim() || '',
            stats: {
                totalQuestions: 0,
                totalSessions: 0,
                ratedCount: 0,
                satisfiedCount: 0,
                unsatisfiedCount: 0,
                satisfactionRate: 0,
                withImagesCount: 0,
            },
            topQuestions: [],
            topPages: [],
            unhappyEntries: [],
            recentEntries: [],
        })
    } catch (error) {
        return Response.json(
            { error: error.message || 'Khong the tai thong ke AI chat.' },
            { status: 500 }
        )
    }
}
