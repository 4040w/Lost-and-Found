import {
  IsString, IsUrl, IsOptional
} from 'class-validator'

import { ApiProperty } from '@nestjs/swagger'
export class LoginUserDto {
  @ApiProperty({ required: true })
  @IsString({ message: '微信code' })
  id: string

  @ApiProperty({ required: true })
  @IsString({ message: '用户名' })
  nickName: string

  @ApiProperty({ required: true })
  @IsUrl({ require_protocol: true }, { message: '请更正为正确的网址' })
  avatarUrl: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  openid?: string
}


export class UpdateLoginUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: '用户名' })
  nickName?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: '请更正为正确的网址' })
  avatarUrl?: string
}
