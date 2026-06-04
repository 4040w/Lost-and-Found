import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'

import { HttpService } from '~/processors/helper/helper.http.service'

import { LoginUserDto, UpdateLoginUserDto } from './user.dto'
import { WX_SECRET } from '~/app.config'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { UserModel } from '~/modules/user/user.model';
import { PhotosService } from '../photos/photos.service'

function stripAbsoluteOrigin(url: string): string {
  if (!url || url.startsWith('/')) return url
  // Only strip origin from our own /uploads/ paths.
  // WeChat CDN (thirdwx.qlogo.cn) and other external URLs must be left intact.
  const match = url.match(/^https?:\/\/[^/]+(\/uploads\/.*)$/)
  return match ? match[1] : url
}

@Injectable()
export class UserService {

  constructor(
    @InjectModel(UserModel.name)
    private readonly userModel: Model<UserModel>,
    private readonly httpService: HttpService,
    private photosService: PhotosService,
  ) {}

  async createUser(openid: string, user: LoginUserDto) {
    const hasUser = await this.hasUser(openid)
    if (hasUser) {
      throw new BadRequestException('用户已经存在')
    }

    await this.userModel.create({
      openid,
      nickName: user.nickName || '微信用户',
      avatarUrl: user.avatarUrl || '',
    })
    return openid
  }

  async login(user: LoginUserDto) {
    if (!WX_SECRET.appId || !WX_SECRET.AppSecret) {
      throw new ForbiddenException(
        '服务器未配置微信 AppID / AppSecret，请在环境变量中设置 WX_APPID 和 WX_APPSECRET',
      )
    }

    const { data } = await this.wxUser(user.id)
    if (!data.openid) {
      throw new ForbiddenException(
        `微信登录失败: ${data.errmsg || '获取openid失败'} (errcode: ${data.errcode})`,
      )
    }

    const openid = data.openid
    !(await this.hasUser(openid)) && (await this.createUser(openid, user))
    return await this.findById(openid)
  }

  async findById(openid: string) {
    const user = await this.userModel.findOne({ openid }).lean()
    if (user?.avatarUrl) user.avatarUrl = stripAbsoluteOrigin(user.avatarUrl)
    return user
  }

  async hasUser(openid: string) {
    return !!(await this.userModel.findOne({ openid }).lean())
  }

  async getUserInfo(user: LoginUserDto) {
    const _user = user
  }

  async getUserInfoByToken(token: string) {
    // this.authService.verifyPayload(token)
  }

  wxUser(id: string) {
    // jscode2session has a 5-min single-use code; never retry, fail fast.
    return this.httpService.axiosRef.get(
      `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_SECRET.appId}&secret=${WX_SECRET.AppSecret}&js_code=${id}&grant_type=authorization_code`,
      {
        timeout: 5000,
        // @ts-ignore — axios-retry config
        'axios-retry': { retries: 0 },
      },
    )
  }

  patchUserData(user: UpdateLoginUserDto, currentUser: LoginUserDto) {
    return this.userModel.updateOne({ _id: currentUser.id}, user)
  }

  async uploadAvatar(file: Express.Multer.File, user: LoginUserDto) {
    const url = await this.photosService.uploadPhoto(file)
    return this.userModel.updateOne({ _id: user.id}, { avatarUrl: url })
  }
}