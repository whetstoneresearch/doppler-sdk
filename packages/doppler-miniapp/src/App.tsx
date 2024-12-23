import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import {
  useAccount,
  useConnect,
  useBalance,
  useSwitchChain,
  useDisconnect,
} from "wagmi";
import { Button } from "@/components/ui/button";
import DeployDoppler from "./pages/DeployDoppler";
import ViewDoppler from "./pages/ViewDoppler";
import HomePage from "./pages/HomePage";

function App() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isLoading: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: balance } = useBalance({
    address: address,
  });

  const handleConnect = async () => {
    const connector = connectors[0];
    if (connector) {
      try {
        await connect({ connector });
      } catch (error) {
        console.error("Failed to connect:", error);
      }
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const isUniSepolia = chain?.id === 1301;

  const handleSwitchNetwork = async () => {
    if (switchChain) {
      try {
        await switchChain({ chainId: 1301 });
      } catch (error) {
        console.error("Failed to switch network:", error);
      }
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-background">
        <nav className="flex items-center justify-between p-4 border-b">
          <div className="flex gap-4">
            <Button variant="ghost" asChild>
              <Link to="/" className="text-sm font-medium">
                Home
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/deploy" className="text-sm font-medium">
                Deploy Market
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-4">
            {isConnected ? (
              <div className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md">
                <span className="text-muted-foreground">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                {balance && (
                  <span className="px-2 py-0.5 bg-muted rounded text-xs">
                    {Number(balance?.formatted).toFixed(4)} ETH
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDisconnect}
                  className="ml-2"
                  aria-label="Disconnect wallet"
                >
                  ⏻
                </Button>
              </div>
            ) : (
              <Button onClick={handleConnect} disabled={isConnecting}>
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </div>
        </nav>

        {isConnected && !isUniSepolia && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm">
            <div className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] p-6 shadow-lg border rounded-lg bg-background">
              <p className="mb-4">Please switch to UniChain Sepolia network</p>
              <Button onClick={handleSwitchNetwork}>Switch Network</Button>
            </div>
          </div>
        )}

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/deploy" element={<DeployDoppler />} />
          <Route path="/doppler/:id" element={<ViewDoppler />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
