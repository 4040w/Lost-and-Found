import mongoose from 'mongoose'

import { Prop, Schema } from '@nestjs/mongoose'
import { UserModel } from '../user/user.model';

@Schema({
  collection: 'found',
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
  timestamps: {
    createdAt: 'created',
    updatedAt: false,
  },
  versionKey: false,

})
export class FoundModel  {
  @Prop()
  uid: string;

  @Prop()
  title: string;

  @Prop()
  contact: string;

  @Prop()
  category: string;

  @Prop()
  foundTime: Date;

  @Prop()
  detail: string;

  @Prop([String])
  image: string[];

  @Prop()
  place: string

  @Prop({ type: [mongoose.Schema.Types.Mixed], default: [] })
  places: Array<{
    name: string
    address?: string
    range?: string
    longitude?: number
    latitude?: number
    sort?: number
  }>

  @Prop()
  cover: string;

  @Prop({default:true})
  state: boolean

  // Approval workflow removed — posts go live immediately. Field kept (default 1 = approved)
  // for backwards-compatibility with historical records that referenced it.
  @Prop({ default: 1 })
  approved: number

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: UserModel.name })
  user: UserModel
}
