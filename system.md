# 校园失物招领平台 — 系统文档

## 1. 系统概述

校园失物招领平台是一个面向在校学生的失物招领服务，由微信小程序前端与 NestJS 后端组成。学生通过微信授权登录后可以发布寻物启事或招领信息、与物品发布者实时聊天、提交认领申请；管理员通过独立账号管理用户。

| 项目 | 值 |
|---|---|
| 后端版本 | 0.4.5 |
| 后端框架 | NestJS 8 + TypeScript |
| 数据库 | MongoDB 4（Mongoose 6） |
| 前端平台 | 微信小程序（WXML / WXSS / JS） |
| 实时通讯 | WebSocket（RFC 6455，ws 库） |
| 文件存储 | 本地文件系统 `./uploads/` |
| 认证方式 | JWT（用户 7 天，管理员 7 天，双独立密钥） |

---

## 2. 系统架构

```
┌───────────────────────────────────┐
│        微信小程序（前端）           │
│  WXML · WXSS · JS · wx.* API     │
│  wx.request  ──HTTP──►           │
│  wx.connectSocket ──WS──►        │
└───────────────┬───────────────────┘
                │  HTTP / WebSocket
                ▼
┌───────────────────────────────────┐
│       NestJS 后端（port 2349）     │
│                                   │
│  ┌─────────────────────────────┐  │
│  │  ResponseInterceptor（全局）  │  │  arrays → { data: [...] }
│  │  AllExceptionsFilter（全局）  │  │
│  │  ValidationPipe（全局）       │  │
│  └─────────────────────────────┘  │
│                                   │
│  REST 模块:                        │
│  user · lost · found · aggregate  │
│  claim · chat · photos · location │
│  admin · auth · message · disable │
│                                   │
│  WebSocket:                       │
│  ChatGateway  /chat               │
│                                   │
│  Static:                          │
│  /uploads/*  → ./uploads/         │
└───────────────┬───────────────────┘
                │  Mongoose ODM
                ▼
┌───────────────────────────────────┐
│  MongoDB  db: LostAndFound        │
│  user · lost · found              │
│  chat_session · chat_message      │
│  claim                            │
└───────────────────────────────────┘
```

### 2.1 路由前缀规则

| 环境 | 全局前缀 | 示例 |
|---|---|---|
| 开发（NODE_ENV=development） | 无 | `/user` |
| 生产 | `api/v2` | `/api/v2/user` |

前端的 `normalizePath()` 会在拼接请求时自动剥离 `/api/v{n}` 和 `/api` 前缀，因此前端代码可以统一写相对路径（如 `/claim/apply`），无论后端部署环境如何都能正确对齐。

### 2.2 响应格式约定

全局 `ResponseInterceptor` 对响应体做如下包装：

- 控制器返回**数组** → `{ data: [...] }`
- 控制器返回**对象**或原始值 → 直接透传，不包装

前端统一以 `res?.data || (Array.isArray(res) ? res : [])` 归一化两种形态。

---

## 3. 主要技术实现方法

### 3.1 用户认证管道（JWT + Passport）

**JWT 密钥生成策略**

`auth.module.ts` 按以下优先级确定签名密钥：

```
SECURITY.jwtSecret（app.config.ts）
  → 若为空，使用 node-machine-id 生成的机器 ID（Base64 截取前 15 位）
    → 若均失败，使用硬编码后备字符串
```

JWT 算法固定为 HS256，用户侧有效期 7 天；管理员侧使用独立密钥 `ADMIN.jwtSecret` 签发独立 token，两套体系完全隔离。

**用户认证流程（逐层调用）**

```
HTTP 请求
  └─ AuthGuard（继承 @nestjs/passport 的 AuthGuard('jwt')）
       ├─ 若 request.user 已存在 → 直接放行（避免重复验证）
       └─ 调用 JwtStrategy.validate(payload)
            └─ AuthService.verifyPayload({ authCode: openid })
                 └─ 查询 UserModel.findOne({ openid })
                      ├─ 找到 → 将 user 文档注入 request.user
                      └─ 未找到 → 抛出 UnauthorizedException
```

`JwtStrategy` 通过 `ExtractJwt.fromAuthHeaderAsBearerToken()` 从 `Authorization: Bearer <token>` 头中提取 token。

**`@Auth()` 组合装饰器**

```typescript
@Auth()  // 等价于 @UseGuards(AuthGuard) + Swagger 文档注解
```

`@Auth()` 内部将 `@UseGuards(AuthGuard)`、`@ApiBearerAuth()`、`@ApiUnauthorizedResponse()` 合并为一个装饰器，控制器方法只需标注一次。

**`@CurrentUser()` 参数装饰器**

```typescript
async getInfo(@CurrentUser() user: UserModel) { ... }
```

通过 `createParamDecorator` 从已注入的 `request.user` 中取出经过数据库验证的用户文档，直接绑定到方法参数。

**管理员认证（AdminGuard）**

管理员认证独立于 Passport，`AdminGuard` 直接从请求头读取 `admintoken` 字段，用 `JwtService.verify(token, { secret: ADMIN.jwtSecret })` 验证，检查 payload 中 `role === 'admin'`。失败时抛出 401。

---

### 3.2 全局响应拦截器（ResponseInterceptor）

```typescript
// 核心逻辑（RxJS map 操作符）
return next.handle().pipe(
  map((data) => {
    if (typeof data === 'undefined') {
      response.status(204);
      return data;
    }
    return isArrayLike(data) ? { data } : data;
  }),
);
```

- 控制器返回 **undefined** → 204 No Content
- 控制器返回 **数组或类数组** → `{ data: [...] }`（使用 lodash `isArrayLike`）
- 控制器返回 **对象 / 原始值** → 直接透传，不包装

可通过元数据标记 `RESPONSE_PASSTHROUGH_METADATA` 在特定接口上绕过该拦截器。

---

### 3.3 全局异常过滤器（AllExceptionsFilter）

`@Catch()` 捕获所有未处理异常，统一序列化为以下结构：

```json
{ "ok": 0, "code": <原始业务码>, "message": "<错误信息>" }
```

HTTP 状态码优先级：`HttpException.getStatus()` → `error.status` → `error.statusCode` → 500。前端以 `res.data?.message` 读取错误文案并展示 Toast。

---

### 3.4 数据库模块（DatabaseModule）

`DatabaseModule` 标注了 `@Global()`，在应用根模块注册一次 Mongoose 连接，并将所有 Mongoose 模型（`UserModel`、`LostModel`、`FoundModel`、`DisableModel`、`ClaimModel`）通过 `MongooseModule.forFeature()` 转为可注入的 `Model<T>` Provider，再统一 export，使所有业务模块无需重复连接数据库即可直接注入。

`ChatSessionModel` 和 `ChatMessageModel` 是例外——它们在 `ChatModule` 内部单独注册，因为只有 Chat 模块使用这两个集合。

模型注册方式：

```typescript
export const databaseModels = [UserModel, LostModel, FoundModel, ...]
  .map((model) =>
    MongooseModule.forFeature([
      { name: model.name, schema: SchemaFactory.createForClass(model) },
    ]),
  )
```

所有 Schema 均使用 `@nestjs/mongoose` 的 `@Schema()` / `@Prop()` 装饰器定义，`SchemaFactory.createForClass()` 在运行时生成 Mongoose Schema 实例。

---

### 3.5 微信 OAuth 登录流程

```
前端 wx.login()
  └─ 获取临时 code（5 分钟有效期，一次性使用）
       └─ POST /user  { id: code, nickName?, avatarUrl? }
            └─ UserService.login()
                 └─ HttpService.axiosRef.get(jscode2session, { retries: 0 })
                      └─ 微信服务器返回 { openid, session_key }
                           ├─ 用户不存在 → userModel.create()
                           └─ 用户已存在 → 直接查询
                                └─ AuthService.signToken(openid)
                                     └─ 返回 { user, token, expiresIn: 7 }
```

`jscode2session` 接口调用时强制 `retries: 0`——WeChat code 是一次性的，重试会因 code 已失效而返回新错误，不应重试。

**前端登录页的静默登录机制**：

```
onLoad
  └─ trySilentLogin()
       ├─ 无本地 token → 返回，等待用户点击
       ├─ wx.checkSession() 返回 false → 清除 token，等待用户点击
       └─ GET /auth/check_logged（silent, 8s 超时）
            ├─ 成功 → wx.switchTab 跳首页
            └─ 失败 → 清除 token，等待用户点击
```

**超时重试策略**：`postCodeWithRetry()` 在第一次请求超时时（非其他错误），重新调用 `wx.login()` 获取新 code 再发一次，最多重试一次。

---

### 3.6 实时聊天实现（WebSocket）

**服务端架构**

`ChatGateway` 使用 NestJS `@WebSocketGateway({ path: '/chat' })` + `WsAdapter`（原生 ws 库，RFC 6455）。选用原生 WebSocket 而非 socket.io 的原因是微信小程序的 `wx.connectSocket` 只支持标准 WebSocket 协议。

服务端维护两张内存 Map：

| Map | Key | Value | 用途 |
|---|---|---|---|
| `userSockets` | userId | `Set<AuthedSocket>` | 追踪用户的所有活跃连接（支持多设备） |
| `sessionRooms` | sessionId | `Set<AuthedSocket>` | 会话房间，用于消息广播 |

**消息发送全链路**

```
客户端 sendMessage { sessionId, content, type }
  └─ ChatGateway.handleSendMessage()
       ├─ 验证发送方是会话参与者
       ├─ chatService.saveMessage() → 持久化到 chat_message 集合
       │    └─ 更新 ChatSession: lastMessage / lastTime / deletedBy=[] / 发送方 readAt
       └─ sessionRooms.get(sessionId) 广播 receiveMessage 给房间内所有 socket
            └─ 客户端收到 → 替换乐观消息 / 追加新消息 → scrollToBottom
```

**认证**：token 通过 URL query string `?token=JWT` 传入（微信小程序握手时无法可靠设置自定义 Header），`handleConnection` 在握手阶段验证 token，失败则立即关闭连接。

**客户端实现要点**

| 机制 | 实现 |
|---|---|
| 心跳 | 每 25 秒发送 `ping` 事件，防止连接被中间代理断开 |
| 自动重连 | `onClose` / `onError` 时若非主动关闭，3 秒后调用 `connect()` |
| 主动关闭标志 | `this.intentionalClose = true` 在 `onUnload` 时设置，阻止重连循环 |
| 乐观 UI | 发送时立即追加 `pending: true` 临时消息；服务端 `receiveMessage` 回来后用 content 匹配并替换 |
| 已读标记 | 打开聊天页时 fire-and-forget `POST /sessions/:id/read`；收到对方消息时再次触发 |

---

### 3.7 图片上传与 URL 归一化

**上传路径**

```
前端 wx.uploadFile({ url: /photos/upload, name: 'file' })
  └─ PhotosController → PhotosService.uploadPhoto()
       ├─ fs.promises.mkdir(./uploads, { recursive: true })  // 首次自动创建
       ├─ 文件名：Date.now() + '-' + nanoid + ext           // 无碰撞
       └─ 写入 ./uploads/<filename>
            └─ 返回根相对路径 /uploads/<filename>
```

静态资源通过 `app.useStaticAssets('./uploads', { prefix: '/uploads' })` 提供 `GET /uploads/<filename>` 服务。

**URL 归一化规则（避免跨环境 404）**

数据库中历史记录可能存储了不同时期的绝对 URL（cpolar 隧道地址、Qiniu CDN 等），读取时需归一化：

```
后端 stripAbsoluteOrigin(url):
  匹配 /^https?:\/\/[^/]+(\/uploads\/.*)$/
    → 命中（含 /uploads/）: 返回 /uploads/xxx（剥离 host）
    → 未命中（外部 CDN）:  原样返回

前端 resolveImageUrl(cover, baseUrl):
  /^https?:\/\//  → 原样返回（外部 URL 直接使用）
  /…              → baseUrl + cover（本地 /uploads/ 路径补全 host）

WXS imgUrl.wxs resolve(cover, baseUrl):
  http… + 含 /uploads/ → 取 /uploads/ 起始部分再补 baseUrl
  http… + 不含 /uploads/ → 原样返回（微信头像 CDN 等外部地址）
```

这一策略使本地上传文件、微信头像（`thirdwx.qlogo.cn`）、旧 Qiniu CDN 图片在同一套代码中均能正确显示。

---

### 3.8 前端请求层

**路径归一化**

```javascript
normalizePath(url):
  /api/v{n}/xxx → /xxx   // 生产路由前缀剥离
  /api/xxx      → /xxx   // 兼容旧写法
```

这样前端代码统一写 `/claim/apply`，后端无论开发（无前缀）还是生产（`api/v2` 前缀）都能正确路由。

**双 Token 请求头**

```
Authorization: Bearer <token>     // 标准 Bearer 认证（JwtStrategy 读取）
token: <token>                    // 兼容性冗余头（部分旧逻辑读取）
adminToken: <adminToken>          // 管理员专用头（AdminGuard 读取）
```

**图片上传**：独立使用 `wx.uploadFile`（multipart），不经过 `wx.request` 通道，超时设为 30 秒。

**错误分类**：request 工具将底层错误归一化为 `{ type: 'unauthorized' | 'http' | 'timeout' | 'network' }`，登录页、聊天页等按 type 展示不同提示文案。

---

### 3.9 请求验证管道（ValidationPipe）

全局 `ValidationPipe` 配置：

| 选项 | 值 | 效果 |
|---|---|---|
| `transform` | true | 将请求体自动转换为 DTO 类实例（配合 `class-transformer`） |
| `whitelist` | true | 剥除 DTO 未声明的多余字段 |
| `forbidUnknownValues` | true | 若存在未知字段则返回 422 |
| `errorHttpStatusCode` | 422 | 验证失败返回 422 而非 400 |
| `stopAtFirstError` | true | 遇到第一个校验错误即停止 |

`ParseObjectIdPipe` 在路由参数 `/:id` 上附加校验，正则 `/^[a-f\d]{24}$/i` 验证 MongoDB ObjectId 格式，不合法时返回 400。

---

## 4. 后端模块详解

### 4.1 User — 用户模块 `/user`

负责微信用户的注册、登录及个人资料管理。

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | `/user` | 无 | 微信登录/自动注册。Body: `{ id: wxCode, nickName?, avatarUrl? }` |
| GET | `/user` | `@Auth` | 获取当前用户信息 |
| PATCH | `/user` | `@Auth` | 修改昵称或头像 URL |
| POST | `/user/upload` | `@Auth` | 上传头像图片（multipart/form-data，field: `file`） |
| GET | `/user/check_logged` | `@Auth` | 验证 token 是否有效，返回字符串 `'ok'` |

**登录流程：**

1. 前端调用 `wx.login()` 获取临时 code。
2. 前端 POST `/user` 传入 code（字段名 `id`）。
3. 后端调用微信 `jscode2session` 接口换取 `openid`。
4. 若用户不存在则自动创建（默认昵称：`微信用户`）。
5. 返回 `{ user, token, expiresIn: 7 }`，token 有效期 7 天。

> 微信 AppID 和 AppSecret 通过环境变量 `WX_APPID` / `WX_APPSECRET`（或 `APP_ID` / `APP_SECRET`）或启动参数 `--app_id` / `--app_secret` 传入。若未配置，登录接口返回 403。

---

### 4.2 Lost — 失物模块 `/lost`

管理"寻物"帖（用户丢失物品后发布的寻找请求）。

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/lost/list` | `@Auth` | 当前用户进行中的失物列表（分页） |
| GET | `/lost/alreary` | `@Auth` | 当前用户已找回的失物列表（分页） |
| POST | `/lost` | `@Auth` | 发布新失物信息 |
| PATCH | `/lost/:id` | `@Auth` | 修改失物信息 |
| POST | `/lost/enter_back` | `@Auth` | 变更物品状态。Body: `{ id, state: 0|1 }`（1=寻找中，0=已找回） |
| GET | `/lost` | `@Auth` | 统计：返回当前用户寻找中 / 已找回数量 |
| POST | `/lost/upload` | `@Auth` | 为指定失物上传图片。Body: `{ id, cover: '0'|'1' }` + file |
| POST | `/lost/upload/remove` | `@Auth` | 移除失物的指定图片。Body: `{ id, url }` |
| GET | `/lost/:id` | 无 | 根据 ID 获取失物详情（含发布人信息） |

**发布请求体 (LostDto)：**

```json
{
  "title": "黑色钱包",
  "contact": "13800000000",
  "category": "证件",
  "lostTime": "2026-05-20T10:00:00Z",
  "detail": "内有学生证和银行卡",
  "place": "图书馆一楼",
  "places": [{ "name": "图书馆", "longitude": 116.3565, "latitude": 39.9525 }],
  "image": ["/uploads/xxx.jpg"],
  "cover": "/uploads/xxx.jpg"
}
```

---

### 4.3 Found — 招领模块 `/found`

管理"拾获"帖（用户捡到物品后发布的招领信息）。

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/found/list` | `@Auth` | 当前用户进行中的招领列表（分页） |
| GET | `/found/alreary` | `@Auth` | 当前用户已认领的招领列表（分页） |
| POST | `/found` | `@Auth` | 发布新招领信息 |
| PATCH | `/found/:id` | `@Auth` | 修改招领信息 |
| POST | `/found/enter_back` | `@Auth` | 变更物品状态。Body: `{ id, state: 0|1 }` |
| GET | `/found` | `@Auth` | 统计：返回当前用户招领中 / 已认领数量 |
| POST | `/found/upload` | `@Auth` | 为指定招领上传图片 |
| POST | `/found/upload/remove` | `@Auth` | 移除指定图片 |
| GET | `/found/:id` | 无 | 根据 ID 获取招领详情 |

---

### 4.4 Aggregate — 聚合模块 `/aggregate`

提供首页列表、筛选和搜索功能，无需登录。

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/aggregate/stat` | `@Auth` | 当前用户概览（个人信息 + 失物/招领统计） |
| GET | `/aggregate/last` | 无 | 最新发布（失物+招领混合，分页） |
| GET | `/aggregate/early` | 无 | 最早发布（失物+招领混合，分页） |
| GET | `/aggregate/lost` | 无 | 仅失物（进行中，分页） |
| GET | `/aggregate/lost/alreary` | 无 | 仅已找回的失物（分页） |
| GET | `/aggregate/found` | 无 | 仅招领（进行中，分页） |
| GET | `/aggregate/found/alreary` | 无 | 仅已认领的招领（分页） |
| GET | `/aggregate/search` | 无 | 关键词搜索（同时搜 title / category / detail / place） |

**通用分页参数：** `?pageCurrent=1&pageSize=10`

**搜索参数：** `?search=钱包`

响应示例（`/aggregate/last`）：

```json
{
  "lostFound": [
    { "lostData": [...], "totalCount": 5, "totalPages": 1 },
    { "foundData": [...], "totalCount": 3, "totalPages": 1 }
  ],
  "totalCount": 8
}
```

---

### 4.5 Claim — 认领模块 `/claim`

用户对招领物品提交认领申请（仅申请方，无审批接口）。

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/claim/list` | `@Auth` | 查看当前用户提交的所有认领申请 |
| POST | `/claim/apply` | `@Auth` | 提交认领申请 |

**认领申请体 (ClaimDto)：**

```json
{
  "itemId": "<found item ObjectId>",
  "credentials": "物品有我的名字刻在背面",
  "contact": "13800000000",
  "imgUrls": ["/uploads/proof.jpg"]
}
```

新建记录的 `status` 初始值为 `pending`。目前无审批侧接口，认领状态由物品发布者通过 `POST /found/enter_back` 手动变更物品状态来间接处理。

---

### 4.6 Chat — 即时通讯模块 `/chat` + WebSocket

提供基于 WebSocket 的一对一实时聊天，每个聊天会话关联一件具体物品。

#### HTTP 接口

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | `/chat/session` | `@Auth` | 创建或获取与物品发布者的会话。Body: `{ itemId, itemType: 'lost'|'found' }` |
| GET | `/chat/sessions` | `@Auth` | 当前用户的会话列表（含对方信息、物品信息、最后一条消息、未读数） |
| DELETE | `/chat/sessions/:id` | `@Auth` | 退出/删除会话（软删除；双方均删除时硬删并清除所有消息） |
| GET | `/chat/unread-count` | `@Auth` | 所有会话的未读消息总数（用于首页/个人中心红点） |
| POST | `/chat/sessions/:id/read` | `@Auth` | 标记指定会话为已读 |
| GET | `/chat/history/:sessionId` | `@Auth` | 获取会话的全部历史消息（按时间升序） |

#### WebSocket 协议

**连接地址：** `ws(s)://<host>/chat?token=<JWT>`

token 通过 URL query string 传递（微信小程序不支持在握手时设置自定义 Header）。

**客户端发送事件：**

| 事件名 | Payload | 说明 |
|---|---|---|
| `joinSession` | `{ sessionId: string }` | 加入会话房间，开始接收该会话的实时消息 |
| `sendMessage` | `{ sessionId: string, content: string, type?: 'text'\|'image' }` | 发送消息，服务端广播给房间内所有连接 |

**服务端推送事件：**

| 事件名 | Payload | 说明 |
|---|---|---|
| `connected` | `{ userId }` | 连接成功确认 |
| `joined` | `{ sessionId }` | 成功加入房间确认 |
| `receiveMessage` | `{ _id, sessionId, senderId, content, type, createdAt }` | 收到新消息 |
| `error` | `{ message }` | 认证失败或业务错误（连接随后关闭） |
| `sent` | `{ _id }` | 消息发送成功的 ack |

所有帧格式均为 JSON 字符串，结构为 `{ "event": "<事件名>", "data": {...} }`。

---

### 4.7 Photos — 图片上传模块 `/photos`

提供通用图片上传接口，返回服务器本地路径。

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | `/photos/upload` | `@Auth` | 上传图片文件（field: `file`），返回 `/uploads/<filename>` |

文件保存在后端项目根目录的 `uploads/` 文件夹中，通过静态资源服务暴露为 `GET /uploads/<filename>`。文件名格式：`<timestamp>-<nanoid><ext>`。

---

### 4.8 Location — 地点模块 `/location`

提供校园内预设地点列表，供发布物品时选择。

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/location/list` | 无 | 返回校园地点列表（静态数据，含经纬度） |

当前地点列表为硬编码静态数据（图书馆、教学楼A/B区、宿舍1/2栋、食堂、体育馆、行政楼、实验楼、南门）。

---

### 4.9 Admin — 管理员模块 `/admin`

管理员通过独立的用户名/密码账号登录，与普通用户认证体系完全隔离。

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | `/admin/login` | 无 | 管理员登录。Body: `{ username, password }` |
| GET | `/admin/item/list` | `AdminGuard` | 查看所有物品（失物+招领）列表，含关联用户信息（只读） |
| GET | `/admin/user/list` | `AdminGuard` | 查看所有注册用户列表 |
| POST | `/admin/user/ban` | `AdminGuard` | 封禁用户。Body: `{ id }` |
| POST | `/admin/user/unban` | `AdminGuard` | 解封用户。Body: `{ id }` |

默认账号：`admin` / `admin123`（在 `app.config.ts` 中硬编码，**生产部署前必须修改**）。

物品审批工作流已移除，帖子发布后自动上线。`GET /admin/item/list` 保留为只读接口供管理员查阅。

---

### 4.10 Auth — 认证模块 `/auth`

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/auth/check_logged` | `@Auth` | 验证 token 有效性，返回 `'ok'` |

---

## 5. 数据模型

### 5.1 User（集合: `user`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | ObjectId | 主键 |
| `openid` | String | 微信 openid（唯一标识） |
| `nickName` | String | 用户昵称 |
| `avatarUrl` | String | 头像路径（根相对路径） |
| `banned` | Boolean | 是否封禁（默认 false） |
| `created` | Date | 注册时间（自动） |

---

### 5.2 LostModel（集合: `lost`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | ObjectId | 主键 |
| `title` | String | 物品名称 |
| `contact` | String | 联系方式 |
| `category` | String | 分类（证件/电子设备/衣物/文具/食品/其他） |
| `place` | String | 丢失地点（文字描述） |
| `places` | Array | 结构化地点（含经纬度） |
| `lostTime` | Date | 丢失时间 |
| `detail` | String | 详细描述 |
| `image` | String[] | 图片路径列表 |
| `cover` | String | 封面图路径 |
| `state` | Boolean | 状态（true=寻找中，false=已找回） |
| `approved` | Number | 历史字段，默认 1，审批流已移除 |
| `user` | ObjectId → User | 发布人 |
| `created` | Date | 发布时间（自动） |
| `openid` | String | 冗余存储的发布人 openid |
| `nickName` | String | 冗余存储的发布人昵称 |
| `avatarUrl` | String | 冗余存储的发布人头像 |

---

### 5.3 FoundModel（集合: `found`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | ObjectId | 主键 |
| `title` | String | 物品名称 |
| `contact` | String | 联系方式 |
| `category` | String | 分类 |
| `place` | String | 捡到地点（文字描述） |
| `places` | Array | 结构化地点（含经纬度） |
| `foundTime` | Date | 捡到时间 |
| `detail` | String | 详细描述 |
| `image` | String[] | 图片路径列表 |
| `cover` | String | 封面图路径 |
| `state` | Boolean | 状态（true=招领中，false=已认领） |
| `approved` | Number | 历史字段，默认 1 |
| `user` | ObjectId → User | 发布人 |
| `created` | Date | 发布时间（自动） |
| `uid` | String | 备用标识字段 |

---

### 5.4 ChatSessionModel（集合: `chat_session`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | ObjectId | 主键 |
| `itemId` | String | 关联物品 ID |
| `itemType` | String | `'lost'` 或 `'found'` |
| `finderId` | ObjectId → User | 捡到方（或寻物方） |
| `loserId` | ObjectId → User | 丢失方（或物品发布人） |
| `lastMessage` | String | 最后一条消息预览 |
| `lastTime` | Date | 最后消息时间 |
| `finderLastReadAt` | Date | finder 最后阅读时间（用于计算未读数） |
| `loserLastReadAt` | Date | loser 最后阅读时间 |
| `deletedBy` | String[] | 已软删除该会话的用户 ID 列表 |
| `createdAt` | Date | 自动 |
| `updatedAt` | Date | 自动 |

同一物品同一双方只创建一个会话。若某方软删除后重新打开，会话恢复可见。双方均删除时服务端硬删会话及所有消息。

---

### 5.5 ChatMessageModel（集合: `chat_message`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | ObjectId | 主键 |
| `sessionId` | ObjectId | 所属会话 |
| `senderId` | ObjectId → User | 发送人 |
| `content` | String | 消息内容（文本内容或图片路径） |
| `type` | String | `'text'` 或 `'image'`（默认 `'text'`） |
| `createdAt` | Date | 自动 |

---

### 5.6 ClaimModel（集合: `claim`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | ObjectId | 主键 |
| `itemId` | String | 申领的招领帖 ID |
| `userId` | String | 申请人用户 ID |
| `credentials` | String | 证明材料描述（文字） |
| `contact` | String | 申请人联系方式 |
| `imgUrls` | String[] | 证明图片路径列表 |
| `status` | String | 申请状态（初始为 `pending`） |

---

## 6. 前端页面清单

### 6.1 底部 Tab Bar

| Tab | 页面路径 |
|---|---|
| 🏠 首页 | `pages/index/index` |
| 🔍 寻物（发布失物） | `pages/publish/lost/lost` |
| ✅ 拾获（发布招领） | `pages/publish/found/found` |
| 👤 我的 | `pages/user/user` |

### 6.2 全部页面

| 页面路径 | 功能 | 状态 |
|---|---|---|
| `pages/index/index` | 首页：浏览、搜索、按类型筛选失物/招领列表，含未读聊天红点 | 已实现 |
| `pages/publish/lost/lost` | 发布寻物启事表单（标题/分类/时间/地点/描述/图片） | 已实现 |
| `pages/publish/found/found` | 发布招领信息表单 | 已实现 |
| `pages/detail/detail` | 物品详情页（查看信息、发起聊天、申请认领） | 已实现 |
| `pages/claim/claim` | 提交认领申请（填写证明材料和联系方式） | 已实现 |
| `pages/location/select/select` | 校园地点选择器（从 `/location/list` 加载） | 已实现 |
| `pages/user/user` | 个人中心（头像/昵称、统计、跳转入口） | 已实现 |
| `pages/user/publish/publish` | 我发布的物品（失物+招领列表） | 已实现 |
| `pages/user/claim/claim` | 我的认领申请列表 | 已实现 |
| `pages/login/login` | 微信登录（调用 wx.login 获取 code） | 已实现 |
| `pages/register/register` | 注册页（实际重定向至登录，后端无手机号注册接口） | 已实现（重定向） |
| `pages/chat/chat` | 聊天室（WebSocket 收发消息） | 已实现 |
| `pages/chat-list/chat-list` | 聊天会话列表（含未读数、对方头像、最后消息） | 已实现 |
| `pages/help/help` | 帮助页（静态内容） | 已实现 |
| `pages/message/message` | 系统消息列表（后端为 stub，返回空数组） | **未实现** |
| `pages/message/detail/detail` | 系统消息详情（后端为 stub，返回 404） | **未实现** |
| `pages/admin/login/login` | 管理员登录 | 已实现 |
| `pages/admin/check/check` | 管理员物品列表查看 | 已实现 |
| `pages/admin/user/user` | 管理员用户管理（封禁/解封） | 已实现 |

---

## 7. 认证与安全

### 7.1 用户认证（JWT）

- 登录后服务端签发 JWT，payload 为 `{ authCode: openid }`
- 有效期：7 天，密钥：`SECURITY.jwtSecret`（默认值 `'suemor'`）
- 前端存储于 `wx.setStorageSync('token', ...)`
- 所有请求携带 `Authorization: Bearer <token>` 和 `token: <token>` Header

受 `@Auth()` 装饰器保护的接口会验证 token 并将用户注入 `@CurrentUser()`。被封禁（`banned: true`）的用户仍可持有有效 token，但封禁逻辑由应用层判断。

### 7.2 管理员认证（独立 JWT）

- 登录接口：`POST /admin/login`，明文比对账号密码
- 签发独立 JWT，payload 为 `{ role: 'admin', username }`
- 密钥：`ADMIN.jwtSecret`（默认值 `'admin_suemor_secret'`）
- 前端存储于 `wx.setStorageSync('adminToken', ...)`
- 请求时额外传递 `adminToken: <token>` Header
- `AdminGuard` 验证该 token

### 7.3 CORS 配置

允许的来源：`suemor.com`、`localhost`、`127.0.0.1`、`*.dev`、`*.cpolar.*`

---

## 8. 配置与环境变量

### 8.1 后端配置（`src/app.config.ts`）

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `2349` | 监听端口 |
| `API_VERSION` | `2` | 生产路由前缀中的版本号 |
| `MONGO_DB.dbName` | `LostAndFound` | 数据库名称 |
| `MONGO_DB.host` | `127.0.0.1` | 数据库地址（可通过 `--db_host` 覆盖） |
| `MONGO_DB.port` | `27017` | 数据库端口 |
| `SECURITY.jwtSecret` | `'suemor'` | 用户 JWT 密钥 |
| `SECURITY.jwtExpire` | `'7d'` | 用户 JWT 有效期 |
| `ADMIN.username` | `'admin'` | 管理员账号 |
| `ADMIN.password` | `'admin123'` | 管理员密码 |
| `ADMIN.jwtSecret` | `'admin_suemor_secret'` | 管理员 JWT 密钥 |

### 8.2 环境变量

| 变量名 | 说明 |
|---|---|
| `WX_APPID` 或 `APP_ID` | 微信小程序 AppID |
| `WX_APPSECRET` 或 `APP_SECRET` | 微信小程序 AppSecret |
| `NODE_ENV` | `development` 时启用 Swagger 和日志拦截器 |

也可通过 CLI 参数传入：`node main.js --app_id=xxx --app_secret=xxx --db_host=127.0.0.1`

### 8.3 前端环境配置（`frontend/config/env.js`）

| 变量 | 说明 |
|---|---|
| `LAN_URL` | 局域网地址（开发时手机与 PC 同网段使用） |
| `CPOLAR_URL` | cpolar 内网穿透隧道地址（外网访问使用） |

`wsUrl` 由 `baseUrl` 自动转换（`http://` → `ws://`，`https://` → `wss://`）。

---

## 9. 开发与部署

### 9.1 后端启动

```bash
# 开发模式（热重载，无路由前缀）
cd backend
pnpm install
pnpm run start

# 生产构建
pnpm run build
NODE_ENV=production node dist/src/main.js
```

开发模式下可访问：
- API：`http://localhost:2349`
- Swagger 文档：`http://localhost:2349/api-docs`
- 上传图片：`http://localhost:2349/uploads/<filename>`

### 9.2 数据库

MongoDB 需在本地 `27017` 端口运行，数据库名 `LostAndFound` 会在首次写入时自动创建。

### 9.3 前端调试

在微信开发者工具中打开 `frontend/` 目录，在 `config/env.js` 中将 `LAN_URL` 或 `CPOLAR_URL` 指向本地或隧道地址。

---

## 10. 未实现功能

以下功能存在前端页面入口，但后端 API 为占位实现，不具备实际数据持久化能力：

| 功能 | 前端页面 | 后端状态 |
|---|---|---|
| 系统消息列表 | `pages/message/message` | `GET /message/list` 固定返回空数组 |
| 系统消息详情 | `pages/message/detail/detail` | `GET /message/detail/:id` 固定抛出 404 |
| 认领审批 | — | 无 `/claim/approve` 或 `/claim/reject` 接口；物品状态需发布方手动通过 `enter_back` 接口变更 |
