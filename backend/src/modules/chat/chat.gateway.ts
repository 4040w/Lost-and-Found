import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Server, WebSocket } from 'ws'
import { parse } from 'url'

import { UserModel } from '~/modules/user/user.model'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { AuthService } from '../auth/auth.service'
import { ChatService } from './chat.service'

// Extend ws WebSocket with our per-connection state
interface AuthedSocket extends WebSocket {
  userId?: string
  joinedSessionIds?: Set<string>
}

@WebSocketGateway({ path: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name)

  @WebSocketServer()
  server: Server

  // userId → set of live sockets (a user may have multiple devices)
  private readonly userSockets = new Map<string, Set<AuthedSocket>>()
  // sessionId → set of sockets currently subscribed
  private readonly sessionRooms = new Map<string, Set<AuthedSocket>>()

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly chatService: ChatService,
    @InjectModel(UserModel.name)
    private readonly userModel: Model<UserModel>,
  ) {}

  // ws adapter passes the upgrade Request as second arg to the handler signature.
  // We extract token from query string since WeChat Mini Program cannot reliably
  // set custom WS handshake headers.
  async handleConnection(client: AuthedSocket, request: any) {
    try {
      const { query } = parse(request.url, true)
      const token = (query.token as string) || ''
      if (!token) throw new Error('missing token')

      const payload = this.jwtService.verify(token) as { authCode: string }
      const user = await this.userModel.findOne({ openid: payload.authCode }).lean()
      if (!user) throw new Error('user not found')

      client.userId = user._id.toString()
      client.joinedSessionIds = new Set()

      if (!this.userSockets.has(client.userId)) {
        this.userSockets.set(client.userId, new Set())
      }
      this.userSockets.get(client.userId)!.add(client)

      this.send(client, 'connected', { userId: client.userId })
      this.logger.log(`WS connected user=${client.userId}`)
    } catch (err) {
      this.logger.warn(`WS auth failed: ${err.message}`)
      this.send(client, 'error', { message: '认证失败，请重新登录' })
      client.close()
    }
  }

  handleDisconnect(client: AuthedSocket) {
    if (client.userId) {
      this.userSockets.get(client.userId)?.delete(client)
      if (this.userSockets.get(client.userId)?.size === 0) {
        this.userSockets.delete(client.userId)
      }
    }
    client.joinedSessionIds?.forEach((sid) => {
      this.sessionRooms.get(sid)?.delete(client)
      if (this.sessionRooms.get(sid)?.size === 0) this.sessionRooms.delete(sid)
    })
  }

  @SubscribeMessage('joinSession')
  async handleJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { sessionId: string },
  ) {
    if (!client.userId) throw new WsException('未认证')
    const { sessionId } = data || ({} as any)
    if (!sessionId) throw new WsException('sessionId 缺失')

    const participants = await this.chatService.getSessionParticipants(sessionId)
    if (!participants) throw new WsException('会话不存在')
    if (
      client.userId !== participants.finderId &&
      client.userId !== participants.loserId
    ) {
      throw new WsException('无权加入该会话')
    }

    if (!this.sessionRooms.has(sessionId)) this.sessionRooms.set(sessionId, new Set())
    this.sessionRooms.get(sessionId)!.add(client)
    client.joinedSessionIds!.add(sessionId)

    this.send(client, 'joined', { sessionId })
    return { event: 'joined', data: { sessionId } }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { sessionId: string; content: string; type?: string },
  ) {
    if (!client.userId) throw new WsException('未认证')
    const { sessionId, content, type } = data || ({} as any)
    if (!sessionId || !content) throw new WsException('sessionId 或 content 缺失')

    const saved = await this.chatService.saveMessage(
      sessionId,
      client.userId,
      content,
      type || 'text',
    )

    // Broadcast to every socket subscribed to this session room
    const payload = {
      _id: saved._id,
      sessionId: sessionId,
      senderId: client.userId,
      content: saved.content,
      type: saved.type,
      createdAt: (saved as any).createdAt,
    }

    const room = this.sessionRooms.get(sessionId)
    room?.forEach((sock) => this.send(sock, 'receiveMessage', payload))

    return { event: 'sent', data: { _id: saved._id } }
  }

  // Helper: WeChat client receives raw JSON, so always wrap as { event, data }
  private send(client: WebSocket, event: string, data: any) {
    if (client.readyState !== client.OPEN) return
    client.send(JSON.stringify({ event, data }))
  }
}
