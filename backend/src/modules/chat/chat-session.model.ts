import mongoose from 'mongoose'

import { Prop, Schema } from '@nestjs/mongoose'

import { UserModel } from '../user/user.model'

@Schema({
  collection: 'chat_session',
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  versionKey: false,
})
export class ChatSessionModel {
  @Prop({ required: true })
  itemId: string

  // 'lost' | 'found' — disambiguates which collection to read item from
  @Prop({ required: true })
  itemType: string

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: UserModel.name, required: true })
  finderId: UserModel | string

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: UserModel.name, required: true })
  loserId: UserModel | string

  @Prop({ default: '' })
  lastMessage: string

  @Prop({ default: () => new Date() })
  lastTime: Date

  // Per-participant read cursors. Epoch (1970) means "never read anything".
  @Prop({ default: () => new Date(0) })
  finderLastReadAt: Date

  @Prop({ default: () => new Date(0) })
  loserLastReadAt: Date

  // Soft-delete: array of user IDs that have removed the session from their view.
  // When both parties are listed here, the session can be hard-deleted by a sweep.
  @Prop({ type: [String], default: [] })
  deletedBy: string[]
}
