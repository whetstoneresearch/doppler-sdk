export const LEGACY_BASE_SEPOLIA_MULTICURVE_BUNDLER =
  '0x69DB7c20cDdA49Bed2bFb21e16Fa218330C50661'

export function usesLegacyBaseSepoliaMulticurveBundler({
  chainId,
  bundler,
}: {
  chainId: number
  bundler?: string
}): boolean {
  return (
    chainId === 84532 &&
    bundler?.toLowerCase() ===
      LEGACY_BASE_SEPOLIA_MULTICURVE_BUNDLER.toLowerCase()
  )
}
