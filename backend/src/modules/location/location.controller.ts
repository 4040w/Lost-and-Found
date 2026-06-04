import { Controller, Get } from '@nestjs/common'
import { ApiOperation } from '@nestjs/swagger'

// Static campus location list. Replace coordinates with your actual campus POIs.
const CAMPUS_LOCATIONS = [
  { id: '1', name: '图书馆',     longitude: 116.3565, latitude: 39.9525 },
  { id: '2', name: '教学楼A区',  longitude: 116.3572, latitude: 39.9531 },
  { id: '3', name: '教学楼B区',  longitude: 116.3580, latitude: 39.9528 },
  { id: '4', name: '学生宿舍1栋', longitude: 116.3558, latitude: 39.9518 },
  { id: '5', name: '学生宿舍2栋', longitude: 116.3562, latitude: 39.9514 },
  { id: '6', name: '食堂',       longitude: 116.3570, latitude: 39.9510 },
  { id: '7', name: '体育馆',     longitude: 116.3590, latitude: 39.9535 },
  { id: '8', name: '行政楼',     longitude: 116.3575, latitude: 39.9540 },
  { id: '9', name: '实验楼',     longitude: 116.3585, latitude: 39.9522 },
  { id: '10', name: '南门',      longitude: 116.3560, latitude: 39.9500 },
]

@Controller('location')
export class LocationController {
  @Get('list')
  @ApiOperation({ summary: '获取校园地点列表' })
  getList() {
    return CAMPUS_LOCATIONS
  }
}
