import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

import { ApiProperty } from '@nestjs/swagger'
import { UserModel } from '../user/user.model'

export class PlaceDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsString()
  range?: string

  @IsOptional()
  longitude?: number

  @IsOptional()
  latitude?: number

  @IsOptional()
  sort?: number
}

export class LostDto {
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
  @IsString({ message: '丢失时间不能为空' })
  lostTime?: string

  @ApiProperty({ required: true })
  @IsString({ message: '详情不能为空' })
  detail?: string

  @ApiProperty({ required: true })
  @IsString({ message: '丢失地点不能为空' })
  place?: string

  @ApiProperty({ nullable: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaceDto)
  places?: PlaceDto[]

  @ApiProperty({ nullable: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  image?: string[]

  @ApiProperty({ nullable: false })
  @IsOptional()
  @IsString()
  cover?: string

  state?: boolean

  @ApiProperty({ nullable: false })
  user?: UserModel
}



