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
  if (isGasEstimateRequest(request)) {
    return request.gas;
  }
  return await fallback();
}

function isGasEstimateRequest(request: unknown): request is { gas: bigint } {
  return (
    typeof request === 'object' &&
    request !== null &&
    'gas' in request &&
    typeof request.gas === 'bigint'
  );
}
