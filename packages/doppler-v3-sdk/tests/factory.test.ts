import { createDrift } from "@delvtech/drift";
import { describe, expect, it } from "vitest";
import * as DopplerSDK from "../src/";

describe("ReadWriteFactory tests", { timeout: 1000 * 5 }, async () => {
  // it("computeCreate2Address", async () => {
  //   const salt: Hash = ("0x" + "a".repeat(64)) as Hash; // Fake 32-byte hash
  //   const initCodeHash: Hash = ("0x" + "b".repeat(64)) as Hash; // Fake 32-byte hash
  //   const deployer: Address = ("0x" + "c".repeat(40)) as Address; // Fake 20-byte address
  //   let address = "";
  //   // while (!address.endsWith("abcdef")) {
  //   for (let salt = BigInt(0); salt < BigInt(1_000_000); salt++) {
  //     const saltBytes = `0x${salt.toString(16).padStart(64, "0")}` as Hash;
  //     const encoded = encodePacked(
  //       ["bytes1", "address", "bytes32", "bytes32"],
  //       ["0xff", deployer, saltBytes, initCodeHash]
  //     );
  //     address = getAddress(`0x${keccak256(encoded).slice(-40)}`);
  //     console.log("Address: ", address);
  //     if (address.endsWith("aaaa")) {
  //       console.log("Found vanity address: ", address);
  //       break;
  //     }
  //   }
  //   // }
  // });

  it("Vanity address mining", async () => {
    const drift = createDrift({
      rpcUrl: "https://unichain-sepolia.api.onfinality.io/public",
    });
    const airlockAddress = DopplerSDK.DOPPLER_V3_ADDRESSES[1301].airlock;
    const bundlerAddress = DopplerSDK.DOPPLER_V3_ADDRESSES[1301].bundler;

    const readWriteFactory = new DopplerSDK.ReadWriteFactory(
      airlockAddress,
      bundlerAddress,
      drift
    );
    const createParams = await readWriteFactory.encodeCreateData({
      integrator: "0x21E2ce70511e4FE542a97708e89520471DAa7A66",
      userAddress: "0x8e8757Aba1a98F5A5A68027DBb31D481B53b58Ce",
      numeraire: "0x4200000000000000000000000000000000000006",
      contracts: {
        tokenFactory: "0xC5E5a19a2ee32831Fcb8a81546979AF43936EbaA",
        governanceFactory: "0x1E4332EEfAE9e4967C2D186f7b2d439D778e81cC",
        v3Initializer: "0x7Fb9a622186B4660A5988C223ebb9d3690dD5007",
        liquidityMigrator: "0x44C448E38A2C3D206c9132E7f645510dFbBC946b",
      },
      tokenConfig: {
        name: "asdf",
        symbol: "asdf",
        tokenURI: "ipfs://QmeMXyEtaoYmeMLhwmK3173iCxmGjn8GswdXsBmTsCqPNM",
      },
      v3PoolConfig: {
        startTick: 167000,
        endTick: 200000,
      },
      vestingConfig: "default",
    });

    const simulatedCreateData = await readWriteFactory.simulateCreate(
      createParams
    );
    expect(
      simulatedCreateData.asset.substring(
        simulatedCreateData.asset.length -
          DopplerSDK.VANITY_ADDRESS_ENDING.length
      )
    ).toBe(DopplerSDK.VANITY_ADDRESS_ENDING);
  });
});
