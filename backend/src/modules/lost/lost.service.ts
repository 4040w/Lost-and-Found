import { Model } from 'mongoose'

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'

import { UserModel } from '~/modules/user/user.model'

import { PhotosService } from '../photos/photos.service'
import { LostDto } from './lost.dto'
import { LostModel } from './lost.model'

function stripAbsoluteOrigin(url: string): string {
  if (!url || url.startsWith('/')) return url
  const match = url.match(/^https?:\/\/[^/]+(\/uploads\/.*)$/)
  return match ? match[1] : url
}

function normalizeImageUrls<T extends { cover?: string; image?: string[] }>(doc: T): T {
  if (!doc) return doc
  if (doc.cover) doc.cover = stripAbsoluteOrigin(doc.cover)
  if (doc.image?.length) doc.image = doc.image.map(stripAbsoluteOrigin)
  return doc
}

@Injectable()
export class LostService {
  constructor(
    @InjectModel(LostModel.name)
    private readonly lostModel: Model<LostModel>,
    private photosService: PhotosService,
  ) {}

  async save(user: UserModel, LostDto: LostDto) {
    return this.lostModel.create({
      ...LostDto,
      lostTime: new Date(LostDto.lostTime),
      state: true,
      approved: 1,
      image: LostDto.image ?? [],
      cover: LostDto.cover ?? '',
      user,
    })
  }

  update(user: UserModel, lostDto: LostDto, id: string) {
    return this.lostModel.updateOne({ _id: id }, lostDto)
  }

  async addImage(url: string, id: string, cover: boolean) {
    let lostUpdate

    if (cover) {
      lostUpdate = await this.lostModel.updateOne(
        {
          _id: id,
        },
        { $push: { image: url }, $set: { cover: url } },
      )
    } else {
      lostUpdate = await this.lostModel.updateOne(
        {
          _id: id,
        },
        { $push: { image: url } },
      )
    }

    return lostUpdate
  }

  async total(user: UserModel) {
    const [lostCount, foundCount] = await Promise.all([
      this.lostModel.count({ user: user._id, state: true }).lean(),
      this.lostModel.count({ user: user._id, state: false }).lean(),
    ])
    return { lostCount, foundCount }
  }

  async lostList(
    pageCurrent: number,
    pageSize: number,
    last: boolean,
    state = true,
    user?: UserModel,
  ) {
    let lostData
    if (user) {
      lostData = await this.lostModel
        .find({ state, user: user._id })
        .sort({ _id: `${last ? 'desc' : 'asc'}` })
        .skip(pageSize * (pageCurrent - 1))
        .limit(pageSize)
        .populate('user')
        .lean()
    } else {
      lostData = await this.lostModel
        .find({ state })
        .sort({ _id: `${last ? 'desc' : 'asc'}` })
        .skip(pageSize * (pageCurrent - 1))
        .limit(pageSize)
        .populate('user')
        .lean()
    }

    const totalCount = await this.lostModel.find({ state }).count()
    const totalPages = Math.ceil(totalCount / pageSize)

    return {
      lostData: lostData.map(normalizeImageUrls),
      totalCount,
      totalPages,
    }
  }

  async uploadPhoto(file: Express.Multer.File, id: string, cover: boolean) {
    if (!file) {
      return
    }

    const img = await this.photosService.uploadPhoto(file)
    return this.addImage(img, id, cover)
  }

  async removeUploadPhoto(id: string, url: string) {
    const lost = await this.lostModel.findById(id)
    await this.lostModel.findByIdAndUpdate(id, {
      $pull: { image: url },
      $set: {
        cover: `${lost.cover == url ? lost.image[1] || '' : lost.cover}`,
      },
    })
  }

  async findLostById(id: string) {
    const doc = await this.lostModel.findOne({ _id: id }).populate('user').lean()
    return normalizeImageUrls(doc)
  }

  async changeState(user: UserModel, id: string, state: number) {
    const lost = await this.lostModel.findById(id)
    const lostUserId = (lost.user as any)?._id?.toString() ?? lost.user?.toString()
    const currentUserId = (user as any)._id?.toString() ?? (user as any).id
    if (lostUserId === currentUserId) {
      return this.lostModel.updateOne(
        {
          _id: id,
        },
        { $set: { state: !!state } },
      )
    }
  }

  async delete(user: UserModel, id: string) {
    const lost = await this.lostModel.findById(id)
    if (!lost) throw new NotFoundException('物品不存在')
    const ownerId = (lost.user as any)?._id?.toString() ?? lost.user?.toString()
    const currentUserId = (user as any)._id?.toString() ?? (user as any).id
    if (ownerId !== currentUserId) throw new ForbiddenException('无权删除他人发布的信息')
    await this.lostModel.deleteOne({ _id: id })
    return { message: '删除成功' }
  }

  async search(search: string) {
    const reg = new RegExp(search, 'i')
    return this.lostModel.find({
      $or: [{ title: reg }, { category: reg }, { detail: reg },{ place: reg }],
      state: true
    })
  }
}
