import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ApiOperation } from '@nestjs/swagger'

import { Auth } from '~/common/decorator/auth.decorator'
import { CurrentUser } from '~/common/decorator/current-user.decorator'
import { UserModel } from '~/modules/user/user.model'

import { ClaimDto } from './claim.dto'
import { ClaimService } from './claim.service'

@Controller('claim')
export class ClaimController {
  constructor(private readonly claimService: ClaimService) {}

  @Get('list')
  @ApiOperation({ summary: '获取当前用户的认领申请列表' })
  @Auth()
  async getList(@CurrentUser() user: UserModel) {
    return this.claimService.getList(user)
  }

  @Post('apply')
  @ApiOperation({ summary: '提交认领申请' })
  @Auth()
  async apply(@CurrentUser() user: UserModel, @Body() claimDto: ClaimDto) {
    await this.claimService.apply(user, claimDto)
    return { message: '申请已提交，等待审核' }
  }

  @Delete(':id')
  @ApiOperation({ summary: '撤销认领申请' })
  @Auth()
  async cancel(@CurrentUser() user: UserModel, @Param('id') id: string) {
    await this.claimService.cancel(user, id)
    return { message: '申请已撤销' }
  }
}
