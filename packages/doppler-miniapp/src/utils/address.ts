export function trimPaddedAddress(paddedAddress: string): string {
  // Check if the address is padded (32 bytes = 66 characters with '0x')
  if (paddedAddress.length === 66) {
    // Remove '0x' prefix, take last 40 characters (20 bytes), add '0x' prefix back
    return "0x" + paddedAddress.slice(-40);
  }
  // If address is already 20 bytes, return as is
  return paddedAddress;
}
