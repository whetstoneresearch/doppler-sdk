import { useState } from "react";
import { addresses } from "../addresses";
import { encodeAbiParameters, parseEther, Hex, Address } from "viem";
import { useReadContract, useAccount, useWalletClient } from "wagmi";
import { MigratorABI } from "../abis/MigratorABI";
import { CreateParams, ReadWriteFactory } from "doppler-v3-sdk";
import { getDrift } from "../utils/drift";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const TICK_SPACING = 60;

function roundToTickSpacing(tick: number): number {
  return Math.round(tick / TICK_SPACING) * TICK_SPACING;
}

const DEFAULT_START_TICK = 167520;
const DEFAULT_END_TICK = 200040;
const DEFAULT_TARGET_TICK = DEFAULT_END_TICK - 60;

function DeployDoppler() {
  const account = useAccount();
  const { data: walletClient } = useWalletClient(account);
  const [initialSupply, setInitialSupply] = useState("");
  const [numTokensToSell, setNumTokensToSell] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [startTick, setStartTick] = useState("");
  const [endTick, setEndTick] = useState("");
  const [targetTick, setTargetTick] = useState("");
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

  const handleTargetTickChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetTick(e.target.value);
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

  const handleTargetTickBlur = () => {
    if (targetTick) {
      const value = Number(targetTick);
      const roundedValue = roundToTickSpacing(value);
      setTargetTick(roundedValue.toString());
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
          { type: "int24" },
        ],
        [
          3000,
          showAdvanced ? Number(startTick) : DEFAULT_START_TICK,
          showAdvanced ? Number(endTick) : DEFAULT_END_TICK,
          showAdvanced ? Number(targetTick) : DEFAULT_TARGET_TICK,
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

      const { asset } = await readWriteFactory.airlock.simulateWrite(
        "create",
        args
      );

      const isToken0 = Number(asset) < Number(weth);
      if (isToken0) {
        poolInitializerData = encodeAbiParameters(
          [
            { type: "uint24" },
            { type: "int24" },
            { type: "int24" },
            { type: "int24" },
          ],
          [
            3000,
            showAdvanced ? Number(-endTick) : -DEFAULT_END_TICK,
            showAdvanced ? Number(-startTick) : -DEFAULT_START_TICK,
            showAdvanced ? Number(-targetTick) : -DEFAULT_TARGET_TICK,
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
    <div className="p-6">
      <h3 className="text-2xl font-semibold tracking-tight mb-6">
        Deploy Market
      </h3>
      <form onSubmit={handleDeploy} className="space-y-6 max-w-2xl mx-auto">
        <div className="space-y-2">
          <Label htmlFor="tokenName">Token Name</Label>
          <Input
            id="tokenName"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            required
            placeholder="Enter token name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tokenSymbol">Token Symbol</Label>
          <Input
            id="tokenSymbol"
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value)}
            required
            placeholder="Enter token symbol"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="initialSupply">Initial Supply (in tokens)</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setInitialSupply("1000000000");
                setNumTokensToSell("1000000000");
              }}
            >
              use default
            </Button>
          </div>
          <Input
            type="number"
            id="initialSupply"
            value={initialSupply}
            onChange={(e) => setInitialSupply(e.target.value)}
            required
            placeholder="Enter initial token supply"
            min="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="numTokensToSell">Number of Tokens to Sell</Label>
          <Input
            type="number"
            id="numTokensToSell"
            value={numTokensToSell}
            onChange={(e) => setNumTokensToSell(e.target.value)}
            required
            placeholder="Enter number of tokens to sell"
            min="0"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showAdvanced"
            checked={showAdvanced}
            onCheckedChange={(checked) => setShowAdvanced(checked as boolean)}
          />
          <Label
            htmlFor="showAdvanced"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Show Advanced Options
          </Label>
        </div>

        {showAdvanced && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
            <div className="space-y-2">
              <Label htmlFor="startTick">
                Start Tick (will be rounded to nearest {TICK_SPACING})
              </Label>
              <Input
                type="number"
                id="startTick"
                value={startTick}
                onChange={handleStartTickChange}
                onBlur={handleStartTickBlur}
                required
                placeholder={`Enter start tick (multiple of ${TICK_SPACING})`}
              />
              {startTick && Number(startTick) % TICK_SPACING !== 0 && (
                <p className="text-sm text-destructive">
                  Start tick must be divisible by {TICK_SPACING}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTick">
                End Tick (will be rounded to nearest {TICK_SPACING})
              </Label>
              <Input
                type="number"
                id="endTick"
                value={endTick}
                onChange={handleEndTickChange}
                onBlur={handleEndTickBlur}
                required
                placeholder={`Enter end tick (multiple of ${TICK_SPACING})`}
              />
              {endTick && Number(endTick) % TICK_SPACING !== 0 && (
                <p className="text-sm text-destructive">
                  End tick must be divisible by {TICK_SPACING}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetTick">
                Target Tick (will be rounded to nearest {TICK_SPACING})
              </Label>
              <Input
                type="number"
                id="targetTick"
                value={targetTick}
                onChange={handleTargetTickChange}
                onBlur={handleTargetTickBlur}
                required
                placeholder={`Enter target tick (multiple of ${TICK_SPACING})`}
              />
              {targetTick && Number(targetTick) % TICK_SPACING !== 0 && (
                <p className="text-sm text-destructive">
                  Target tick must be divisible by {TICK_SPACING}
                </p>
              )}
            </div>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
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
                Number(endTick) % TICK_SPACING !== 0))
          }
        >
          {isDeploying ? "Deploying..." : "Deploy Doppler"}
        </Button>
      </form>
    </div>
  );
}

export default DeployDoppler;
