import { Link } from "react-router-dom";
import { addresses } from "../addresses";
import { formatEther } from "viem";
import TokenName from "@/components/TokenName";
import { usePoolCreationDatas } from "@/hooks/usePoolCreationData";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            Recent Markets
          </h2>
          {isPoolsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 border rounded-md">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <TokenName isLoading />
                      <span className="text-muted-foreground">/</span>
                      <TokenName isLoading />
                    </div>
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : poolDatas?.length === 0 ? (
            <p className="text-center text-muted-foreground">
              No Dopplers found
            </p>
          ) : (
            <div className="space-y-2">
              {poolDatas?.map((poolData) => (
                <Button
                  key={poolData.asset.address}
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  asChild
                >
                  <Link to={`/doppler/${poolData.asset.address}`}>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <TokenName
                          name={poolData.asset.name}
                          symbol={poolData.asset.symbol}
                        />
                        <span className="text-muted-foreground">/</span>
                        <TokenName
                          name={poolData.numeraire.name}
                          symbol={poolData.numeraire.symbol}
                        />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Tokens Sold:{" "}
                        {Number(
                          formatEther(poolData.poolAssetBalance ?? 0n)
                        ).toFixed(0)}{" "}
                        / {formatEther(poolData.asset.totalSupply ?? 0n)}
                      </div>
                    </div>
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HomePage;
