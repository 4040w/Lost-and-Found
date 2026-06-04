import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { AdminController } from './admin.controller'
import { AdminGuard } from './admin.guard'
import { AdminService } from './admin.service'

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
