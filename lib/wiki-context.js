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
    'toi',
    'minh',
    'xin',
    'nhe',
    'giup',
    'thong',
    'tin',
    'cuoc',
    'thi',
    'giai',
    'dau',
])

const ORC_QUERY_ALIASES = [
    'orc',
    'ocr',
    'open robotics challenge',
    'open robotics challenges',
    'robotics challenge',
    'robotic challenge',
    'robotik challenge',
    'robotics challange',
    'robotic challange',
]

const ORC_COMPETITION_ALIASES = [
    'giai',
    'giai dau',
    'cuoc thi',
    'thi dau',
    'bang thi',
    'mua giai',
    'the le',
    'dang ky',
]

const ORC_ROBOT_ALIASES = [
    'robot',
    'rover',
    'k2',
    'k3',
]

const ORC_BAND_CONFIGS = [
    {
        band: 'junior',
        aliases: [
            'junior',
            'tieu hoc',
            'cap 1',
            'lop 1',
            'lop 2',
            'lop 3',
            'lop 4',
            'lop 5',
            'rover',
        ],
        searchTerms: ['junior', 'rover'],
    },
    {
        band: 'explorer',
        aliases: [
            'explorer',
            'thcs',
            'thpt',
            'trung hoc co so',
            'trung hoc pho thong',
            'cap 2',
            'cap 3',
            'k2',
            'orc k2',
        ],
        searchTerms: ['explorer', 'k2'],
    },
    {
        band: 'master',
        aliases: [
            'master',
            'sinh vien',
            'dai hoc',
            'cao dang',
            'trung cap',
            'k3',
            'orc k3',
        ],
        searchTerms: ['master', 'k3'],
    },
]

function normalizeSearchText(text = '') {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/đ/g, 'd')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

function getSearchTermsFromNormalized(normalizedQuery = '') {
    if (!normalizedQuery) return []

    return [...new Set(
        normalizedQuery
            .split(/\s+/)
            .filter((term) => term.length > 1 && !SEARCH_STOP_WORDS.has(term))
    )]
}

function getSearchTerms(query = '') {
    return getSearchTermsFromNormalized(normalizeSearchText(query))
}

function splitNormalizedWords(text = '') {
    return normalizeSearchText(text)
        .split(/\s+/)
        .filter(Boolean)
}

function escapeRegExp(text = '') {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasWholePhrase(text = '', phrase = '') {
    if (!text || !phrase) return false

    const pattern = new RegExp(`(?:^| )${escapeRegExp(phrase)}(?:$| )`)
    return pattern.test(text)
}

function damerauLevenshteinDistance(source = '', target = '') {
    const sourceLength = source.length
    const targetLength = target.length

    if (sourceLength === 0) return targetLength
    if (targetLength === 0) return sourceLength

    const distances = Array.from(
        { length: sourceLength + 1 },
        () => new Array(targetLength + 1).fill(0)
    )

    for (let i = 0; i <= sourceLength; i += 1) {
        distances[i][0] = i
    }

    for (let j = 0; j <= targetLength; j += 1) {
        distances[0][j] = j
    }

    for (let i = 1; i <= sourceLength; i += 1) {
        for (let j = 1; j <= targetLength; j += 1) {
            const substitutionCost = source[i - 1] === target[j - 1] ? 0 : 1

            distances[i][j] = Math.min(
                distances[i - 1][j] + 1,
                distances[i][j - 1] + 1,
                distances[i - 1][j - 1] + substitutionCost
            )

            if (
                i > 1 &&
                j > 1 &&
                source[i - 1] === target[j - 2] &&
                source[i - 2] === target[j - 1]
            ) {
                distances[i][j] = Math.min(
                    distances[i][j],
                    distances[i - 2][j - 2] + 1
                )
            }
        }
    }

    return distances[sourceLength][targetLength]
}

function isSimilarToken(left = '', right = '') {
    if (!left || !right) return false
    if (left === right) return true

    const leftLength = left.length
    const rightLength = right.length
    const hasDigits = /\d/.test(left) || /\d/.test(right)

    if (hasDigits || Math.min(leftLength, rightLength) <= 2) {
        return false
    }

    const maxDistance = Math.max(leftLength, rightLength) <= 4 ? 1 : 2
    if (Math.abs(leftLength - rightLength) > maxDistance) {
        return false
    }

    return damerauLevenshteinDistance(left, right) <= maxDistance
}

function hasAliasMatch(normalizedText = '', aliases = []) {
    if (!normalizedText) return false

    for (const alias of aliases) {
        const normalizedAlias = normalizeSearchText(alias)
        if (!normalizedAlias) continue

        if (hasWholePhrase(normalizedText, normalizedAlias)) {
            return true
        }
    }

    const textWords = splitNormalizedWords(normalizedText)

    for (const alias of aliases) {
        const aliasWords = splitNormalizedWords(alias)
        if (aliasWords.length === 0 || aliasWords.length > textWords.length) {
            continue
        }

        for (let index = 0; index <= textWords.length - aliasWords.length; index += 1) {
            const candidateWords = textWords.slice(index, index + aliasWords.length)
            const isMatch = aliasWords.every(
                (word, wordIndex) => candidateWords[wordIndex] === word || isSimilarToken(candidateWords[wordIndex], word)
            )

            if (isMatch) {
                return true
            }
        }
    }

    return false
}

function buildOrcQueryProfile(query = '') {
    const normalizedQuery = normalizeSearchText(query)
    if (!normalizedQuery) {
        return {
            band: null,
            canonicalPhrases: [],
            expandedTerms: [],
            hasCompetitionIntent: false,
            hasOrcAlias: false,
            isLikelyOrcCompetitionQuery: false,
        }
    }

    const bandConfig =
        ORC_BAND_CONFIGS.find(({ aliases }) => hasAliasMatch(normalizedQuery, aliases)) ?? null
    const hasOrcAlias = hasAliasMatch(normalizedQuery, ORC_QUERY_ALIASES)
    const hasCompetitionIntent = hasAliasMatch(normalizedQuery, ORC_COMPETITION_ALIASES)
    const hasRobotHint = hasAliasMatch(normalizedQuery, ORC_ROBOT_ALIASES)
    const isLikelyOrcCompetitionQuery =
        hasOrcAlias ||
        (Boolean(bandConfig) && hasCompetitionIntent) ||
        (Boolean(bandConfig) && hasRobotHint && hasCompetitionIntent)

    const expandedTerms = new Set()
    const canonicalPhrases = new Set()

    if (isLikelyOrcCompetitionQuery) {
        getSearchTermsFromNormalized('orc open robotics challenge').forEach((term) => {
            expandedTerms.add(term)
        })
        canonicalPhrases.add('open robotics challenge')
    }

    if (bandConfig && (isLikelyOrcCompetitionQuery || hasOrcAlias)) {
        bandConfig.searchTerms.forEach((term) => expandedTerms.add(term))
        canonicalPhrases.add(`orc ${bandConfig.band}`)
    }

    return {
        band: bandConfig?.band ?? null,
        canonicalPhrases: [...canonicalPhrases],
        expandedTerms: [...expandedTerms],
        hasCompetitionIntent,
        hasOrcAlias,
        isLikelyOrcCompetitionQuery,
    }
}

function isSingleObjectQuestion(query = '') {
    const normalizedQuery = normalizeSearchText(query)
    const searchTerms = getSearchTerms(query)

    return (
        /(\bla gi\b|\bla ai\b|\bgioi thieu\b|\bcho biet\b|\bdung de lam gi\b|\bcach dung\b|\bthong tin\b)/.test(normalizedQuery) ||
        searchTerms.length <= 3
    )
}

function isOrcQuery(normalizedQuery = '') {
    return hasAliasMatch(normalizedQuery, ORC_QUERY_ALIASES)
}

function detectOrcBand(normalizedQuery = '') {
    const matchedBand = ORC_BAND_CONFIGS.find(({ aliases }) =>
        hasAliasMatch(normalizedQuery, aliases)
    )

    return matchedBand?.band ?? null
}

function getCompetitionIntentBoost(pagePath, pageTitle, orcProfile) {
    if (!orcProfile?.isLikelyOrcCompetitionQuery) {
        return 0
    }

    const isOrcPage =
        pagePath.includes('giaidau orc') ||
        pageTitle.includes('open robotics challenge') ||
        pageTitle.includes('orc')

    if (!isOrcPage) {
        return 0
    }

    let boost = 260

    if (orcProfile.hasCompetitionIntent) {
        boost += 50
    }

    const targetBand = orcProfile.band
    if (targetBand && (pagePath.includes(targetBand) || pageTitle.includes(targetBand))) {
        boost += 320
    }

    return boost
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
    const orcProfile = buildOrcQueryProfile(query)
    const rawSearchTerms = getSearchTermsFromNormalized(normalizedQuery)
    const searchTerms = [
        ...new Set([
            ...rawSearchTerms,
            ...orcProfile.expandedTerms,
        ]),
    ]
    const phraseQuery = rawSearchTerms.join(' ')

    const scoredPages = pages.map((page) => {
        let score = 0
        let exactMatch = false

        const titleLower = normalizeSearchText(page.title)
        const pathLower = normalizeSearchText(page.path)
        const contentLower = normalizeSearchText(page.content)

        score += getCompetitionIntentBoost(pathLower, titleLower, orcProfile)

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

        orcProfile.canonicalPhrases.forEach((phrase) => {
            if (!phrase) return

            if (titleLower.includes(phrase)) score += 80
            if (pathLower.includes(phrase)) score += 120
            if (contentLower.includes(phrase)) score += 18
        })

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
