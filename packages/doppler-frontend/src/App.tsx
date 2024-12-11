import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useDopplerRouter } from "./DopplerRouter";

const DOPPLER_ADDRESS = `0x658D46aC3F6253Ce0D5209036838fc2F65c4B720`;
const KEY_POOL = `0xba49dddf3725a789c10bc12be533e88e450b9a922854f2f91b0de2c0bef3263d`;
const AMOUNT = 1000n;

function App() {
  const account = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const router = useDopplerRouter(DOPPLER_ADDRESS);

  return (
    <>
      <div>
        <h2>Account</h2>

        <div>
          status: {account.status}
          <br />
          addresses: {JSON.stringify(account.addresses)}
          <br />
          chainId: {account.chainId}
        </div>

        {account.status === "connected" && (
          <button type="button" onClick={() => disconnect()}>
            Disconnect
          </button>
        )}
      </div>

      <div>
        <h2>Connect</h2>
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => connect({ connector })}
            type="button"
          >
            {connector.name}
          </button>
        ))}
        <div>{status}</div>
        <div>{error?.message}</div>
      </div>

      <div>
        <h2>Route</h2>
        <pre>
          {`
doppler address: ${DOPPLER_ADDRESS}
key pool: ${KEY_POOL}
amount: ${AMOUNT}
`}
        </pre>
        <button
          onClick={async () =>
            await router.buyExactIn({
              key: KEY_POOL,
              amount: AMOUNT,
            })
          }
        >
          buyExactIn (1000)
        </button>
      </div>
    </>
  );
}

export default App;
