import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import pepeIcon from "../assets/icons/pepe.svg";
import ethIcon from "../assets/icons/eth.svg";

interface TokenNameProps {
  name?: string;
  symbol?: string;
  isLoading?: boolean;
  className?: string;
  showSymbol?: boolean;
}

function TokenName({
  name,
  symbol,
  isLoading,
  showSymbol = true,
}: TokenNameProps) {
  if (isLoading) {
    return (
      <span className="flex items-center gap-1">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      {name === "Wrapped Ether" ? (
        <img src={ethIcon} alt="eth" className="token-icon h-4 w-4" />
      ) : (
        <img src={pepeIcon} alt="pepe" className="token-icon h-4 w-4" />
      )}
      {name} {showSymbol && `(${symbol})`}
    </span>
  );
}

export default TokenName;
