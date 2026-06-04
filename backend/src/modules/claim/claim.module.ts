import { Module } from '@nestjs/common'

import { AuthModule } from '~/modules/auth/auth.module'

import { ClaimController } from './claim.controller'
import { ClaimService } from './claim.service'

@Module({
  imports: [AuthModule],
  controllers: [ClaimController],
  providers: [ClaimService],
})
export class ClaimModule {}
