import { useState } from "react";
import { addresses } from "../addresses";
import {
  encodeAbiParameters,
  parseEther,
  Hex,
  Address,
  encodePacked,
  zeroAddress,
} from "viem";
import { useReadContract, useAccount, useWalletClient } from "wagmi";
import { MigratorABI } from "../abis/MigratorABI";
import { CreateParams, ReadWriteFactory } from "doppler-v3-sdk";
import { getDrift } from "../utils/drift";

const TICK_SPACING = 60;

function roundToTickSpacing(tick: number): number {
  return Math.round(tick / TICK_SPACING) * TICK_SPACING;
}

const DEFAULT_START_TICK = 167520;
const DEFAULT_END_TICK = 200040;
const DEFAULT_NUM_POSITIONS = 10;
const DEFAULT_MAX_SHARE_TO_BE_SOLD = parseEther("0.2");
const DEFAULT_MAX_SHARE_TO_BOND = parseEther("0.5");

function DeployDoppler() {
  const account = useAccount();
  const { data: walletClient } = useWalletClient(account);
  const [initialSupply, setInitialSupply] = useState("");
  const [numTokensToSell, setNumTokensToSell] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [startTick, setStartTick] = useState("");
  const [endTick, setEndTick] = useState("");
  const [numPositions, setNumPositions] = useState("");
  const [maxShareToBeSold, setMaxShareToBeSold] = useState("");
  const [maxShareToBond, setMaxShareToBond] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    tokenFactory,
    governanceFactory,
    v3Initializer,
    liquidityMigrator,
    airlock,
  } = addresses;

  const { data: weth } = useReadContract({
    abi: MigratorABI,
    address: addresses.liquidityMigrator,
    functionName: "weth",
  });

  const handleStartTickChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartTick(e.target.value);
  };

  const handleEndTickChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndTick(e.target.value);
  };

  const handleNumPositionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNumPositions(e.target.value);
  };

  const handleMaxShareToBeSoldChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setMaxShareToBeSold(e.target.value);
  };

  const handleMaxShareToBondChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setMaxShareToBond(e.target.value);
  };

  const handleMaxShareToBondBlur = () => {
    if (maxShareToBond) {
      setMaxShareToBond(maxShareToBond);
    }
  };

  const handleMaxShareToSoldBlur = () => {
    if (maxShareToBeSold) {
      setMaxShareToBeSold(maxShareToBeSold);
    }
  };

  const handleNumPositionsBlur = () => {
    if (numPositions) {
      setNumPositions(numPositions);
    }
  };

  const handleStartTickBlur = () => {
    if (startTick) {
      const value = Number(startTick);
      const roundedValue = roundToTickSpacing(value);
      setStartTick(roundedValue.toString());
    }
  };

  const handleEndTickBlur = () => {
    if (endTick) {
      const value = Number(endTick);
      const roundedValue = roundToTickSpacing(value);
      setEndTick(roundedValue.toString());
    }
  };

  const generateRandomSalt = () => {
    const array = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    // XOR addr with the random bytes
    if (account.address) {
      const addressBytes = account.address.slice(2).padStart(40, "0");
      // XOR first 20 bytes with the address
      for (let i = 0; i < 20; i++) {
        const addressByte = parseInt(
          addressBytes.slice(i * 2, (i + 1) * 2),
          16
        );
        array[i] ^= addressByte;
      }
    }
    return `0x${Array.from(array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`;
  };

  const handleDeploy = async (e: React.FormEvent) => {
    if (!walletClient) throw new Error("Wallet client not found");
    e.preventDefault();
    setIsDeploying(true);
    try {
      // Encode the various data fields
      const tokenFactoryData = encodeAbiParameters(
        [
          { type: "string" },
          { type: "string" },
          { type: "uint256" },
          { type: "uint256" },
          { type: "address[]" },
          { type: "uint256[]" },
        ],
        [tokenName, tokenSymbol, 0n, 0n, [], []]
      );

      const governanceFactoryData = encodeAbiParameters(
        [{ type: "string" }],
        [tokenName]
      );

      let poolInitializerData = encodeAbiParameters(
        [
          { type: "uint24" },
          { type: "int24" },
          { type: "int24" },
          { type: "uint16" },
          { type: "uint256" },
          { type: "uint256" },
        ],
        [
          3000,
          showAdvanced ? Number(startTick) : DEFAULT_START_TICK,
          showAdvanced ? Number(endTick) : DEFAULT_END_TICK,
          showAdvanced ? Number(numPositions) : DEFAULT_NUM_POSITIONS,
          showAdvanced
            ? parseEther(maxShareToBeSold)
            : DEFAULT_MAX_SHARE_TO_BE_SOLD,
          showAdvanced ? parseEther(maxShareToBond) : DEFAULT_MAX_SHARE_TO_BOND,
        ]
      );

      // Generate a random salt
      const salt = generateRandomSalt();
      if (!weth) throw new Error("WETH address not loaded");

      const args: CreateParams = {
        initialSupply: parseEther(initialSupply),
        numTokensToSell: parseEther(numTokensToSell),
        numeraire: weth,
        tokenFactory,
        tokenFactoryData,
        governanceFactory,
        governanceFactoryData,
        poolInitializer: v3Initializer,
        poolInitializerData,
        liquidityMigrator,
        liquidityMigratorData: "0x",
        integrator: account.address as Address,
        salt: salt as Hex,
      };

      const drift = getDrift(walletClient);
      const readWriteFactory = new ReadWriteFactory(airlock, drift);

      const { asset } = await readWriteFactory.airlock.simulateWrite("create", {
        createData: args,
      });

      const isToken0 = Number(asset) < Number(weth);
      if (isToken0) {
        poolInitializerData = encodeAbiParameters(
          [
            { type: "uint24" },
            { type: "int24" },
            { type: "int24" },
            { type: "uint16" },
            { type: "uint256" },
            { type: "uint256" },
          ],
          [
            3000,
            showAdvanced ? Number(-endTick) : -DEFAULT_END_TICK,
            showAdvanced ? Number(-startTick) : -DEFAULT_START_TICK,
            showAdvanced ? Number(numPositions) : DEFAULT_NUM_POSITIONS,
            showAdvanced
              ? parseEther(maxShareToBeSold)
              : DEFAULT_MAX_SHARE_TO_BE_SOLD,
            showAdvanced
              ? parseEther(maxShareToBond)
              : DEFAULT_MAX_SHARE_TO_BOND,
          ]
        );
        args.poolInitializerData = poolInitializerData;
      }

      await readWriteFactory.create(args);
    } catch (error) {
      console.error("Deployment failed:", error);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="deploy-doppler">
      <h3 className="page-title">Deploy Market</h3>
      <form onSubmit={handleDeploy} className="deploy-form">
        <div className="form-group">
          <label htmlFor="tokenName">Token Name</label>
          <input
            type="text"
            id="tokenName"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            required
            placeholder="Enter token name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="tokenSymbol">Token Symbol</label>
          <input
            type="text"
            id="tokenSymbol"
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value)}
            required
            placeholder="Enter token symbol"
          />
        </div>

        <div className="form-group">
          <label htmlFor="initialSupply">
            Initial Supply (in tokens)
            <button
              type="button"
              className="inline-default-button"
              onClick={() => {
                setInitialSupply("1000000000");
                setNumTokensToSell("1000000000");
              }}
            >
              use default
            </button>
          </label>
          <input
            type="number"
            id="initialSupply"
            value={initialSupply}
            onChange={(e) => setInitialSupply(e.target.value)}
            required
            placeholder="Enter initial token supply"
            min="0"
          />
        </div>

        <div className="form-group">
          <label htmlFor="numTokensToSell">Number of Tokens to Sell</label>
          <input
            type="number"
            id="numTokensToSell"
            value={numTokensToSell}
            onChange={(e) => setNumTokensToSell(e.target.value)}
            required
            placeholder="Enter number of tokens to sell"
            min="0"
          />

          <div className="form-group">
            <label className="advanced-toggle">
              <input
                type="checkbox"
                checked={showAdvanced}
                onChange={(e) => setShowAdvanced(e.target.checked)}
              />
              Show Advanced Options
            </label>
          </div>

          {showAdvanced && (
            <>
              <div className="form-group">
                <label htmlFor="startTick">
                  Start Tick (will be rounded to nearest {TICK_SPACING})
                </label>
                <input
                  type="number"
                  id="startTick"
                  value={startTick}
                  onChange={handleStartTickChange}
                  onBlur={handleStartTickBlur}
                  required
                  placeholder={`Enter start tick (multiple of ${TICK_SPACING})`}
                />
                {startTick && Number(startTick) % TICK_SPACING !== 0 && (
                  <span className="error-message">
                    Start tick must be divisible by {TICK_SPACING}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="endTick">
                  End Tick (will be rounded to nearest {TICK_SPACING})
                </label>
                <input
                  type="number"
                  id="endTick"
                  value={endTick}
                  onChange={handleEndTickChange}
                  onBlur={handleEndTickBlur}
                  required
                  placeholder={`Enter end tick (multiple of ${TICK_SPACING})`}
                />
                {endTick && Number(endTick) % TICK_SPACING !== 0 && (
                  <span className="error-message">
                    End tick must be divisible by {TICK_SPACING}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="numPositions">Number of Positions</label>
                <input
                  type="number"
                  id="numPositions"
                  value={numPositions}
                  onChange={handleNumPositionsChange}
                  onBlur={handleNumPositionsBlur}
                  required
                  placeholder={`Enter number of positions`}
                />
              </div>

              <div className="form-group">
                <label htmlFor="maxShareToBeSold">Max Share to Be Sold</label>
                <input
                  type="number"
                  id="maxShareToBeSold"
                  value={maxShareToBeSold}
                  onChange={handleMaxShareToBeSoldChange}
                  onBlur={handleMaxShareToSoldBlur}
                  required
                  placeholder={`Enter max share to be sold`}
                />
              </div>

              <div className="form-group">
                <label htmlFor="maxShareToBond">Max Share to Bond</label>
                <input
                  type="number"
                  id="maxShareToBond"
                  value={maxShareToBond}
                  onChange={handleMaxShareToBondChange}
                  onBlur={handleMaxShareToBondBlur}
                  required
                  placeholder={`Enter max share to bond`}
                />
              </div>
            </>
          )}
        </div>

        <button
          type="submit"
          className="deploy-button"
          disabled={
            isDeploying ||
            !initialSupply ||
            !numTokensToSell ||
            !tokenName ||
            !tokenSymbol ||
            (showAdvanced &&
              (!startTick ||
                !endTick ||
                Number(startTick) % TICK_SPACING !== 0 ||
                Number(endTick) % TICK_SPACING !== 0 ||
                !numPositions ||
                !maxShareToBeSold ||
                !maxShareToBond))
          }
        >
          {isDeploying ? "Deploying..." : "Deploy Doppler"}
        </button>
      </form>
    </div>
  );
}

export default DeployDoppler;
