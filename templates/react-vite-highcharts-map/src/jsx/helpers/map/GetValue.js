// Define a color mapping function based on value **and code**
const getValue = (region, data, china_areas) => {
  const match = data.find(row => row.code === region.code);

  // First check if this code is special
  if (region.code === 'C00002') {
    // AksaiChin
    return null;
  }
  if (region.code === 'C00003') {
    // ArunachalPradesh = India
    const indiaData = data.find(row => row.code === '356');
    return indiaData?.value || null;
  }
  if (region.code === '412') {
    // Kosovo = Serbia
    const serbiaData = data.find(row => row.code === '688');
    return serbiaData?.value || null;
  }
  if (china_areas.includes(region.code)) {
    // Macao, HongKong, China, Taiwan = China
    const chinaData = data.find(row => row.code === '156');
    return chinaData?.value || null;
  }
  return match?.value || null;
};

export default getValue;
