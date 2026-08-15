import AskAI from '../components/AskAI'
import GaPageViews from '../components/GaPageViews'
import './globals.css'

const GA_ID = 'G-YHG4Z58BMY'

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

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
}

export default function RootLayout({ children }) {
    return (
        <html lang="vi" dir="ltr" suppressHydrationWarning>
            <head>
                {/*
                  Chuyền định danh phiên sang OpenSTEM LMS (openstem.vn khác eTLD+1
                  nên không share được cookie). Script đọc data-source qua
                  document.currentScript nên phải là thẻ thật trong HTML, không
                  dùng next/script được.
                */}
                <script
                    src="https://openstem.vn/js/ohs-link.js"
                    data-source="wiki"
                    defer
                />

                {/* Google tag (gtag.js) */}
                <script
                    async
                    src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
                />
                {/*
                  send_page_view: false vì wiki điều hướng kiểu SPA, gtag chỉ
                  chạy một lần lúc tải trang đầu. Việc đếm lượt xem giao hết
                  cho <GaPageViews />, kể cả trang đầu tiên.
                */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}', { send_page_view: false });`,
                    }}
                />
            </head>
            <body>
                {children}
                <AskAI />
                <GaPageViews />
            </body>
        </html>
    )
}
