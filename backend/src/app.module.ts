import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'

import { AppController } from './app.controller'
import { AllExceptionsFilter } from './common/filters/any-exception.filter'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { AdminModule } from './modules/admin/admin.module'
import { ChatModule } from './modules/chat/chat.module'
import { ClaimModule } from './modules/claim/claim.module'
import { FoundModule } from './modules/found/found.module'
import { LostModule } from './modules/lost/lost.module'
import { MessageModule } from './modules/message/message.module'
import { UserModule } from './modules/user/user.module'
import { DatabaseModule } from './processors/database/database.module'
import { HelperModule } from './processors/helper/helper.module'
import { AggregateModule } from './modules/aggregate/aggregate.module'
import { PhotosModule } from './modules/photos/photos.module'
import { DisableModule } from './modules/disable/disable.module'
import { LocationModule } from './modules/location/location.module'

@Module({
  imports: [
    DatabaseModule,
    UserModule,
    HelperModule,
    LostModule,
    FoundModule,
    AggregateModule,
    PhotosModule,
    DisableModule,
    LocationModule,
    AdminModule,
    ClaimModule,
    MessageModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor, // 1
    },
  ],
})
export class AppModule {}
