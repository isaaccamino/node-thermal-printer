const scaleImageToWidth = (originalDimensions, newWidth) => {
  const {width, height} = originalDimensions;
  if (width == null || height == null) throw new Error("originalDimensions is malformed");
  if (newWidth == null) throw new Error("Missing newWidth");
  const heightMultiplier = newWidth / width;

  return {
      width: newWidth,
      height: height * heightMultiplier
  }
}

const scaleImageToHeight = (originalDimensions, newHeight) => {
  const {width, height} = originalDimensions;
  if (width == null || height == null) throw new Error("originalDimensions is malformed");
  if (newHeight == null) throw new Error("Missing newHeight");
  const widthMultiplier = newHeight / height;
  
  return {
      width: width * widthMultiplier,
      height: newHeight
  }
}

const calculateTwoByteNumber = (number) => {
	if (number > 65535) throw new Error('Number is too large to be represented by two bytes');

	if (number >= 0) {
	const highByte = Math.floor(number / 256);
	const lowByte = number % 256;

	return { nH: highByte, nL: lowByte };
	} else {
		if (number < -32768) throw new Error('Number is too small to be represented by two bytes');
		const highByte = Math.floor((number + 65536) / 256);
		const lowByte = (number + 65536) % 256;

		return { nH: highByte, nL: lowByte };
	}
}

module.exports = {
  scaleImageToWidth,
  scaleImageToHeight,
  calculateTwoByteNumber
}