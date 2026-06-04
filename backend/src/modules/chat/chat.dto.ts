import { IsIn, IsOptional, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateSessionDto {
  @ApiProperty({ required: true })
  @IsString({ message: 'itemId 不能为空' })
  itemId: string

  @ApiProperty({ required: true })
  @IsIn(['lost', 'found'], { message: 'itemType 必须是 lost 或 found' })
  itemType: string
}

export class SendMessageDto {
  @IsString()
  sessionId: string

  @IsString()
  content: string

  @IsOptional()
  @IsString()
  type?: string
}
