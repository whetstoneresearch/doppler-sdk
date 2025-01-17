import { Link } from "react-router-dom";
import { addresses } from "../addresses";
import { formatEther } from "viem";
import TokenName from "../components/TokenName";
import { usePoolCreationDatas } from "../hooks/usePoolCreationData";

function HomePage() {
  const {
    data: poolDatas,
    isLoading: isPoolsLoading,
    error: poolDataError,
  } = usePoolCreationDatas(addresses.airlock);

  if (poolDataError) {
    throw poolDataError;
  }

  return (
    <div className="home-page">
      <div className="doppler-actions">
        <div className="recent-dopplers">
          <h2>Recent Markets</h2>
          {isPoolsLoading ? (
            <div className="loading-content">
              <div className="loading-spinner" />
              <p>Loading Dopplers...</p>
            </div>
          ) : poolDatas?.length === 0 ? (
            <p>No Dopplers found</p>
          ) : (
            <div className="doppler-list">
              {poolDatas?.map((poolData) => (
                <div key={poolData.asset.address} className="doppler-item">
                  <Link
                    to={`/doppler/${poolData.asset.address}`}
                    className="doppler-link"
                  >
                    <div className="doppler-info">
                      <span className="doppler-address">
                        <TokenName
                          name={poolData.asset.name}
                          symbol={poolData.asset.symbol}
                        />{" "}
                        /{" "}
                        <TokenName
                          name={poolData.numeraire.name}
                          symbol={poolData.numeraire.symbol}
                        />
                      </span>
                      <span className="doppler-address">
                        Tokens Sold:{" "}
                        {Number(
                          formatEther(poolData.poolAssetBalance ?? 0n)
                        ).toFixed(0)}{" "}
                        / {formatEther(poolData.asset.totalSupply ?? 0n)}
                      </span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HomePage;
