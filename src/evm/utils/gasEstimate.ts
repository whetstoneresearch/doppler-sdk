/**
 * Extract the gas estimate from a simulated contract request.
 * Falls back to `estimateContractGas` when the simulation doesn't include a gas value.
 *
 * @param request  The request object returned by `simulateContract`
 * @param fallback A function returning a gas estimate (called only when request.gas is unavailable)
 */
export async function resolveGasEstimate(
  request: unknown,
  fallback: () => Promise<bigint>,
): Promise<bigint> {
  if (typeof (request as any)?.gas === 'bigint') {
    return (request as any).gas as bigint;
  }
  return await fallback();
}
