import { Module } from '@nestjs/common'
import { MongooseModule, SchemaFactory } from '@nestjs/mongoose'

import { AuthModule } from '~/modules/auth/auth.module'
import { FoundModel } from '~/modules/found/found.model'
import { LostModel } from '~/modules/lost/lost.model'

import { ChatController } from './chat.controller'
import { ChatGateway } from './chat.gateway'
import { ChatMessageModel } from './chat-message.model'
import { ChatSessionModel } from './chat-session.model'
import { ChatService } from './chat.service'

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: ChatSessionModel.name, schema: SchemaFactory.createForClass(ChatSessionModel) },
      { name: ChatMessageModel.name, schema: SchemaFactory.createForClass(ChatMessageModel) },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
