import AskAI from '../components/AskAI'
import './globals.css'

export const metadata = {
    title: {
        default: 'OhStem Wiki',
        template: '%s - OhStem Wiki',
    },
    description:
        'Tài liệu hướng dẫn sử dụng và lập trình các thiết bị OhStem Education',
    metadataBase: new URL('https://wiki.ohstem.vn'),
    icons: {
        icon: '/images/avt_ai_chat.png',
        shortcut: '/images/avt_ai_chat.png',
        apple: '/images/avt_ai_chat.png',
    },
}

export default function RootLayout({ children }) {
    return (
        <html lang="vi" dir="ltr" suppressHydrationWarning>
            <body>
                {children}
                <AskAI />
            </body>
        </html>
    )
}
