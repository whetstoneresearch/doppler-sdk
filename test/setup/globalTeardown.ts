/**
 * Global test teardown - runs once after all tests
 *
 * Ensures all Anvil processes are cleaned up
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Known Anvil ports used by tests (from test/utils/anvil.ts)
const ANVIL_PORTS = [8545, 8546, 8547]

async function killAnvilOnPort(port: number): Promise<void> {
  try {
    await execAsync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`)
  } catch {
    // Ignore errors
  }
}

export async function teardown(): Promise<void> {
  // Kill any remaining Anvil processes
  await Promise.all(ANVIL_PORTS.map(killAnvilOnPort))

  try {
    await execAsync('pkill -9 anvil 2>/dev/null || true')
  } catch {
    // Ignore errors
  }
}

export default teardown
