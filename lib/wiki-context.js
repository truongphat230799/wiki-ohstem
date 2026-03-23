import fs from 'fs'
import path from 'path'

let cachedContext = null

/**
 * Recursively reads all .md and .mdx files from the content directory.
 * Returns an array of { path, title, content } objects.
 * Results are cached in-memory for performance.
 */
export function getWikiContext() {
    if (cachedContext) return cachedContext

    const contentDir = path.join(process.cwd(), 'content')
    const files = []

    function walkDir(dir, basePath = '') {
        if (!fs.existsSync(dir)) return

        const entries = fs.readdirSync(dir, { withFileTypes: true })

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)
            const relativePath = path.join(basePath, entry.name)

            if (entry.isDirectory()) {
                walkDir(fullPath, relativePath)
            } else if (/\.(mdx?|MDX?)$/.test(entry.name)) {
                // Skip _meta files
                if (entry.name.startsWith('_')) continue

                const raw = fs.readFileSync(fullPath, 'utf-8')

                // Extract title from frontmatter or first heading
                let title = entry.name.replace(/\.(mdx?|MDX?)$/, '')
                const frontmatterMatch = raw.match(/^---\s*\n[\s\S]*?title:\s*(.+)\n[\s\S]*?---/)
                if (frontmatterMatch) {
                    title = frontmatterMatch[1].trim().replace(/^['"]|['"]$/g, '')
                } else {
                    const headingMatch = raw.match(/^#\s+(.+)/m)
                    if (headingMatch) title = headingMatch[1].trim()
                }

                // Clean content: remove frontmatter, import statements, JSX components
                let content = raw
                    .replace(/^---\s*\n[\s\S]*?---\s*\n/, '') // Remove frontmatter
                    .replace(/^import\s+.*$/gm, '') // Remove imports
                    .replace(/<[A-Z][^>]*>[\s\S]*?<\/[A-Z][^>]*>/g, '') // Remove JSX blocks
                    .replace(/<[A-Z][^/>]*\/>/g, '') // Remove self-closing JSX
                    .trim()

                // Convert file path to wiki URL
                const urlPath =
                    '/' +
                    relativePath
                        .replace(/\\/g, '/')
                        .replace(/\.(mdx?|MDX?)$/, '')
                        .replace(/\/index$/, '')

                files.push({ path: urlPath, title, content })
            }
        }
    }

    walkDir(contentDir)
    cachedContext = files
    return files
}

/**
 * Builds a full context string from all wiki pages for the AI prompt.
 */
export function buildContextString() {
    const pages = getWikiContext()

    return pages
        .map(
            (page) =>
                `=== Trang: ${page.title} (URL: ${page.path}) ===\n${page.content}`
        )
        .join('\n\n')
}

/**
 * Clears the cached context (useful for development/hot-reload).
 */
export function clearContextCache() {
    cachedContext = null
}
