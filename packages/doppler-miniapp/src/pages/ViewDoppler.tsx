import { Navigate, useParams } from "react-router-dom";
import { addresses } from "../addresses";
import { Address, formatEther } from "viem";
import LiquidityChart from "../components/LiquidityChart";
import TokenName from "../components/TokenName";
import { usePoolData } from "../hooks/usePoolData";
import { getDrift } from "../utils/drift";
import { ReadWriteFactory } from "doppler-v3-sdk";
import { useWalletClient } from "wagmi";

function ViewDoppler() {
  const { id } = useParams();
  const walletClient = useWalletClient();
  const { airlock, v3Initializer } = addresses;

  console.log(airlock);

  if (!id || !/^0x[a-fA-F0-9]{40}$/.test(id)) {
    return <Navigate to="/" />;
  }

  const { data, isLoading } = usePoolData(
    airlock,
    v3Initializer,
    id as Address
  );

  const { asset, numeraire, assetData, poolData } = data;

  // const handleMigrate = async () => {
  //   const drift = getDrift(walletClient);
  //   const readWriteFactory = new ReadWriteFactory(airlock, drift);

  //   console.log(id);

  //   await readWriteFactory.airlock.simulateWrite("migrate", {
  //     asset: id as Address,
  //   });
  //   await readWriteFactory.migrate(id as Address);
  // };

  const { initializerState, slot0 } = poolData ?? {};

  // const migrationEnabled =
  //   initializerState?.targetTick &&
  //   slot0?.tick &&
  //   initializerState.targetTick > slot0.tick;

  return (
    <div className="view-doppler">
      <h3 className="page-title">
        <TokenName
          name={asset?.name ?? ""}
          symbol={asset?.symbol ?? ""}
          showSymbol={false}
        />{" "}
        /{" "}
        <TokenName
          name={numeraire?.name ?? ""}
          symbol={numeraire?.symbol ?? ""}
          showSymbol={false}
        />
      </h3>
      {isLoading ? (
        <div className="loading-content">
          <div className="loading-spinner" />
          <p>Loading chart data...</p>
        </div>
      ) : (
        <LiquidityChart
          positions={poolData?.positions ?? []}
          currentTick={poolData?.slot0?.tick ?? 0}
        />
      )}
      <div className="doppler-info">
        {assetData && numeraire && (
          <>
            <div className="market-stats">
              <div className="stat-item">
                <label>Total Supply</label>
                <span>{formatEther(asset?.totalSupply ?? 0n)}</span>
              </div>
              <div className="stat-item">
                <label>Tokens Sold</label>
                <span>
                  {(
                    Number(formatEther(asset?.totalSupply ?? 0n)) -
                    Number(formatEther(poolData?.poolBalance ?? 0n))
                  ).toFixed(0)}
                </span>
              </div>
              <div className="stat-item">
                <label>Current Tick</label>
                <span>{poolData?.slot0?.tick ?? 0}</span>
              </div>
              <div className="stat-item">
                <label>Target Tick</label>
                <span>{poolData?.initializerState?.targetTick ?? 0}</span>
              </div>
            </div>
            <a
              href={`https://app.uniswap.org/swap?chain=unichainsepolia&inputCurrency=NATIVE&outputCurrency=${asset?.token.contract.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="trade-button"
            >
              Trade
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default ViewDoppler;
