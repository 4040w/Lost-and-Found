import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { FoundModel } from '~/modules/found/found.model'
import { LostModel } from '~/modules/lost/lost.model'
import { UserModel } from '~/modules/user/user.model'

import { ClaimDto } from './claim.dto'
import { ClaimModel } from './claim.model'

function stripOrigin(url: string): string {
  if (!url || url.startsWith('/')) return url
  const m = url.match(/^https?:\/\/[^/]+(\/uploads\/.*)$/)
  return m ? m[1] : url
}

function normalizeItem<T extends { cover?: string; image?: string[] }>(doc: T): T {
  if (!doc) return doc
  if (doc.cover) doc.cover = stripOrigin(doc.cover)
  if (doc.image?.length) doc.image = doc.image.map(stripOrigin)
  return doc
}

@Injectable()
export class ClaimService {
  constructor(
    @InjectModel(ClaimModel.name)
    private readonly claimModel: Model<ClaimModel>,
    @InjectModel(LostModel.name)
    private readonly lostModel: Model<LostModel>,
    @InjectModel(FoundModel.name)
    private readonly foundModel: Model<FoundModel>,
  ) {}

  async getList(user: UserModel) {
    const userId = (user as any)._id?.toString() || (user as any).id
    const claims = await this.claimModel.find({ userId }).sort({ _id: 'desc' }).lean()
    if (claims.length === 0) return []

    const itemIds = claims.map((c) => c.itemId).filter(Boolean)

    const [lostDocs, foundDocs] = await Promise.all([
      this.lostModel.find({ _id: { $in: itemIds } }).lean(),
      this.foundModel.find({ _id: { $in: itemIds } }).lean(),
    ])

    const lostMap = new Map(
      lostDocs.map((d) => [String((d as any)._id), { ...normalizeItem(d), type: 'lost' }]),
    )
    const foundMap = new Map(
      foundDocs.map((d) => [String((d as any)._id), { ...normalizeItem(d), type: 'found' }]),
    )

    return claims.map((claim) => ({
      ...claim,
      item: lostMap.get(claim.itemId) ?? foundMap.get(claim.itemId) ?? null,
    }))
  }

  async apply(user: UserModel, claimDto: ClaimDto) {
    return this.claimModel.create({
      itemId: claimDto.itemId,
      userId: (user as any)._id?.toString() || (user as any).id,
      credentials: claimDto.credentials,
      contact: claimDto.contact,
      imgUrls: claimDto.imgUrls || [],
      status: 'pending',
    })
  }

  async cancel(user: UserModel, claimId: string) {
    const userId = (user as any)._id?.toString() || (user as any).id
    const claim = await this.claimModel.findOne({ _id: claimId, userId })
    if (!claim) {
      throw new NotFoundException('认领申请不存在')
    }
    if (claim.status !== 'pending') {
      throw new BadRequestException('只能撤销待审核的申请')
    }
    await this.claimModel.deleteOne({ _id: claimId })
  }
}
