import { Controller, Get, Param, Post, NotFoundException } from '@nestjs/common'
import { ApiOperation } from '@nestjs/swagger'

import { Auth } from '~/common/decorator/auth.decorator'

@Controller('message')
export class MessageController {
  @Get('list')
  @ApiOperation({ summary: '获取消息列表' })
  @Auth()
  getList() {
    return []
  }

  @Get('detail/:id')
  @ApiOperation({ summary: '获取消息详情' })
  @Auth()
  getDetail(@Param('id') _id: string) {
    // Message persistence is not yet implemented; return 404 for unknown IDs
    throw new NotFoundException('消息不存在')
  }

  @Post('markRead/:id')
  @ApiOperation({ summary: '标记消息已读' })
  @Auth()
  markRead(@Param('id') _id: string) {
    return { message: 'ok' }
  }
}
