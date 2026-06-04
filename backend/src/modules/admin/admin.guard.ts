import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { ADMIN } from '~/app.config'

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const adminToken = request.headers['admintoken'] as string

    if (!adminToken) {
      throw new UnauthorizedException('需要管理员权限')
    }

    try {
      const payload = this.jwtService.verify(adminToken, { secret: ADMIN.jwtSecret }) as any
      if (payload.role !== 'admin') {
        throw new Error('not admin')
      }
      return true
    } catch {
      throw new UnauthorizedException('管理员Token无效或已过期')
    }
  }
}
