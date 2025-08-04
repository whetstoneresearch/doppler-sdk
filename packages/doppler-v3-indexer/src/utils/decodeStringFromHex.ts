export const decodeStringFromHex = (hexData: string) => {
  if (!hexData || hexData === "0x") return "";

  // Remove 0x prefix
  const hex = hexData.slice(2);

  // First 32 bytes is offset (skip)
  // Next 32 bytes is length
  const lengthHex = hex.slice(64, 128);
  const length = parseInt(lengthHex, 16);

  // Extract string data
  const stringHex = hex.slice(128, 128 + length * 2);

  // Convert hex to ASCII
  let result = "";
  for (let i = 0; i < stringHex.length; i += 2) {
    result += String.fromCharCode(parseInt(stringHex.substr(i, 2), 16));
  }

  return result;
};
