import { IsArray, IsOptional, IsString } from 'class-validator'

import { ApiProperty } from '@nestjs/swagger'

export class ClaimDto {
  @ApiProperty({ required: true })
  @IsString()
  itemId: string

  @ApiProperty({ required: true })
  @IsString()
  credentials: string

  @ApiProperty({ required: true })
  @IsString()
  contact: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  imgUrls?: string[]
}
