import * as fs from 'fs'
import * as path from 'path'

import { BadRequestException, Injectable } from '@nestjs/common'

// Resolved once at module load; `process.cwd()` is the project root when
// running via `npm run start:dev` or the compiled `dist/` entrypoint.
const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

@Injectable()
export class PhotosService {

  async uploadPhoto(file: Express.Multer.File) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('未收到文件，请确认请求中包含 file 字段')
    }

    // Create ./uploads if it does not yet exist (recursive is a no-op when it does)
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true })

    // Build a collision-free filename that preserves the original extension
    const ext = path.extname(file.originalname || '').toLowerCase() || '.bin'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`

    await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), file.buffer)

    return `/uploads/${filename}`
  }
}
