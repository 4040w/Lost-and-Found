import { Model } from 'mongoose'

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'

import { PhotosService } from '../photos/photos.service'
import { UserModel } from '../user/user.model'
import { FoundDto } from './found.dto'
import { FoundModel } from './found.model'

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
export class FoundService {
  constructor(
    @InjectModel(FoundModel.name)
    private readonly foundModel: Model<FoundModel>,
    private photosService: PhotosService,
  ) {}

  async save(user: UserModel, foundDto: FoundDto) {
    return this.foundModel.create({
      ...foundDto,
      foundTime: new Date(foundDto.foundTime),
      state: true,
      approved: 1,
      image: foundDto.image ?? [],
      cover: foundDto.cover ?? '',
      user,
    })
  }

  async addImage(url: string, id: string, cover: boolean) {
    let foundUpdate
    if (cover) {
      foundUpdate = await this.foundModel.updateOne(
        {
          _id: id,
        },
        { $push: { image: url }, $set: { cover: url } },
      )
    } else {
      foundUpdate = await this.foundModel.updateOne(
        {
          _id: id,
        },
        { $push: { image: url } },
      )
    }
    return foundUpdate
  }

  async total(user: UserModel) {
    const [UnclaimedCount, claimedCount] = await Promise.all([
      this.foundModel.count({ user: user._id, state: true }).lean(),
      this.foundModel.count({ user: user._id, state: false }).lean(),
    ])
    return { UnclaimedCount, claimedCount }
  }

  async foundList(
    pageCurrent: number,
    pageSize: number,
    last: boolean,
    state = true,
    user?: UserModel,
  ) {
    let foundData
    if (user) {
      foundData = await this.foundModel
        .find({ state, user: user._id })
        .sort({ _id: `${last ? 'desc' : 'asc'}` })
        .skip(pageSize * (pageCurrent - 1))
        .limit(pageSize)
        .populate('user')
        .lean()
    } else {
      foundData = await this.foundModel
        .find({ state })
        .sort({ _id: `${last ? 'desc' : 'asc'}` })
        .skip(pageSize * (pageCurrent - 1))
        .limit(pageSize)
        .populate('user')
        .lean()
    }

    const totalCount = await this.foundModel.find({ state }).count()
    const totalPages = Math.ceil(totalCount / pageSize)
    return {
      foundData: foundData.map(normalizeImageUrls),
      totalCount,
      totalPages,
    }
  }
  update(user: UserModel, lostDto: FoundDto, id: string) {
    return this.foundModel.updateOne({ _id: id }, lostDto)
  }
  async uploadPhoto(file: Express.Multer.File, id: string, cover: boolean) {
    if (!file) {
      return
    }
    const img = await this.photosService.uploadPhoto(file)

    return this.addImage(img, id, cover)
  }
  async findFoundById(id: string) {
    const doc = await this.foundModel.findOne({ _id: id }).populate('user').lean()
    return normalizeImageUrls(doc)
  }

  async removeUploadPhoto(id: string, url: string) {
    const found = await this.foundModel.findById(id)
    await this.foundModel.findByIdAndUpdate(id, {
      $pull: { image: url },

      $set: { cover: `${found.cover == url ? '' : found.cover}` },
    })
  }

  async changeState(user: UserModel, id: string, state: number) {
    const found = await this.foundModel.findById(id)
    const foundUserId = (found.user as any)?._id?.toString() ?? found.user?.toString()
    const currentUserId = (user as any)._id?.toString() ?? (user as any).id
    if (foundUserId === currentUserId) {
      return this.foundModel.updateOne(
        {
          _id: id,
        },
        { $set: { state: !!state } },
      )
    }
  }

  async delete(user: UserModel, id: string) {
    const found = await this.foundModel.findById(id)
    if (!found) throw new NotFoundException('物品不存在')
    const ownerId = (found.user as any)?._id?.toString() ?? found.user?.toString()
    const currentUserId = (user as any)._id?.toString() ?? (user as any).id
    if (ownerId !== currentUserId) throw new ForbiddenException('无权删除他人发布的信息')
    await this.foundModel.deleteOne({ _id: id })
    return { message: '删除成功' }
  }

  async search(search: string) {
    const reg = new RegExp(search, 'i')
    return this.foundModel.find({
      $or: [{ title: reg }, { category: reg }, { detail: reg },{ place: reg }],
      state: true
    })
  }
}
