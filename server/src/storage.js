import { existsSync, mkdirSync, unlinkSync } from 'fs'
import path from 'path'

export const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads'

export function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true })
}

export function deleteFile(filename) {
  const filePath = path.join(UPLOADS_DIR, filename)
  if (existsSync(filePath)) unlinkSync(filePath)
}
