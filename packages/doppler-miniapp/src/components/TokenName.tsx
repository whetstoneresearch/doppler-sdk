import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";

interface TokenNameProps {
  name?: string;
  symbol?: string;
  isLoading?: boolean;
}

function TokenName({ name, symbol, isLoading }: TokenNameProps) {
  if (isLoading) {
    return (
      <AspectRatio ratio={3 / 1} className="w-32">
        <Skeleton className="h-full" />
      </AspectRatio>
    );
  }

  if (!name || !symbol) {
    return null;
  }

  return (
    <AspectRatio ratio={3 / 1} className="w-32 bg-muted rounded-md">
      <div className="flex flex-col justify-center items-center h-full">
        <span className="text-sm font-medium truncate" title={name}>
          {name}
        </span>
        <span className="text-xs text-muted-foreground" title={symbol}>
          {symbol}
        </span>
      </div>
    </AspectRatio>
  );
}

export default TokenName;
