import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

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

export default async function DocsLayout({ children }) {
    return (
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
    )
}
