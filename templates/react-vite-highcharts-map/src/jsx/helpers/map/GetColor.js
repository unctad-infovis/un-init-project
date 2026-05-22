// Define a color mapping function based on value (special cases dealt with by getColor)
function getColorFromValue(value) {
  // Return grey if value is null, NaN, or undefined
  if (value === 2) {
    return '#009edb';
  } else if (value === 1) {
    return '#fbaf17';
  }
  return '#ded9d5';
}

// Define a color mapping function based on value **and code**
const getColor = (region, data, china_areas) => {
  // First check if this code is special
  if (region.code === 'C00002') {
    // AksaiChin
    const kashmirData = data.find(item => item.code === 'C00007'); // Find kashmir in data
    const kashmirValue = kashmirData ? kashmirData.value : null; // Get kashmir's value, default to null
    const chinaData = data.find(item => item.code === '156'); // Find china in data
    const chinaValue = chinaData ? chinaData.value : null; // Get china's value, default to null
    return {
      pattern: {
        backgroundColor: getColorFromValue(kashmirValue),
        color: getColorFromValue(chinaValue, chinaData),
        height: 10 / 100000, // Height of the pattern
        path: {
          d: 'M 0 10 L 10 0 M -1 1 L 1 -1 M 9 11 L 11 9',
          strokeWidth: 2.5 * Math.sqrt(2)
        },
        width: 10 // Width of the pattern
      }
    };
  }
  if (region.code === 'C00003') {
    // ArunachalPradesh = India
    const indiaData = data.find(item => item.code === '356');
    const indiaValue = indiaData ? indiaData.value : null;
    return getColorFromValue(indiaValue);
  }
  if (region.code === '412') {
    // Kosovo = Serbia
    const serbiaData = data.find(item => item.code === '688');
    const serbiaValue = serbiaData ? serbiaData.value : null;
    return getColorFromValue(serbiaValue);
  }
  if (china_areas.includes(region.code)) {
    // Macao, HongKong, China, Taiwan = China
    const chinaData = data.find(item => item.code === '156');
    const chinaValue = chinaData ? chinaData.value : null;
    return getColorFromValue(chinaValue);
  }
  return getColorFromValue(region.value);
};

export default getColor;
