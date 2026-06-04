import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiOperation } from '@nestjs/swagger'

import { AdminGuard } from './admin.guard'
import { AdminService } from './admin.service'

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  @ApiOperation({ summary: '管理员登录' })
  async login(
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    return this.adminService.login(username, password)
  }

  // Approval workflow removed — posts auto-publish. Endpoint kept read-only
  // so existing admin dashboards can still inspect all items.
  @Get('item/list')
  @ApiOperation({ summary: '获取所有物品列表（只读）' })
  @UseGuards(AdminGuard)
  async getItemList() {
    return this.adminService.getItemList()
  }

  @Get('user/list')
  @ApiOperation({ summary: '获取所有用户列表' })
  @UseGuards(AdminGuard)
  async getUserList() {
    return this.adminService.getUserList()
  }

  @Post('user/ban')
  @ApiOperation({ summary: '封禁用户' })
  @UseGuards(AdminGuard)
  async banUser(@Body('id') id: string) {
    return this.adminService.banUser(id)
  }

  @Post('user/unban')
  @ApiOperation({ summary: '解封用户' })
  @UseGuards(AdminGuard)
  async unbanUser(@Body('id') id: string) {
    return this.adminService.unbanUser(id)
  }
}
