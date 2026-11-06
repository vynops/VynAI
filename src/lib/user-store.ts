import fs from 'fs'
import path from 'path'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { writeJsonAtomically } from '@/lib/json-storage'

const DATA_DIR = path.join(process.cwd(), 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

export interface StoredUser {
  id: string
  email: string
  name: string
  passwordHash: string   // format: "salt:hash" (scrypt)
  role: 'admin' | 'viewer'
  authVersion: number
  createdAt: string
  lastLoginAt: string | null
  active: boolean
}

export type PublicUser = Omit<StoredUser, 'passwordHash' | 'authVersion'>

export function toPublicUser(user: StoredUser): PublicUser {
  const result: Partial<StoredUser> = { ...user }
  delete result.passwordHash
  delete result.authVersion
  return result as PublicUser
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
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')).users ?? []
    return users.map((user: StoredUser) => ({
      ...user,
      authVersion: Number.isSafeInteger(user.authVersion) && user.authVersion >= 0 ? user.authVersion : 0,
    }))
  } catch { return [] }
}

function saveUsers(users: StoredUser[]): void {
  ensure()
  writeJsonAtomically(USERS_FILE, { users })
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
    authVersion: 0,
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
  const credentialsChanged =
    (updates.role !== undefined && updates.role !== users[idx].role) ||
    (updates.active !== undefined && updates.active !== users[idx].active)
  users[idx] = {
    ...users[idx],
    ...updates,
    authVersion: users[idx].authVersion + (credentialsChanged ? 1 : 0),
  }
  saveUsers(users)
  return true
}

export function wouldRemoveLastActiveAdmin(
  users: readonly StoredUser[],
  id: string,
  updates: Partial<Pick<StoredUser, 'role' | 'active'>>
): boolean {
  const target = users.find(user => user.id === id)
  if (!target || target.role !== 'admin' || !target.active) return false
  const remainsAdmin = (updates.role ?? target.role) === 'admin'
  const remainsActive = (updates.active ?? target.active) === true
  return (!remainsAdmin || !remainsActive) &&
    users.filter(user => user.role === 'admin' && user.active).length <= 1
}

export function changePassword(id: string, newPassword: string): boolean {
  const users = listUsers()
  const idx = users.findIndex(u => u.id === id)
  if (idx < 0) return false
  users[idx] = {
    ...users[idx],
    passwordHash: hashPassword(newPassword),
    authVersion: users[idx].authVersion + 1,
  }
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
