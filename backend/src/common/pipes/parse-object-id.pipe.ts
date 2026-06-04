import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'

@Injectable()
export class ParseObjectIdPipe implements PipeTransform {
  private static readonly OBJECT_ID_RE = /^[a-f\d]{24}$/i

  transform(value: string): string {
    if (!ParseObjectIdPipe.OBJECT_ID_RE.test(value)) {
      throw new BadRequestException(`'${value}' is not a valid MongoDB ObjectId`)
    }
    return value
  }
}
