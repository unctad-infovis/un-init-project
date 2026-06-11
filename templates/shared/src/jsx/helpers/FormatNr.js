const formatNr = ({ addComma = false, addPlus = false, prefix = '', separator = ',', unit = '', x }) => {
  // Determine sign prefix
  let sign = '';
  if (x < 0) {
    sign = '-';
  } else if (addPlus && x > 0) {
    sign = '+';
  } else if (addPlus && x === 0) {
    sign = '±';
  }

  // Format number: add thousands separator, strip minus sign
  let formatted = Math.abs(x)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  // Add trailing .0 if requested and no decimal present
  if (addComma && !formatted.includes('.')) {
    formatted += '.0';
  }

  return formatted === '' ? 0 : `${sign}${prefix}${formatted}${unit}`;
};

export default formatNr;
