import fs from 'fs'
import path from 'path'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const DATA_DIR = path.join(process.cwd(), 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

export interface StoredUser {
  id: string
  email: string
  name: string
  passwordHash: string   // format: "salt:hash" (scrypt)
  role: 'admin' | 'viewer'
  createdAt: string
  lastLoginAt: string | null
  active: boolean
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  try {
    const derived = scryptSync(password, salt, 64)
    const hashBuf = Buffer.from(hash, 'hex')
    if (derived.length !== hashBuf.length) return false
    return timingSafeEqual(hashBuf, derived)
  } catch { return false }
}

export function listUsers(): StoredUser[] {
  ensure()
  if (!fs.existsSync(USERS_FILE)) return []
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')).users ?? [] } catch { return [] }
}

function saveUsers(users: StoredUser[]): void {
  ensure()
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2))
}

export function getUserByEmail(email: string): StoredUser | null {
  return listUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null
}

export function getUserById(id: string): StoredUser | null {
  return listUsers().find(u => u.id === id) ?? null
}

export function validateLogin(email: string, password: string): StoredUser | null {
  const user = getUserByEmail(email)
  if (!user || !user.active) return null
  if (!verifyPassword(password, user.passwordHash)) return null
  updateUser(user.id, { lastLoginAt: new Date().toISOString() })
  return user
}

export function createUser(input: {
  email: string; name: string; password: string; role: 'admin' | 'viewer'
}): StoredUser {
  const user: StoredUser = {
    id: randomBytes(8).toString('hex'),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    passwordHash: hashPassword(input.password),
    role: input.role,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    active: true,
  }
  saveUsers([...listUsers(), user])
  return user
}

export function updateUser(
  id: string,
  updates: Partial<Pick<StoredUser, 'name' | 'role' | 'active' | 'lastLoginAt'>>
): boolean {
  const users = listUsers()
  const idx = users.findIndex(u => u.id === id)
  if (idx < 0) return false
  users[idx] = { ...users[idx], ...updates }
  saveUsers(users)
  return true
}

export function changePassword(id: string, newPassword: string): boolean {
  const users = listUsers()
  const idx = users.findIndex(u => u.id === id)
  if (idx < 0) return false
  users[idx] = { ...users[idx], passwordHash: hashPassword(newPassword) }
  saveUsers(users)
  return true
}

export function deleteUser(id: string): boolean {
  const before = listUsers()
  const after = before.filter(u => u.id !== id)
  if (before.length === after.length) return false
  saveUsers(after)
  return true
}

/** Seed the admin user from env vars if no users exist yet. */
export function ensureAdminFromEnv(): void {
  if (listUsers().length > 0) return
  const email = process.env.VYNAI_ADMIN_EMAIL
  const password = process.env.VYNAI_ADMIN_PASSWORD
  if (!email || !password) return
  createUser({ email, name: 'Admin', password, role: 'admin' })
}
