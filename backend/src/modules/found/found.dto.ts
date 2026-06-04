import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

import { ApiProperty } from '@nestjs/swagger'
import { UserModel } from '../user/user.model'
import { PlaceDto } from '../lost/lost.dto'

export class FoundDto {
  @ApiProperty({ required: true })
  @IsString({ message: '标题不能为空' })
  title: string

  @ApiProperty({ required: true })
  @IsString({ message: '联系方式不能为空' })
  contact?: string

  @ApiProperty({ required: true })
  @IsString({ message: '分类不能为空' })
  category?: string

  @ApiProperty({ required: true })
  @IsString({ message: '捡到时间不能为空' })
  foundTime?: string

  @ApiProperty({ required: true })
  @IsString({ message: '详情不能为空' })
  detail?: string

  @ApiProperty({ nullable: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  image?: string[]

  @ApiProperty({ nullable: false })
  @IsOptional()
  @IsString()
  cover?: string

  @ApiProperty({ nullable: false })
  user?: UserModel

  uid?: string

  @ApiProperty({ required: true })
  @IsString({ message: '捡到地点不能为空' })
  place?: string

  @ApiProperty({ nullable: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaceDto)
  places?: PlaceDto[]

  state?: boolean
}
