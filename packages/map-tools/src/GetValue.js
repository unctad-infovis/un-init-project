// Resolve the display value for a region, redirecting disputed territories to the country whose data they should borrow
const getValue = (region, data, china_areas) => {
  if (region.code === 'C00002') { // AksaiChin
    return null;
  }
  if (region.code === 'C00003') { // ArunachalPradesh = India
    const indiaData = data.find(row => row.code === '356');
    return indiaData?.value || null;
  }
  if (region.code === '412') { // Kosovo = Serbia
    const serbiaData = data.find(row => row.code === '688');
    return serbiaData?.value || null;
  }
  if (china_areas.includes(region.code)) { // Macao, HongKong, China, Taiwan = China
    const chinaData = data.find(row => row.code === '156');
    return chinaData?.value || null;
  }
  const match = data.find(row => row.code === region.code);
  return match?.value || null;
};

export default getValue;
