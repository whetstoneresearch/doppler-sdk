/**
 * ConnectWallet Component
 *
 * Button component for wallet connection with dropdown menu.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useStandardWallet } from '../providers/index.js';

/**
 * Props for ConnectWallet component
 */
export interface ConnectWalletProps {
  /** Additional CSS classes */
  className?: string;
  /** Text to show when disconnected */
  connectLabel?: string;
  /** Text to show while connecting */
  connectingLabel?: string;
  /** Number of characters to show from address (each side) */
  addressChars?: number;
  /** Callback when connection state changes */
  onConnectionChange?: (connected: boolean) => void;
  /** Whether to show wallet selector dropdown */
  showWalletSelector?: boolean;
}

/**
 * Truncate an address for display
 */
function truncateAddress(address: string, chars: number): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Wallet connection button with dropdown
 *
 * Shows "Connect Wallet" when disconnected, truncated address when connected.
 * Includes dropdown menu for disconnect and wallet selection.
 *
 * @example
 * ```tsx
 * function Header() {
 *   return (
 *     <nav>
 *       <ConnectWallet
 *         className="bg-blue-500 text-white px-4 py-2 rounded"
 *         onConnectionChange={(connected) => console.log('Connected:', connected)}
 *       />
 *     </nav>
 *   );
 * }
 * ```
 */
export function ConnectWallet({
  className = '',
  connectLabel = 'Connect Wallet',
  connectingLabel = 'Connecting...',
  addressChars = 4,
  onConnectionChange,
  showWalletSelector = true,
}: ConnectWalletProps): JSX.Element {
  const {
    connected,
    connecting,
    account,
    wallets,
    wallet,
    select,
    connect,
    disconnect,
  } = useStandardWallet();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
        setSelectorOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notify on connection change
  useEffect(() => {
    onConnectionChange?.(connected);
  }, [connected, onConnectionChange]);

  const handleConnect = useCallback(async () => {
    if (wallets.length === 0) {
      // No wallets available
      return;
    }

    if (wallets.length === 1 || !showWalletSelector) {
      // Auto-select single wallet
      if (!wallet && wallets.length > 0) {
        select(wallets[0]);
      }
      await connect();
    } else {
      // Show wallet selector
      setSelectorOpen(true);
    }
  }, [wallets, wallet, showWalletSelector, select, connect]);

  const handleSelectWallet = useCallback(
    async (selectedWallet: (typeof wallets)[number]) => {
      select(selectedWallet);
      setSelectorOpen(false);
      // Connect after selection
      setTimeout(async () => {
        await connect();
      }, 100);
    },
    [select, connect],
  );

  const handleDisconnect = useCallback(async () => {
    setDropdownOpen(false);
    await disconnect();
  }, [disconnect]);

  const toggleDropdown = useCallback(() => {
    setDropdownOpen((open) => !open);
  }, []);

  // Get display address
  const displayAddress = account?.address
    ? truncateAddress(account.address, addressChars)
    : '';

  // Render wallet selector dropdown
  if (selectorOpen && wallets.length > 1) {
    return (
      <div ref={dropdownRef} className={`relative inline-block ${className}`}>
        <button
          type="button"
          onClick={() => setSelectorOpen(false)}
          aria-label="Close wallet selector"
          aria-expanded={selectorOpen}
          aria-haspopup="listbox"
        >
          Select Wallet
        </button>
        <div
          role="listbox"
          aria-label="Available wallets"
          className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-lg z-50"
        >
          {wallets.map((w) => (
            <button
              key={w.name}
              type="button"
              role="option"
              aria-selected={wallet?.name === w.name}
              onClick={() => handleSelectWallet(w)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
            >
              {w.icon && (
                <img src={w.icon} alt={`${w.name} icon`} className="w-5 h-5" />
              )}
              <span>{w.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Render connecting state
  if (connecting) {
    return (
      <button
        type="button"
        disabled
        aria-busy="true"
        aria-label="Connecting to wallet"
        className={className}
      >
        {connectingLabel}
      </button>
    );
  }

  // Render connected state with dropdown
  if (connected && account) {
    return (
      <div ref={dropdownRef} className={`relative inline-block ${className}`}>
        <button
          type="button"
          onClick={toggleDropdown}
          aria-label={`Connected wallet ${displayAddress}`}
          aria-expanded={dropdownOpen}
          aria-haspopup="menu"
        >
          {displayAddress}
        </button>
        {dropdownOpen && (
          <div
            role="menu"
            aria-label="Wallet options"
            className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-lg z-50"
          >
            <div
              role="menuitem"
              className="px-4 py-2 text-sm text-gray-500 border-b truncate"
              title={account.address}
            >
              {account.address}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={handleDisconnect}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // Render disconnected state
  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={wallets.length === 0}
      aria-label={wallets.length === 0 ? 'No wallets available' : connectLabel}
      className={className}
    >
      {wallets.length === 0 ? 'No Wallet' : connectLabel}
    </button>
  );
}
