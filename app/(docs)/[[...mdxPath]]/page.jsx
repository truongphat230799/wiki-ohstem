import { generateStaticParamsFor, importPage } from 'nextra/pages'
import { useMDXComponents as getMDXComponents } from '../../../mdx-components'

export const generateStaticParams = generateStaticParamsFor('mdxPath')

// Every docs page is known at build time, so serve them as fully static assets.
// Leaving this at the default (true) makes the catch-all route fall back to
// on-demand rendering, which routes every request through the ISR cache.
export const dynamicParams = false

export async function generateMetadata(props) {
    const params = await props.params
    const { metadata } = await importPage(params.mdxPath)
    return metadata
}

const Wrapper = getMDXComponents().wrapper

export default async function Page(props) {
    const params = await props.params
    const { default: MDXContent, toc, metadata, sourceCode } = await importPage(
        params.mdxPath
    )

    return (
        <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
            <MDXContent {...props} params={params} />
        </Wrapper>
    )
}
