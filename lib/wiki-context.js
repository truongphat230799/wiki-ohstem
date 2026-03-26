import fs from 'fs'
import path from 'path'

let cachedContext = null

const SEARCH_STOP_WORDS = new Set([
    'la',
    'gi',
    've',
    'cua',
    'cho',
    'biet',
    'gioi',
    'thieu',
    'cach',
    'nao',
    'the',
    'dung',
    'lam',
    'mot',
    'nhung',
    'co',
    'khong',
    'tai',
    'duoc',
    'voi',
    'tren',
    'trong',
    'tu',
    'den',
    'hay',
    'hoac',
])

function normalizeSearchText(text = '') {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/đ/g, 'd')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

function getSearchTerms(query = '') {
    const normalizedQuery = normalizeSearchText(query)
    if (!normalizedQuery) return []

    return [...new Set(
        normalizedQuery
            .split(/\s+/)
            .filter((term) => term.length > 1 && !SEARCH_STOP_WORDS.has(term))
    )]
}

function isSingleObjectQuestion(query = '') {
    const normalizedQuery = normalizeSearchText(query)
    const searchTerms = getSearchTerms(query)

    return (
        /(\bla gi\b|\bla ai\b|\bgioi thieu\b|\bcho biet\b|\bdung de lam gi\b|\bcach dung\b|\bthong tin\b)/.test(normalizedQuery) ||
        searchTerms.length <= 3
    )
}

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
 * Searches the wiki context for the most relevant pages based on a query.
 * Strongly prefers exact title/path matches for single-object questions.
 */
export function searchWikiContext(query, topK = 5) {
    const pages = getWikiContext()
    if (!query) return pages.slice(0, topK)

    const normalizedQuery = normalizeSearchText(query)
    const searchTerms = getSearchTerms(query)
    const phraseQuery = searchTerms.join(' ')

    const scoredPages = pages.map((page) => {
        let score = 0
        let exactMatch = false

        const titleLower = normalizeSearchText(page.title)
        const pathLower = normalizeSearchText(page.path)
        const contentLower = normalizeSearchText(page.content)

        if (titleLower === normalizedQuery || (phraseQuery && titleLower === phraseQuery)) {
            score += 250
            exactMatch = true
        }

        if (pathLower.endsWith(normalizedQuery) || (phraseQuery && pathLower.endsWith(phraseQuery))) {
            score += 220
            exactMatch = true
        }

        if (normalizedQuery && normalizedQuery.length > 2) {
            if (titleLower.includes(normalizedQuery)) score += 120
            if (pathLower.includes(normalizedQuery)) score += 100
            if (contentLower.includes(normalizedQuery)) score += 25
        }

        if (phraseQuery && phraseQuery !== normalizedQuery) {
            if (titleLower.includes(phraseQuery)) score += 80
            if (pathLower.includes(phraseQuery)) score += 70
            if (contentLower.includes(phraseQuery)) score += 20
        }

        searchTerms.forEach((term) => {
            if (titleLower === term) {
                score += 90
            } else if (titleLower.includes(term)) {
                score += 28
            }

            if (pathLower.endsWith(term)) {
                score += 80
            } else if (pathLower.includes(term)) {
                score += 24
            }

            const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
            const matches = contentLower.match(regex)
            if (matches) score += Math.min(matches.length, 6)
        })

        return { ...page, exactMatch, score }
    })

    const rankedPages = scoredPages
        .filter((page) => page.score > 0)
        .sort((a, b) => b.score - a.score)

    if (rankedPages.length === 0) return []

    const topPage = rankedPages[0]
    const secondPage = rankedPages[1]
    const shouldPreferSinglePage =
        topPage.exactMatch ||
        (
            isSingleObjectQuestion(query) &&
            (!secondPage || topPage.score >= secondPage.score * 1.6)
        ) ||
        (!secondPage || topPage.score - secondPage.score >= 90)

    const resultLimit = shouldPreferSinglePage ? 1 : Math.min(topK, 3)
    return rankedPages.slice(0, resultLimit)
}

/**
 * Builds a filtered context string for the AI prompt.
 */
export function buildSearchContextString(query, topK = 5) {
    const pages = searchWikiContext(query, topK)

    if (pages.length === 0) return ''

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
