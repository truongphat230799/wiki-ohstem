import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import './globals.css'
import AskAI from '../components/AskAI'

export const metadata = {
    title: {
        default: 'OhStem Wiki',
        template: '%s – OhStem Wiki',
    },
    description:
        'Tài liệu hướng dẫn sử dụng và lập trình các thiết bị OhStem Education',
    metadataBase: new URL('https://wiki.ohstem.vn'),
}

const navbar = (
    <Navbar
        logo={
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/images/logoohstem.png" alt="OhStem" style={{ height: '32px' }} />
                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Wiki</span>
            </span>
        }
        projectLink="https://github.com/AITT-VN/wiki-app"
    />
)

const footer = (
    <Footer>
        <div style={{ textAlign: 'center', width: '100%' }}>
            © {new Date().getFullYear()} OhStem Education. All rights reserved.
        </div>
    </Footer>
)

export default async function RootLayout({ children }) {
    return (
        <html lang="vi" dir="ltr" suppressHydrationWarning>
            <Head>
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <body>
                <Layout
                    navbar={navbar}
                    pageMap={await getPageMap()}
                    docsRepositoryBase="https://github.com/AITT-VN/wiki-app/tree/main/content"
                    footer={footer}
                    sidebar={{ defaultMenuCollapseLevel: 1 }}
                    editLink={null}
                    feedback={{ content: null }}
                    search={null}
                    toc={{ title: 'Mục lục' }}
                >
                    {children}
                </Layout>
                <AskAI />
            </body>
        </html>
    )
}
