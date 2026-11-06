import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export function writeJsonAtomically(filePath: string, value: unknown): void {
  const directory = path.dirname(filePath)
  fs.mkdirSync(directory, { recursive: true })

  const contents = JSON.stringify(value, null, 2)
  const suffix = `${process.pid}-${randomUUID()}`
  const temporaryPath = `${filePath}.${suffix}.tmp`
  const backupPath = `${filePath}.bak`
  const backupTemporaryPath = `${backupPath}.${suffix}.tmp`

  try {
    const descriptor = fs.openSync(temporaryPath, 'wx', 0o600)
    try {
      fs.writeFileSync(descriptor, contents, 'utf8')
      fs.fsyncSync(descriptor)
    } finally {
      fs.closeSync(descriptor)
    }

    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupTemporaryPath)
      fs.chmodSync(backupTemporaryPath, 0o600)
      fs.renameSync(backupTemporaryPath, backupPath)
    }

    fs.renameSync(temporaryPath, filePath)
    fs.chmodSync(filePath, 0o600)
    try {
      const directoryDescriptor = fs.openSync(directory, 'r')
      try { fs.fsyncSync(directoryDescriptor) } finally { fs.closeSync(directoryDescriptor) }
    } catch { /* Directory fsync is unavailable on some platforms. */ }
  } catch (error) {
    for (const temporary of [temporaryPath, backupTemporaryPath]) {
      try { fs.unlinkSync(temporary) } catch { /* Temporary file may not exist. */ }
    }
    throw error
  }
}