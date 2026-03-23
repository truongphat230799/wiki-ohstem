import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// --- Config ---
const JWT_SECRET = process.env.JWT_SECRET || 'ohstem-wiki-secret-key-change-in-production-2026'
const JWT_EXPIRES = '7d'
const USERS_FILE = path.join(process.cwd(), 'data', 'users.json')
const SALT_ROUNDS = 10

// --- Password ---
export function hashPassword(password) {
    return bcrypt.hashSync(password, SALT_ROUNDS)
}

export function verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash)
}

// --- JWT ---
export function createToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
    )
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET)
    } catch {
        return null
    }
}

// --- Users CRUD ---
function ensureDataDir() {
    const dir = path.dirname(USERS_FILE)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

export function getUsers() {
    ensureDataDir()
    if (!fs.existsSync(USERS_FILE)) {
        // Create default admin account
        const defaultUsers = {
            users: [
                {
                    id: crypto.randomUUID(),
                    username: 'admin',
                    passwordHash: hashPassword('admin'),
                    displayName: 'Admin',
                    role: 'level1', // level1 = super admin
                    createdAt: new Date().toISOString(),
                    lastLogin: null,
                },
            ],
        }
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2), 'utf-8')
        return defaultUsers.users
    }
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'))
    return data.users || []
}

export function saveUsers(users) {
    ensureDataDir()
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2), 'utf-8')
}

export function findUser(username) {
    return getUsers().find((u) => u.username === username)
}

export function findUserById(id) {
    return getUsers().find((u) => u.id === id)
}

export function createUser({ username, password, displayName, role }) {
    const users = getUsers()
    if (users.find((u) => u.username === username)) {
        throw new Error(`Username "${username}" đã tồn tại`)
    }
    const newUser = {
        id: crypto.randomUUID(),
        username,
        passwordHash: hashPassword(password),
        displayName: displayName || username,
        role: role || 'level2',
        createdAt: new Date().toISOString(),
        lastLogin: null,
    }
    users.push(newUser)
    saveUsers(users)
    return newUser
}

export function updateUser(id, updates) {
    const users = getUsers()
    const idx = users.findIndex((u) => u.id === id)
    if (idx === -1) throw new Error('User not found')

    if (updates.password) {
        users[idx].passwordHash = hashPassword(updates.password)
    }
    if (updates.displayName !== undefined) {
        users[idx].displayName = updates.displayName
    }
    if (updates.role !== undefined) {
        users[idx].role = updates.role
    }
    if (updates.lastLogin !== undefined) {
        users[idx].lastLogin = updates.lastLogin
    }

    saveUsers(users)
    return users[idx]
}

export function deleteUser(id) {
    const users = getUsers()
    const filtered = users.filter((u) => u.id !== id)
    if (filtered.length === users.length) throw new Error('User not found')
    saveUsers(filtered)
}

// --- Request helpers ---
export function getCurrentUser(request) {
    const cookie = request.headers.get('cookie') || ''
    const match = cookie.match(/admin_token=([^;]+)/)
    if (!match) return null
    const payload = verifyToken(match[1])
    if (!payload) return null
    return findUserById(payload.id)
}

// Sanitize user for client (remove passwordHash)
export function sanitizeUser(user) {
    if (!user) return null
    const { passwordHash, ...safe } = user
    return safe
}
