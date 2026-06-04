import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common'
import { ApiOperation } from '@nestjs/swagger'

import { Auth } from '~/common/decorator/auth.decorator'
import { CurrentUser } from '~/common/decorator/current-user.decorator'
import { UserModel } from '~/modules/user/user.model'

import { CreateSessionDto } from './chat.dto'
import { ChatService } from './chat.service'

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('session')
  @ApiOperation({ summary: '创建或获取与某物品发布者的会话' })
  @Auth()
  async createSession(
    @CurrentUser() user: UserModel,
    @Body() dto: CreateSessionDto,
  ) {
    return this.chatService.findOrCreateSession(user, dto.itemId, dto.itemType)
  }

  @Get('sessions')
  @ApiOperation({ summary: '当前用户的会话列表（含未读、对方、物品、最后一条消息）' })
  @Auth()
  async listSessions(@CurrentUser() user: UserModel) {
    return this.chatService.listSessions(user)
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: '删除/退出会话（软删除，双方都删除时硬删）' })
  @Auth()
  async deleteSession(
    @CurrentUser() user: UserModel,
    @Param('id') id: string,
  ) {
    return this.chatService.softDeleteSession(id, user)
  }

  @Get('unread-count')
  @ApiOperation({ summary: '当前用户所有未读消息总数（用于「我的」红点）' })
  @Auth()
  async unreadCount(@CurrentUser() user: UserModel) {
    const count = await this.chatService.globalUnreadCount(user)
    return { count }
  }

  @Post('sessions/:id/read')
  @ApiOperation({ summary: '标记会话已读' })
  @Auth()
  async markRead(
    @CurrentUser() user: UserModel,
    @Param('id') id: string,
  ) {
    return this.chatService.markRead(id, user)
  }

  @Get('history/:sessionId')
  @ApiOperation({ summary: '会话历史消息' })
  @Auth()
  async getHistory(
    @CurrentUser() user: UserModel,
    @Param('sessionId') sessionId: string,
  ) {
    return this.chatService.getHistory(sessionId, user)
  }
}
