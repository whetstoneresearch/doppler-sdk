import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import {
  useAccount,
  useConnect,
  useBalance,
  useSwitchChain,
  useDisconnect,
} from "wagmi";
import DeployDoppler from "./pages/DeployDoppler";
import ViewDoppler from "./pages/ViewDoppler";
import HomePage from "./pages/HomePage";
import "./theme.css";

function App() {
  const account = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { data: balance } = useBalance({
    address: account.addresses?.[0],
  });

  const handleConnect = () => {
    try {
      connect({ connector: connectors[0] });
    } catch (error) {
      console.error("Error connecting to wallet", error);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const isUniSepolia = account.chain?.id === 1301; // UniChain Sepolia chain ID

  const handleSwitchNetwork = () => {
    if (switchChain) {
      switchChain({ chainId: 1301 });
    }
  };

  return (
    <Router>
      <div className="app">
        <nav className="nav-container">
          <div className="nav-links">
            <Link to="/" className="nav-button">
              Home
            </Link>
            <Link to="/deploy" className="nav-button">
              Deploy Market
            </Link>
          </div>
          <div className="wallet-section">
            {account.status === "connected" ? (
              <div className="address">
                <span className="address-text">
                  {account.addresses?.[0]?.slice(0, 6)}...
                  {account.addresses?.[0]?.slice(-4)}
                </span>
                <span className="balance">
                  {balance?.formatted.slice(0, 6)} ETH
                </span>
                <button
                  onClick={handleDisconnect}
                  className="disconnect-button"
                  aria-label="Disconnect wallet"
                >
                  ⏻
                </button>
              </div>
            ) : (
              <button className="connect-button" onClick={handleConnect}>
                Connect Wallet
              </button>
            )}
          </div>
        </nav>

        {account.status === "connected" && !isUniSepolia && (
          <div className="overlay">
            <div className="overlay-content">
              <p>Please switch to UniChain Sepolia network</p>
              <button className="connect-button" onClick={handleSwitchNetwork}>
                Switch Network
              </button>
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
