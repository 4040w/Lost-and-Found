/**
 * 计算两个坐标之间的距离（米）
 * @param {Number} lng1 - 经度1
 * @param {Number} lat1 - 纬度1
 * @param {Number} lng2 - 经度2
 * @param {Number} lat2 - 纬度2
 * @returns {Number} 距离（米）
 */
export const calculateDistance = (lng1, lat1, lng2, lat2) => {
  const radLat1 = lat1 * Math.PI / 180.0;
  const radLat2 = lat2 * Math.PI / 180.0;
  const a = radLat1 - radLat2;
  const b = lng1 * Math.PI / 180.0 - lng2 * Math.PI / 180.0;
  let s = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin(a / 2), 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)));
  s = s * 6378137.0; // 地球半径（米）
  s = Math.round(s * 10000) / 10000;
  return s;
};

/**
 * 根据坐标匹配最近的校园地点
 * @param {Array} locationList - 校园地点列表
 * @param {Number} lng - 当前经度
 * @param {Number} lat - 当前纬度
 * @returns {Object} 最近的地点
 */
export const matchLocationByCoord = (locationList, lng, lat) => {
  if (!locationList || locationList.length === 0) return null;

  let nearestLocation = null;
  let minDistance = Infinity;

  locationList.forEach(location => {
    if (!location.longitude || !location.latitude) return;

    const distance = calculateDistance(
      parseFloat(lng),
      parseFloat(lat),
      parseFloat(location.longitude),
      parseFloat(location.latitude)
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestLocation = location;
    }
  });

  // 仅匹配500米内的地点
  return minDistance <= 500 ? nearestLocation : null;
};

/**
 * 格式化地点范围文本
 * @param {String} range - 范围值（only/50m/campus）
 * @returns {String} 格式化文本
 */
export const formatRangeText = (range) => {
  switch (range) {
    case 'only':
      return '仅该地点';
    case '50m':
      return '该地点50米内';
    case 'campus':
      return '整个校区';
    default:
      return '仅该地点';
  }
};