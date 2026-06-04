import { Prop, Schema } from '@nestjs/mongoose'

@Schema({
  collection: 'claim',
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
  timestamps: {
    createdAt: 'created',
    updatedAt: false,
  },
  versionKey: false,
})
export class ClaimModel {
  @Prop()
  itemId: string

  @Prop()
  userId: string

  @Prop()
  credentials: string

  @Prop()
  contact: string

  @Prop([String])
  imgUrls: string[]

  @Prop({ default: 'pending' })
  status: string
}
