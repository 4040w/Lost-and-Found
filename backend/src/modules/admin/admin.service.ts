import { ForbiddenException, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { ADMIN } from '~/app.config'
import { FoundModel } from '~/modules/found/found.model'
import { LostModel } from '~/modules/lost/lost.model'
import { UserModel } from '~/modules/user/user.model'

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(UserModel.name) private readonly userModel: Model<UserModel>,
    @InjectModel(LostModel.name) private readonly lostModel: Model<LostModel>,
    @InjectModel(FoundModel.name) private readonly foundModel: Model<FoundModel>,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    if (username !== ADMIN.username || password !== ADMIN.password) {
      throw new ForbiddenException('账号或密码错误')
    }
    const token = this.jwtService.sign(
      { role: 'admin', username },
      { secret: ADMIN.jwtSecret, expiresIn: '7d' },
    )
    return { code: 200, data: { token } }
  }

  async getItemList() {
    const [lostItems, foundItems] = await Promise.all([
      this.lostModel.find().populate('user').lean(),
      this.foundModel.find().populate('user').lean(),
    ])
    return [
      ...lostItems.map((item: any) => ({
        ...item,
        id: item._id,
        type: 'lost',
        feature: item.detail,
        status: item.approved ?? 0,
      })),
      ...foundItems.map((item: any) => ({
        ...item,
        id: item._id,
        type: 'found',
        feature: item.detail,
        status: item.approved ?? 0,
      })),
    ]
  }

  async getUserList() {
    const users = await this.userModel.find().lean()
    return users.map((u: any) => ({
      ...u,
      id: u._id,
      username: u.nickName,
      banned: u.banned || false,
    }))
  }

  async banUser(id: string) {
    await this.userModel.updateOne({ _id: id }, { $set: { banned: true } })
    return { message: '操作成功' }
  }

  async unbanUser(id: string) {
    await this.userModel.updateOne({ _id: id }, { $set: { banned: false } })
    return { message: '操作成功' }
  }
}
