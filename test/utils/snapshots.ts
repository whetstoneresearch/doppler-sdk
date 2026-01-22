/**
 * Snapshot utilities for test state isolation
 *
 * Provides utilities to snapshot and revert Anvil state between tests,
 * enabling fast test isolation without restarting the Anvil process.
 *
 * Usage:
 *   const manager = new SnapshotManager(testClient)
 *   const snapshotId = await manager.snapshot()
 *   // ... run test ...
 *   await manager.revert(snapshotId)
 *
 * Or use the hook for automatic snapshot/revert:
 *   useSnapshot(testClient)
 */

import type { TestClient, Chain, TestClientMode } from 'viem'
import { beforeEach, afterEach } from 'vitest'

type AnyTestClient = TestClient<TestClientMode, any, Chain | undefined>

/**
 * Manager for Anvil snapshots
 *
 * Handles creating and reverting snapshots for test isolation.
 */
export class SnapshotManager {
  private testClient: AnyTestClient
  private snapshotStack: string[] = []

  constructor(testClient: AnyTestClient) {
    this.testClient = testClient
  }

  /**
   * Create a snapshot of the current state
   * @returns The snapshot ID
   */
  async snapshot(): Promise<string> {
    const snapshotId = await this.testClient.snapshot()
    this.snapshotStack.push(snapshotId)
    return snapshotId
  }

  /**
   * Revert to a specific snapshot
   * @param snapshotId - The snapshot ID to revert to
   */
  async revert(snapshotId?: string): Promise<void> {
    const id = snapshotId ?? this.snapshotStack.pop()
    if (!id) {
      throw new Error('No snapshot ID provided and stack is empty')
    }
    await this.testClient.revert({ id })
  }

  /**
   * Revert to the most recent snapshot and remove it from the stack
   */
  async revertLast(): Promise<void> {
    const snapshotId = this.snapshotStack.pop()
    if (!snapshotId) {
      throw new Error('No snapshots in stack to revert')
    }
    await this.testClient.revert({ id: snapshotId })
  }

  /**
   * Clear all snapshots from the stack
   */
  clearStack(): void {
    this.snapshotStack = []
  }

  /**
   * Get the current snapshot stack depth
   */
  getStackDepth(): number {
    return this.snapshotStack.length
  }
}

/** Global snapshot managers per test client */
const snapshotManagers = new WeakMap<AnyTestClient, SnapshotManager>()

/**
 * Get or create a SnapshotManager for a test client
 */
export function getSnapshotManager(testClient: AnyTestClient): SnapshotManager {
  let manager = snapshotManagers.get(testClient)
  if (!manager) {
    manager = new SnapshotManager(testClient)
    snapshotManagers.set(testClient, manager)
  }
  return manager
}

/**
 * Vitest hook for automatic snapshot/revert between tests
 *
 * Call this at the top of your describe block to automatically
 * snapshot before each test and revert after each test.
 *
 * @param getTestClient - Function that returns the test client (or test client directly)
 *
 * @example
 * ```ts
 * describe('MyContract', () => {
 *   useSnapshot(() => testClient)
 *
 *   it('should do something', async () => {
 *     // State changes here are isolated to this test
 *   })
 * })
 * ```
 */
export function useSnapshot(
  getTestClient: (() => AnyTestClient | undefined) | AnyTestClient | undefined
): void {
  let snapshotId: string | undefined

  beforeEach(async () => {
    const client =
      typeof getTestClient === 'function' ? getTestClient() : getTestClient
    if (!client) return

    snapshotId = await client.snapshot()
  })

  afterEach(async () => {
    const client =
      typeof getTestClient === 'function' ? getTestClient() : getTestClient
    if (!client || !snapshotId) return

    await client.revert({ id: snapshotId })
    snapshotId = undefined
  })
}

/**
 * Create a snapshot, run a function, and revert
 *
 * Useful for one-off state isolation within a test.
 *
 * @param testClient - The test client to use
 * @param fn - The function to run with isolated state
 *
 * @example
 * ```ts
 * it('should handle multiple scenarios', async () => {
 *   await withSnapshot(testClient, async () => {
 *     // Scenario 1
 *   })
 *
 *   await withSnapshot(testClient, async () => {
 *     // Scenario 2 - state is isolated from Scenario 1
 *   })
 * })
 * ```
 */
export async function withSnapshot<T>(
  testClient: AnyTestClient,
  fn: () => Promise<T>
): Promise<T> {
  const snapshotId = await testClient.snapshot()
  try {
    return await fn()
  } finally {
    await testClient.revert({ id: snapshotId })
  }
}

/**
 * Create a named snapshot point for debugging
 *
 * Useful when you need to inspect state at specific points.
 */
export async function createNamedSnapshot(
  testClient: AnyTestClient,
  name: string
): Promise<{ id: string; name: string; revert: () => Promise<void> }> {
  const id = await testClient.snapshot()
  return {
    id,
    name,
    revert: () => testClient.revert({ id }),
  }
}
