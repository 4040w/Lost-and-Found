import mongoose from 'mongoose'

import { Prop, Schema } from '@nestjs/mongoose'

import { UserModel } from '../user/user.model'

@Schema({
  collection: 'chat_message',
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: false,
  },
  versionKey: false,
})
export class ChatMessageModel {
  @Prop({ type: mongoose.Schema.Types.ObjectId, required: true, index: true })
  sessionId: string

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: UserModel.name, required: true })
  senderId: UserModel | string

  @Prop({ required: true })
  content: string

  // 'text' | 'image' — extensible without schema change
  @Prop({ default: 'text' })
  type: string
}
