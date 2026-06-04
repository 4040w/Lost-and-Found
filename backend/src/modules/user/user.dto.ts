import { IsOptional, IsString } from 'class-validator'

import { ApiProperty } from '@nestjs/swagger'

export class LoginUserDto {
  @ApiProperty({ required: true, description: 'wx.login() 返回的临时 code' })
  @IsString({ message: '微信code不能为空' })
  id: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: '用户名不能为空' })
  nickName?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string
}


export class UpdateLoginUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: '用户名' })
  nickName?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string
}
