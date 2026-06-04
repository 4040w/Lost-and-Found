import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import { FoundModel } from '~/modules/found/found.model'
import { LostModel } from '~/modules/lost/lost.model'
import { UserModel } from '~/modules/user/user.model'

import { ChatMessageModel } from './chat-message.model'
import { ChatSessionModel } from './chat-session.model'

export interface SessionListItem {
  sessionId: string
  counterparty: { id: string; username: string; avatarUrl: string } | null
  associatedItem: { id: string; name: string; type: string } | null
  lastMessage: { content: string; createdAt: Date } | null
  unreadCount: number
  updatedAt: Date
}

function stripAbsoluteOrigin(url: string): string {
  if (!url || url.startsWith('/')) return url
  const match = url.match(/^https?:\/\/[^/]+(\/uploads\/.*)$/)
  return match ? match[1] : url
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatSessionModel.name)
    private readonly sessionModel: Model<ChatSessionModel>,
    @InjectModel(ChatMessageModel.name)
    private readonly messageModel: Model<ChatMessageModel>,
    @InjectModel(LostModel.name)
    private readonly lostModel: Model<LostModel>,
    @InjectModel(FoundModel.name)
    private readonly foundModel: Model<FoundModel>,
  ) {}

  async findOrCreateSession(
    currentUser: UserModel,
    itemId: string,
    itemType: string,
  ) {
    const currentUserId = currentUser._id.toString()
    const item =
      itemType === 'lost'
        ? await this.lostModel.findById(itemId).lean()
        : await this.foundModel.findById(itemId).lean()

    if (!item) throw new NotFoundException('物品不存在')

    const posterId = (item as any).user?.toString?.()
    if (!posterId) throw new BadRequestException('物品没有发布人，无法发起聊天')
    if (posterId === currentUserId) {
      throw new BadRequestException('不能和自己聊天')
    }

    const loserId = itemType === 'lost' ? posterId : currentUserId
    const finderId = itemType === 'lost' ? currentUserId : posterId

    const existing = await this.sessionModel.findOne({
      itemId,
      itemType,
      finderId,
      loserId,
    })

    if (existing) {
      // If the requester previously soft-deleted, undelete now that they re-opened
      if (existing.deletedBy?.includes(currentUserId)) {
        existing.deletedBy = existing.deletedBy.filter((id) => id !== currentUserId)
        await existing.save()
      }
      return existing.toObject()
    }

    return (await this.sessionModel.create({
      itemId,
      itemType,
      finderId,
      loserId,
    })).toObject()
  }

  // Enriched list: counterparty, associated item, last message, per-user unread count.
  // Excludes sessions the caller previously soft-deleted.
  async listSessions(user: UserModel): Promise<SessionListItem[]> {
    const userId = user._id.toString()

    const sessions = await this.sessionModel
      .find({
        $or: [{ finderId: userId }, { loserId: userId }],
        deletedBy: { $ne: userId },
      })
      .sort({ lastTime: -1 })
      .populate('finderId', 'nickName avatarUrl')
      .populate('loserId', 'nickName avatarUrl')
      .lean()

    // Resolve item docs and unread counts in parallel
    const enriched = await Promise.all(
      sessions.map(async (s: any) => {
        const sessionId = s._id.toString()
        const isFinder = s.finderId?._id?.toString() === userId
        const counterpartyDoc = isFinder ? s.loserId : s.finderId
        const myLastReadAt = isFinder ? s.finderLastReadAt : s.loserLastReadAt

        const [item, unreadCount, lastMsg] = await Promise.all([
          this.resolveItem(s.itemId, s.itemType),
          this.messageModel.countDocuments({
            sessionId: new Types.ObjectId(sessionId),
            senderId: { $ne: new Types.ObjectId(userId) },
            createdAt: { $gt: myLastReadAt || new Date(0) },
          }),
          this.messageModel
            .findOne({ sessionId: new Types.ObjectId(sessionId) })
            .sort({ createdAt: -1 })
            .lean(),
        ])

        return {
          sessionId,
          counterparty: counterpartyDoc
            ? {
                id: counterpartyDoc._id?.toString?.() || '',
                username: counterpartyDoc.nickName || '微信用户',
                avatarUrl: stripAbsoluteOrigin(counterpartyDoc.avatarUrl || ''),
              }
            : null,
          associatedItem: item,
          lastMessage: lastMsg
            ? {
                content:
                  lastMsg.type === 'text' ? lastMsg.content : '[图片]',
                createdAt: (lastMsg as any).createdAt,
              }
            : null,
          unreadCount,
          updatedAt: s.lastTime || s.updatedAt,
        } as SessionListItem
      }),
    )

    return enriched
  }

  // Total unread across all the caller's sessions — for the My-page red dot
  async globalUnreadCount(user: UserModel): Promise<number> {
    const userId = user._id.toString()
    const sessions = await this.sessionModel
      .find({
        $or: [{ finderId: userId }, { loserId: userId }],
        deletedBy: { $ne: userId },
      })
      .lean()

    if (!sessions.length) return 0

    const counts = await Promise.all(
      sessions.map((s: any) => {
        const isFinder = s.finderId?.toString() === userId
        const myLastReadAt = isFinder ? s.finderLastReadAt : s.loserLastReadAt
        return this.messageModel.countDocuments({
          sessionId: new Types.ObjectId(s._id.toString()),
          senderId: { $ne: new Types.ObjectId(userId) },
          createdAt: { $gt: myLastReadAt || new Date(0) },
        })
      }),
    )
    return counts.reduce((sum, n) => sum + n, 0)
  }

  async markRead(sessionId: string, user: UserModel) {
    const session = await this.sessionModel.findById(sessionId)
    if (!session) throw new NotFoundException('会话不存在')

    const userId = user._id.toString()
    const finderId = session.finderId?.toString?.()
    const loserId = session.loserId?.toString?.()

    if (userId === finderId) session.finderLastReadAt = new Date()
    else if (userId === loserId) session.loserLastReadAt = new Date()
    else throw new BadRequestException('无权访问该会话')

    await session.save()
    return { message: 'ok' }
  }

  async softDeleteSession(sessionId: string, user: UserModel) {
    const session = await this.sessionModel.findById(sessionId)
    if (!session) throw new NotFoundException('会话不存在')

    const userId = user._id.toString()
    const finderId = session.finderId?.toString?.()
    const loserId = session.loserId?.toString?.()
    if (userId !== finderId && userId !== loserId) {
      throw new BadRequestException('无权删除该会话')
    }

    if (!session.deletedBy.includes(userId)) {
      session.deletedBy = [...session.deletedBy, userId]
    }

    // Both parties left → hard delete the whole thread
    if (
      session.deletedBy.includes(finderId!) &&
      session.deletedBy.includes(loserId!)
    ) {
      await Promise.all([
        this.messageModel.deleteMany({
          sessionId: new Types.ObjectId(sessionId),
        }),
        session.deleteOne(),
      ])
      return { message: 'deleted', hardDeleted: true }
    }

    await session.save()
    return { message: 'deleted', hardDeleted: false }
  }

  async getHistory(sessionId: string, user: UserModel) {
    const session = await this.sessionModel.findById(sessionId).lean()
    if (!session) throw new NotFoundException('会话不存在')

    const userId = user._id.toString()
    const finderId = session.finderId?.toString?.()
    const loserId = session.loserId?.toString?.()
    if (userId !== finderId && userId !== loserId) {
      throw new BadRequestException('无权访问该会话')
    }

    return this.messageModel
      .find({ sessionId: new Types.ObjectId(sessionId) })
      .sort({ createdAt: 1 })
      .lean()
  }

  async saveMessage(
    sessionId: string,
    senderId: string,
    content: string,
    type = 'text',
  ) {
    const session = await this.sessionModel.findById(sessionId)
    if (!session) throw new NotFoundException('会话不存在')

    const finderId = session.finderId?.toString?.()
    const loserId = session.loserId?.toString?.()
    if (senderId !== finderId && senderId !== loserId) {
      throw new BadRequestException('无权在该会话发言')
    }

    const message = await this.messageModel.create({
      sessionId: new Types.ObjectId(sessionId),
      senderId: new Types.ObjectId(senderId),
      content,
      type,
    })

    // Bump preview + auto-mark-as-read for the sender (they just typed it).
    // Also undelete the session for both sides — a new message revives a soft-deleted thread.
    session.lastMessage = type === 'text' ? content : '[图片]'
    session.lastTime = new Date()
    session.deletedBy = []
    if (senderId === finderId) session.finderLastReadAt = new Date()
    if (senderId === loserId) session.loserLastReadAt = new Date()
    await session.save()

    return message
  }

  async getSessionParticipants(sessionId: string) {
    const session = await this.sessionModel.findById(sessionId).lean()
    if (!session) return null
    return {
      finderId: session.finderId?.toString?.(),
      loserId: session.loserId?.toString?.(),
    }
  }

  // Resolves a (possibly deleted) item to a minimal view, or null when gone.
  private async resolveItem(
    itemId: string,
    itemType: string,
  ): Promise<{ id: string; name: string; type: string } | null> {
    try {
      const doc =
        itemType === 'lost'
          ? await this.lostModel.findById(itemId).select('title').lean()
          : await this.foundModel.findById(itemId).select('title').lean()
      if (!doc) return null
      return {
        id: (doc as any)._id.toString(),
        name: (doc as any).title || '',
        type: itemType,
      }
    } catch {
      return null
    }
  }
}
