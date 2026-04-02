function normalizeText(text = '') {
    return String(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/\u0111/g, 'd')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

function hasMatch(text = '', patterns = []) {
    return patterns.some((pattern) => pattern.test(text))
}

function countMatches(text = '', patterns = []) {
    return patterns.reduce(
        (total, pattern) => total + (pattern.test(text) ? 1 : 0),
        0
    )
}

function unique(items = []) {
    return [...new Set(items.filter(Boolean))]
}

function getCombinedContext({
    question = '',
    pagePath = '',
    pageTitle = '',
    relevantPages = [],
} = {}) {
    return normalizeText(
        [
            question,
            pagePath,
            pageTitle,
            ...relevantPages.flatMap((page) => [page?.title || '', page?.path || '']),
        ].join(' ')
    )
}

const PRODUCT_RULES = [
    {
        category: 'rover_orc_junior',
        label: 'Rover ORC Junior',
        score: 120,
        strong: [
            /\brover orc junior\b/,
            /\borc junior\b/,
            /\bjunior rover\b/,
        ],
        weak: [/\bjunior\b/],
        support: [/\brover\b/, /\borc\b/, /\brobot\b/],
        context: [
            /\brover orc junior\b/,
            /\brobot rover rover orc junior\b/,
        ],
    },
    {
        category: 'orc_k2',
        label: 'ORC K2',
        score: 115,
        strong: [
            /\borc k2\b/,
            /\brobot orc k2\b/,
        ],
        weak: [/\bk2\b/],
        support: [
            /\borc\b/,
            /\brobot\b/,
            /\bcontrol hub\b/,
            /\borc hub\b/,
            /\bgamepad\b/,
        ],
        context: [/\borc k2\b/, /\brobot orc k2\b/],
    },
    {
        category: 'orc_k3',
        label: 'ORC K3',
        score: 115,
        strong: [
            /\borc k3\b/,
            /\brobot orc k3\b/,
        ],
        weak: [/\bk3\b/],
        support: [
            /\borc\b/,
            /\brobot\b/,
            /\bcontrol hub\b/,
            /\borc hub\b/,
            /\bgamepad\b/,
        ],
        context: [/\borc k3\b/, /\brobot orc k3\b/],
    },
    {
        category: 'rover',
        label: 'Robot Rover',
        score: 98,
        strong: [/\brobot rover\b/, /\brover\b/],
        context: [/\brobot rover\b/, /\brover\b/],
    },
    {
        category: 'orc_thong_tin',
        label: 'Thong tin ORC',
        score: 92,
        strong: [
            /\bopen robotics challenge\b/,
            /\bthong tin orc\b/,
        ],
        support: [
            /\bthe le\b/,
            /\bquy dinh\b/,
            /\bdang ky\b/,
            /\bgiai dau\b/,
            /\bcuoc thi\b/,
            /\bso tay\b/,
            /\bsa ban\b/,
            /\barena\b/,
        ],
        context: [/\bgiaidau orc\b/, /\borc\b/],
    },
    {
        category: 'orc_robot',
        label: 'Robot ORC',
        score: 86,
        strong: [
            /\brobot orc\b/,
            /\borc hub\b/,
            /\bcontrol hub\b/,
        ],
        weak: [/\borc\b/],
        support: [/\brobot\b/, /\bgamepad\b/, /\bencoder\b/, /\bservo\b/],
        context: [/\borc bot\b/, /\brobot orc\b/],
    },
    {
        category: 'module_mach',
        label: 'Module va Mach mo rong',
        score: 84,
        strong: [
            /\bmotion kit\b/,
            /\bmach mo rong\b/,
            /\bmach dieu khien dong co\b/,
            /\bmodule\b/,
            /\bmodule cam bien\b/,
            /\b8 servo\b/,
            /\bservo8\b/,
            /\bservo8chs\b/,
            /\bmotors driver\b/,
            /\bdriver v1\b/,
        ],
        context: [/\bmodule\b/, /\bmach\b/, /\bmotion kit\b/],
    },
    {
        category: 'yolo_uno',
        label: 'Yolo UNO',
        score: 82,
        strong: [/\byolo uno\b/, /\byolouno\b/],
        context: [/\byolo uno\b/, /\byolouno\b/],
    },
    {
        category: 'yolobit',
        label: 'Yolo:Bit',
        score: 82,
        strong: [/\byolo bit\b/, /\byolobit\b/],
        context: [/\byolobit\b/, /\byolo bit\b/],
    },
    {
        category: 'ohstem_app',
        label: 'OhStem App',
        score: 76,
        strong: [/\bohstem app\b/, /\bapp ohstem\b/, /\bapp ohstem vn\b/],
        context: [/\bapp\b/, /\bohstem app\b/],
    },
]

const TOPIC_RULES = [
    {
        category: 'loi_su_co',
        label: 'Loi va su co',
        score: 98,
        patterns: [
            /\bloi\b/,
            /\bbao loi\b/,
            /\bkhong chay\b/,
            /\bkhong ket noi\b/,
            /\bkhong nap duoc\b/,
            /\bkhong hoat dong\b/,
            /\bsu co\b/,
            /\btruc trac\b/,
            /\bbug\b/,
        ],
    },
    {
        category: 'lap_rap',
        label: 'Lap rap',
        score: 92,
        patterns: [
            /\blap rap\b/,
            /\blap dat\b/,
            /\bcach lap\b/,
            /\bcach gan\b/,
            /\bcach bat oc\b/,
            /\bco cau\b/,
            /\bkhung\b/,
            /\bnoi day\b/,
            /\bso do\b/,
            /\bgan vao\b/,
        ],
    },
    {
        category: 'lap_trinh',
        label: 'Lap trinh',
        score: 92,
        patterns: [
            /\blap trinh\b/,
            /\bcode\b/,
            /\bchuong trinh\b/,
            /\bcode mau\b/,
            /\bkhoi lenh\b/,
            /\bblock\b/,
            /\bthu vien\b/,
        ],
    },
    {
        category: 'ket_noi_cai_dat',
        label: 'Ket noi va cai dat',
        score: 88,
        patterns: [
            /\bket noi\b/,
            /\bcai dat\b/,
            /\bdriver\b/,
            /\bcong com\b/,
            /\busb\b/,
            /\bbluetooth\b/,
            /\bwifi\b/,
            /\bpair\b/,
            /\bghep noi\b/,
            /\bnap code\b/,
            /\bcong nao\b/,
            /\bchan nao\b/,
            /\bi2c\b/,
        ],
    },
    {
        category: 'nang_cap_mo_rong',
        label: 'Nang cap va mo rong',
        score: 86,
        patterns: [
            /\bmo rong\b/,
            /\bnang cap\b/,
            /\bmotion kit\b/,
            /\bservo\b/,
            /\bdong co\b/,
            /\bencoder\b/,
            /\bmach\b/,
            /\bmodule\b/,
        ],
    },
    {
        category: 'thi_dau_the_le',
        label: 'Thi dau va the le',
        score: 90,
        patterns: [
            /\bthe le\b/,
            /\bquy dinh\b/,
            /\bdang ky\b/,
            /\bcuoc thi\b/,
            /\bgiai dau\b/,
            /\bso tay\b/,
            /\bsa ban\b/,
            /\barena\b/,
        ],
    },
    {
        category: 'tai_lieu_huong_dan',
        label: 'Tai lieu va huong dan',
        score: 80,
        patterns: [
            /\btai lieu\b/,
            /\bhuong dan\b/,
            /\bmanual\b/,
            /\blink\b/,
            /\bpdf\b/,
            /\bvideo\b/,
            /\bcanva\b/,
            /\byoutube\b/,
            /\bxem o dau\b/,
            /\bfile\b/,
        ],
    },
    {
        category: 'tong_quan',
        label: 'Thong tin tong quan',
        score: 72,
        patterns: [
            /\bla gi\b/,
            /\bgioi thieu\b/,
            /\bthong tin\b/,
            /\bcach dung\b/,
            /\bdung de lam gi\b/,
        ],
    },
]

const TAG_RULES = [
    ['rover', [/\brover\b/]],
    ['orc', [/\borc\b/, /\bopen robotics challenge\b/]],
    ['orc_k2', [/\borc k2\b/, /\bk2\b/]],
    ['orc_k3', [/\borc k3\b/, /\bk3\b/]],
    ['orc_junior', [/\borc junior\b/, /\brover orc junior\b/]],
    [
        'motion_kit',
        [/\bmotion kit\b/, /\bmach dieu khien dong co\b/, /\bmotors driver\b/, /\bdriver v1\b/],
    ],
    [
        'servo',
        [/\bservo\b/, /\bmg996\b/, /\bservo8\b/, /\b8 servo\b/, /\bservo8chs\b/],
    ],
    ['dong_co', [/\bdong co\b/, /\bmotor\b/, /\bga25\b/, /\bmecanum\b/]],
    ['encoder', [/\bencoder\b/]],
    ['gamepad', [/\bgamepad\b/, /\btay cam\b/, /\breceiver\b/]],
    ['control_hub', [/\bcontrol hub\b/, /\borc hub\b/, /\bhub\b/]],
    ['cam_bien', [/\bcam bien\b/, /\bsensor\b/]],
    ['do_line', [/\bdo line\b/, /\bline\b/, /\bline sensor\b/]],
    ['cam_bien_goc', [/\bcam bien goc\b/]],
    ['sieu_am', [/\bsieu am\b/, /\bultrasonic\b/]],
    ['bluetooth', [/\bbluetooth\b/]],
    ['usb', [/\busb\b/, /\btype c\b/]],
    ['i2c', [/\bi2c\b/]],
    ['thu_vien', [/\bthu vien\b/, /\blibrary\b/]],
    ['video', [/\bvideo\b/, /\byoutube\b/]],
    ['tai_lieu', [/\btai lieu\b/, /\bpdf\b/, /\bcanva\b/]],
    ['ohstem_app', [/\bohstem app\b/, /\bapp ohstem\b/]],
    ['yolobit', [/\byolo bit\b/, /\byolobit\b/]],
    ['yolo_uno', [/\byolo uno\b/, /\byolouno\b/]],
    ['module', [/\bmodule\b/, /\bmach mo rong\b/, /\bmach\b/]],
    ['mecanum', [/\bmecanum\b/]],
    ['ga25', [/\bga25\b/]],
    ['receiver', [/\breceiver\b/]],
    ['button', [/\bnut nhan\b/, /\bnut bam\b/]],
    ['lap_rap', [/\blap rap\b/, /\blap dat\b/, /\bcach lap\b/]],
    ['lap_trinh', [/\blap trinh\b/, /\bcode\b/, /\bkhoi lenh\b/, /\bblock\b/]],
    ['ket_noi', [/\bket noi\b/, /\bnoi day\b/, /\bcong nao\b/, /\bchan nao\b/]],
    ['mo_rong', [/\bmo rong\b/, /\bnang cap\b/]],
    ['thi_dau', [/\bthe le\b/, /\bquy dinh\b/, /\bgiai dau\b/, /\bsa ban\b/, /\barena\b/]],
    ['loi', [/\bloi\b/, /\bsu co\b/, /\btruc trac\b/]],
]

function detectProductCategory(combined = '') {
    const candidates = []
    const hasCompetitionIntent = hasMatch(combined, [
        /\bthe le\b/,
        /\bquy dinh\b/,
        /\bdang ky\b/,
        /\bgiai dau\b/,
        /\bcuoc thi\b/,
        /\bso tay\b/,
        /\bsa ban\b/,
        /\barena\b/,
    ])

    PRODUCT_RULES.forEach((rule) => {
        let score = 0

        if (hasMatch(combined, rule.strong || [])) {
            score += rule.score
        }

        if (rule.weak && hasMatch(combined, rule.weak)) {
            if (!rule.support || hasMatch(combined, rule.support)) {
                score += Math.max(48, Math.round(rule.score * 0.62))
            }
        }

        if (rule.context && countMatches(combined, rule.context)) {
            score += countMatches(combined, rule.context) * 18
        }

        if (rule.category === 'orc_thong_tin' && !hasCompetitionIntent) {
            score = 0
        }

        if (score > 0) {
            candidates.push({
                category: rule.category,
                label: rule.label,
                score,
            })
        }
    })

    if (!candidates.length) {
        return {
            category: 'khac',
            label: 'Khac',
            score: 0,
        }
    }

    return candidates.sort((left, right) => right.score - left.score)[0]
}

function detectTopicCategory(combined = '') {
    const candidates = TOPIC_RULES.map((rule) => ({
        category: rule.category,
        label: rule.label,
        score: countMatches(combined, rule.patterns) * rule.score,
    })).filter((item) => item.score > 0)

    if (!candidates.length) {
        return {
            category: 'khac',
            label: 'Khac',
            score: 0,
        }
    }

    return candidates.sort((left, right) => right.score - left.score)[0]
}

function buildTagSet(combined = '', productCategory = '', topicCategory = '') {
    const tags = new Set()

    if (productCategory && productCategory !== 'khac') {
        tags.add(productCategory)
    }

    if (topicCategory && topicCategory !== 'khac') {
        tags.add(topicCategory)
    }

    if (productCategory.startsWith('orc_')) {
        tags.add('orc_family')
    }

    if (productCategory.startsWith('rover')) {
        tags.add('rover_family')
    }

    TAG_RULES.forEach(([tag, patterns]) => {
        if (hasMatch(combined, patterns)) {
            tags.add(tag)
        }
    })

    return unique([...tags])
}

function getConfidence(productScore = 0, topicScore = 0, tagCount = 0) {
    const maxScore = Math.max(productScore, topicScore)

    if (maxScore >= 110 || tagCount >= 5) {
        return 'high'
    }

    if (maxScore >= 70 || tagCount >= 3) {
        return 'medium'
    }

    return 'low'
}

export function classifyAiChatQuestion({
    question = '',
    pagePath = '',
    pageTitle = '',
    relevantPages = [],
} = {}) {
    const combined = getCombinedContext({
        question,
        pagePath,
        pageTitle,
        relevantPages,
    })

    const product = detectProductCategory(combined)
    const topic = detectTopicCategory(combined)
    const tags = buildTagSet(combined, product.category, topic.category)

    return {
        productCategory: product.category,
        productLabel: product.label,
        topicCategory: topic.category,
        topicLabel: topic.label,
        classificationTags: tags.join(','),
        classificationConfidence: getConfidence(
            product.score,
            topic.score,
            tags.length
        ),
        classificationSource: 'auto_keywords_v3',
    }
}
