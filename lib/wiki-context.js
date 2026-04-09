import fs from 'fs'
import path from 'path'

let cachedContext = null
let cachedContentMtime = 0
const CACHE_CHECK_INTERVAL_MS = 30000
let lastCacheCheckTime = 0

const SEARCH_STOP_WORDS = new Set([
    'la',
    'gi',
    've',
    'cua',
    'cho',
    'nao',
    'the',
    'mot',
    'nhung',
    'co',
    'khong',
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
])

/**
 * Vietnamese tech synonym map.
 * Maps normalized search terms to arrays of equivalent terms.
 * Used to expand user queries so that different phrasing still matches content.
 */
const SYNONYM_MAP = new Map([
    // Cảm biến
    ['cam bien', ['cam bien', 'sensor', 'module cam bien']],
    ['sensor', ['cam bien', 'sensor', 'module cam bien']],
    ['nhiet do', ['nhiet do', 'dht20', 'dht11', 'ds18b20', 'nhiet do do am', 'bmp280', 'may do nhiet do']],
    ['do am', ['do am', 'do am dat', 'dht20', 'dht11', 'nhiet do do am', 'may do nhiet do']],
    // Reverse: model → Vietnamese description
    ['dht20', ['dht20', 'nhiet do', 'do am', 'nhiet do do am', 'cam bien nhiet do', 'may do nhiet do', 'cam bien dht20']],
    ['dht11', ['dht11', 'nhiet do', 'do am', 'nhiet do do am', 'cam bien nhiet do', 'cam bien dht11']],
    ['ds18b20', ['ds18b20', 'nhiet do', 'cam bien nhiet do chong nuoc']],
    ['bmp280', ['bmp280', 'ap suat', 'nhiet do', 'cam bien moi truong', 'module bmp280']],
    ['sieu am', ['sieu am', 'ultrasonic', 'srf05']],
    ['ultrasonic', ['sieu am', 'ultrasonic']],
    ['srf05', ['srf05', 'sieu am', 'cam bien sieu am', 'do khoang cach']],
    ['anh sang', ['anh sang', 'cam bien anh sang', 'quang tro']],
    ['mau sac', ['mau sac', 'color', 'veml6040', 'cam bien mau']],
    ['veml6040', ['veml6040', 'mau sac', 'cam bien mau', 'module cam bien mau']],
    ['hong ngoai', ['hong ngoai', 'ir', 'ir blaster', 'mat doc hong ngoai']],
    ['ir blaster', ['ir blaster', 'hong ngoai', 'phat hong ngoai', 'module ir blaster']],
    ['vat can', ['vat can', 'cam bien vat can', 'hong ngoai']],
    ['khi gas', ['khi gas', 'mq2', 'mq3', 'mq135', 'chat luong khong khi']],
    ['mq2', ['mq2', 'khi gas', 'khoi', 'cam bien khoi']],
    ['mq135', ['mq135', 'chat luong khong khi', 'cam bien khi']],
    ['gyro', ['gyro', 'gia toc', 'mpu6050', 'cam bien goc']],
    ['mpu6050', ['mpu6050', 'gyro', 'gia toc', 'cam bien goc', 'cam bien gia toc']],
    ['accelerometer', ['gia toc', 'mpu6050', 'cam bien goc']],
    ['gps', ['gps', 'dinh vi', 'atgm336h']],
    ['atgm336h', ['atgm336h', 'gps', 'dinh vi', 'module gps']],
    ['rfid', ['rfid', 'nfc', 'rc522']],
    ['rc522', ['rc522', 'rfid', 'module rfid']],
    ['lora', ['lora', 'lorae32', 'thu phat lora']],
    ['rtc', ['rtc', 'thoi gian thuc', 'pcf8563', 'dong ho thuc']],
    ['pcf8563', ['pcf8563', 'rtc', 'thoi gian thuc', 'dong ho thuc']],
    // Động cơ
    ['dong co', ['dong co', 'motor', 'servo', 'dc motor']],
    ['motor', ['dong co', 'motor', 'servo']],
    ['servo', ['servo', 'sg90', 'mg90s', 'mg996r', 'dong co servo']],
    ['sg90', ['sg90', 'servo', 'sg90s']],
    ['mg90', ['mg90s', 'servo']],
    ['mg996', ['mg996r', 'servo']],
    ['buoc', ['dong co buoc', 'stepper', 'buoc']],
    ['stepper', ['dong co buoc', 'stepper']],
    // Hiển thị
    ['man hinh', ['man hinh', 'lcd', 'oled', 'tft', 'hien thi', 'display']],
    ['lcd', ['lcd', 'lcd1602', 'man hinh lcd', 'lcd 1602']],
    ['lcd1602', ['lcd1602', 'lcd', 'man hinh lcd', 'lcd 1602']],
    ['oled', ['oled', 'oled 096', 'man hinh oled']],
    ['led', ['led', 'led don', 'led rgb', 'ws2812', 'neopixel']],
    ['neopixel', ['neopixel', 'ws2812', 'led rgb']],
    ['ws2812', ['ws2812', 'neopixel', 'led rgb']],
    // Board / Mạch
    ['yolobit', ['yolobit', 'yolo bit']],
    ['yolo bit', ['yolobit', 'yolo bit']],
    ['yolo uno', ['yolo uno', 'yolouno']],
    ['yolouno', ['yolo uno', 'yolouno']],
    ['mach mo rong', ['mach mo rong', 'grove shield', 'board mo rong', 'mmr']],
    ['grove', ['grove', 'mach mo rong', 'grove shield']],
    ['motion kit', ['motion kit', 'mach dieu khien dong co', 'motors driver']],
    // Điều khiển
    ['relay', ['relay', 'dong ngat', 'ro le']],
    ['dong ngat', ['dong ngat', 'relay']],
    ['nut nhan', ['nut nhan', 'button', 'nut nhan don']],
    ['keypad', ['keypad', 'ban phim', 'ban phim cam ung']],
    ['quat', ['quat', 'mini fan', 'quat mini', 'quat tu dong']],
    ['mini fan', ['mini fan', 'quat', 'quat mini']],
    // Kết nối
    ['bluetooth', ['bluetooth', 'ble', 'ket noi bluetooth']],
    ['wifi', ['wifi', 'ket noi wifi', 'iot']],
    ['i2c', ['i2c', 'giao tiep i2c']],
    ['iot', ['iot', 'internet of things', 'wifi', 'blynk', 'adafruit']],
    // Robot
    ['gamepad', ['gamepad', 'tay cam', 'receiver', 'dieu khien']],
    ['control hub', ['control hub', 'orc hub']],
    ['orc hub', ['control hub', 'orc hub']],
    ['do line', ['do line', 'do duong', 'cam bien line', 'line sensor']],
    // Thư viện / Cài đặt
    ['thu vien', ['thu vien', 'library', 'cai dat thu vien', 'extension']],
    ['library', ['thu vien', 'library', 'extension']],
    ['firmware', ['firmware', 'cap nhat firmware', 'fw', 'nap firmware']],
    ['driver', ['driver', 'cai dat driver', 'trinh dieu khien']],
    // Chủ đề
    ['lap trinh', ['lap trinh', 'code', 'chuong trinh', 'khoi lenh', 'block']],
    ['code', ['lap trinh', 'code', 'chuong trinh']],
    ['ket noi', ['ket noi', 'noi day', 'cach cam', 'cam day']],
    ['huong dan', ['huong dan', 'tai lieu', 'cach dung', 'tutorial']],
    // Dự án
    ['smart home', ['smart home', 'nha thong minh', 'nha thong minh yolo uno']],
    ['nha thong minh', ['nha thong minh', 'smart home']],
    ['thanh pho thong minh', ['thanh pho thong minh', 'city', 'citybit', 'smart city', 'tram giam sat']],
    ['smart city', ['thanh pho thong minh', 'smart city', 'tram giam sat']],
    ['tram giam sat', ['tram giam sat', 'thanh pho thong minh', 'smart city']],
    ['green house', ['green house', 'nha kinh', 'nong nghiep', 'nha kinh thong minh']],
    ['nha kinh', ['green house', 'nha kinh', 'nha kinh thong minh']],
    ['thung rac', ['thung rac', 'thung rac thong minh', 'trash bin']],
    // Cảm biến trạm giám sát
    ['sht30', ['sht30', 'sht3x', 'nhiet do', 'do am', 'cam bien nhiet do do am', 'nhiet do do am']],
    ['sht3x', ['sht30', 'sht3x', 'nhiet do do am']],
    ['guva', ['guva', 'guva s12sd', 'tia uv', 'uv', 'cuc tim', 'cam bien uv']],
    ['s12sd', ['guva s12sd', 'guva', 'tia uv', 'uv']],
    ['uv', ['uv', 'tia uv', 'cuc tim', 'guva', 'guva s12sd']],
    ['tia uv', ['tia uv', 'uv', 'cuc tim', 'guva s12sd']],
    ['acd1100', ['acd1100', 'co2', 'carbon dioxide', 'cam bien co2', 'khi co2']],
    ['co2', ['co2', 'acd1100', 'carbon dioxide', 'khi co2', 'chat luong khong khi']],
    ['dc01', ['dc01', 'bui min', 'pm2 5', 'pm25', 'cam bien bui', 'bui min pm2 5']],
    ['bui min', ['bui min', 'pm2 5', 'pm25', 'dc01', 'cam bien bui']],
    ['pm2 5', ['pm2 5', 'pm25', 'bui min', 'dc01']],
    ['toc do gio', ['toc do gio', 'gio', 'anemometer', 'cam bien gio']],
    ['nang luong mat troi', ['nang luong mat troi', 'solar', 'pin mat troi', 'pin nang luong']],
    ['solar', ['solar', 'nang luong mat troi', 'pin mat troi']],
    ['pin mat troi', ['pin mat troi', 'solar', 'nang luong mat troi']],
    // Robot short aliases
    ['rover', ['rover', 'robot rover', 'rover orc junior']],
    ['k2', ['k2', 'orc k2', 'robot orc k2', 'explorer']],
    ['k3', ['k3', 'orc k3', 'robot orc k3', 'master']],
    ['junior', ['junior', 'orc junior', 'rover orc junior', 'tieu hoc']],
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

const ORC_ROBOT_INTENT_ALIASES = [
    'lap rap',
    'lap trinh',
    'chuong trinh',
    'code',
    'noi day',
    'ket noi',
    'dong co',
    'encoder',
    'servo',
    'gamepad',
    'receiver',
    'control hub',
    'orc hub',
    'cam bien',
    'do line',
    'motion kit',
    'mo rong',
    'loi',
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
    const hasRobotIntent = hasAliasMatch(normalizedQuery, ORC_ROBOT_INTENT_ALIASES)
    const hasExplicitCompetitionPhrase = hasAliasMatch(normalizedQuery, [
        'open robotics challenge',
        'open robotics challenges',
    ])
    const isLikelyOrcCompetitionQuery =
        hasCompetitionIntent ||
        hasExplicitCompetitionPhrase ||
        (Boolean(bandConfig) && hasOrcAlias && !hasRobotHint && !hasRobotIntent)

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
        hasRobotIntent,
        isLikelyOrcCompetitionQuery,
    }
}

function getPageQualitySignals(content = '') {
    const normalizedContent = normalizeSearchText(content)
    const wordCount = normalizedContent
        ? normalizedContent.split(/\s+/).filter(Boolean).length
        : 0
    const linkCount = (String(content).match(/\[[^\]]+\]\([^)]+\)/g) || []).length
    const headingCount = (String(content).match(/^#{1,6}\s+/gm) || []).length
    const isEmpty = wordCount === 0
    const isThin = wordCount > 0 && wordCount < 45
    const isHubLike = wordCount < 90 && linkCount >= 1 && headingCount <= 2

    return {
        wordCount,
        linkCount,
        headingCount,
        isEmpty,
        isThin,
        isHubLike,
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

function getRobotOrcIntentBoost(pagePath, pageTitle, orcProfile) {
    if (!orcProfile?.hasOrcAlias || !orcProfile?.hasRobotIntent) {
        return 0
    }

    const isCompetitionPage =
        pagePath.includes('giaidau orc') ||
        pageTitle.includes('open robotics challenge') ||
        pageTitle.includes('bang explorer') ||
        pageTitle.includes('bang master') ||
        pageTitle.includes('bang junior')

    const isRobotOrcPage =
        pagePath.includes('orc bot') ||
        pagePath.includes('robot orc') ||
        pageTitle.includes('robot orc') ||
        pageTitle.includes('control hub')

    let boost = 0

    if (isCompetitionPage && !orcProfile.hasCompetitionIntent) {
        boost -= 320
    }

    if (isRobotOrcPage) {
        boost += 160
    }

    if (orcProfile.band === 'explorer') {
        if (pagePath.includes('orc k2') || pagePath.includes('robot orc k2')) {
            boost += 260
        }
    } else if (orcProfile.band === 'master') {
        if (pagePath.includes('orc k3') || pagePath.includes('robot orc k3')) {
            boost += 260
        }
    } else if (orcProfile.band === 'junior') {
        if (
            pagePath.includes('rover orc junior') ||
            pagePath.includes('robot rover') ||
            pageTitle.includes('rover orc junior')
        ) {
            boost += 240
        }
    }

    return boost
}

/**
 * Get the latest modification time from the content directory.
 * Samples up to 200 files for performance.
 */
function getContentLatestMtime(contentDir) {
    let latestMtime = 0
    let fileCount = 0
    const MAX_FILES = 200

    function walk(dir) {
        if (fileCount >= MAX_FILES || !fs.existsSync(dir)) return

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true })
            for (const entry of entries) {
                if (fileCount >= MAX_FILES) return
                const fullPath = path.join(dir, entry.name)

                if (entry.isDirectory()) {
                    walk(fullPath)
                } else if (/\.(mdx?|MDX?|js)$/.test(entry.name)) {
                    try {
                        const stat = fs.statSync(fullPath)
                        const mtime = stat.mtimeMs
                        if (mtime > latestMtime) latestMtime = mtime
                        fileCount++
                    } catch {}
                }
            }
        } catch {}
    }

    walk(contentDir)
    return latestMtime
}

/**
 * Check if the cache should be invalidated based on content file modifications.
 */
function shouldInvalidateCache() {
    const now = Date.now()

    // Throttle: only check filesystem every CACHE_CHECK_INTERVAL_MS
    if (now - lastCacheCheckTime < CACHE_CHECK_INTERVAL_MS) {
        return false
    }

    lastCacheCheckTime = now
    const contentDir = path.join(process.cwd(), 'content')
    const latestMtime = getContentLatestMtime(contentDir)

    if (latestMtime > cachedContentMtime) {
        cachedContentMtime = latestMtime
        return true
    }

    return false
}

/**
 * Recursively reads all .md and .mdx files from the content directory.
 * Returns an array of { path, title, content } objects.
 * Results are cached in-memory and auto-invalidated when content files change.
 */
export function getWikiContext() {
    if (cachedContext && !shouldInvalidateCache()) {
        return cachedContext
    }

    // Cache is stale or empty — rebuild
    if (cachedContext) {
        console.log('[wiki-context] Cache invalidated — content files changed, rebuilding...')
    }

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
    cachedContentMtime = getContentLatestMtime(contentDir)
    console.log(`[wiki-context] Loaded ${files.length} wiki pages into cache.`)
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
/**
 * Expand a search query using synonyms.
 * Returns additional terms from the synonym map.
 */
function expandWithSynonyms(searchTerms = []) {
    const expanded = new Set(searchTerms)

    // Check individual terms
    searchTerms.forEach((term) => {
        const synonyms = SYNONYM_MAP.get(term)
        if (synonyms) {
            synonyms.forEach((syn) => expanded.add(syn))
        }
    })

    // Check bigrams (2-word combinations)
    for (let i = 0; i < searchTerms.length - 1; i++) {
        const bigram = `${searchTerms[i]} ${searchTerms[i + 1]}`
        const synonyms = SYNONYM_MAP.get(bigram)
        if (synonyms) {
            synonyms.forEach((syn) => expanded.add(syn))
        }
    }

    return [...expanded]
}

export function searchWikiContext(query, topK = 5) {
    const pages = getWikiContext()
    if (!query) return pages.slice(0, topK)

    const normalizedQuery = normalizeSearchText(query)
    const orcProfile = buildOrcQueryProfile(query)
    const rawSearchTerms = getSearchTermsFromNormalized(normalizedQuery)
    const synonymExpandedTerms = expandWithSynonyms(rawSearchTerms)
    const searchTerms = [
        ...new Set([
            ...rawSearchTerms,
            ...synonymExpandedTerms,
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
        const quality = getPageQualitySignals(page.content)

        score += getCompetitionIntentBoost(pathLower, titleLower, orcProfile)
        score += getRobotOrcIntentBoost(pathLower, titleLower, orcProfile)

        if (quality.isEmpty) {
            score -= 500
        } else if (quality.isHubLike) {
            score -= 55
        } else if (quality.isThin) {
            score -= 20
        } else if (quality.wordCount >= 180) {
            score += 18
        } else if (quality.wordCount >= 90) {
            score += 8
        }

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

        // Score original (non-synonym) terms with higher weight
        rawSearchTerms.forEach((term) => {
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

            // Content matching — higher weight for specific/short terms (likely product names)
            const regex = new RegExp(term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'g')
            const matches = contentLower.match(regex)
            if (matches) {
                // Short specific terms like "dht20", "bmp280" get higher per-match score
                const isSpecificTerm = term.length <= 8 && /[0-9]/.test(term)
                const perMatchScore = isSpecificTerm ? 8 : 3
                score += Math.min(matches.length * perMatchScore, 40)
            }

            // Heading match bonus — if term appears in a heading inside the content
            const headingRegex = new RegExp(`^#{1,6}\\s+.*${term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'gm')
            if (headingRegex.test(contentLower)) {
                score += 35
            }
        })

        // Score synonym-expanded terms with lower weight
        searchTerms.forEach((term) => {
            if (rawSearchTerms.includes(term)) return // Already scored above

            if (titleLower.includes(term)) {
                score += 18
            }

            if (pathLower.includes(term)) {
                score += 14
            }

            const regex = new RegExp(term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'g')
            const matches = contentLower.match(regex)
            if (matches) {
                const isSpecificTerm = term.length <= 8 && /[0-9]/.test(term)
                const perMatchScore = isSpecificTerm ? 5 : 2
                score += Math.min(matches.length * perMatchScore, 20)
            }
        })

        return { ...page, exactMatch, score, ...quality }
    })

    const rankedPages = scoredPages
        .filter((page) => page.score > 0 && !page.isEmpty)
        .sort((a, b) => b.score - a.score)

    if (rankedPages.length === 0) return []

    const topPage = rankedPages[0]
    const secondPage = rankedPages[1]
    const shouldPreferSinglePage =
        (!topPage.isHubLike && !topPage.isThin && topPage.exactMatch &&
            secondPage && topPage.score >= secondPage.score * 2.0) ||
        (
            isSingleObjectQuestion(query) &&
            !topPage.isHubLike &&
            !topPage.isThin &&
            secondPage && topPage.score >= secondPage.score * 2.5
        )

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
    cachedContentMtime = 0
    lastCacheCheckTime = 0
}
