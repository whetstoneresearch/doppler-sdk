import { decodeStringFromHex } from "./decodeStringFromHex";

export const fetchTokenURI = async (tokenAddress: string, tokenId = 1) => {
  const url =
    "https://base-mainnet.g.alchemy.com/v2/bpmO7sJ105EEpSjKBn5WBuTduqO6pkKV";

  const tokenIdHex = tokenId.toString(16).padStart(64, "0");
  const data = `0x3c130d90${tokenIdHex}`;

  const payload = {
    jsonrpc: "2.0",
    method: "eth_call",
    params: [
      {
        to: tokenAddress,
        data: data,
      },
      "latest",
    ],
    id: 1,
  };

  const response = (await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => res.json())) as { data: { result: string } };

  if (response.data.result) {
    const hexResult = response.data.result;
    const decoded = decodeStringFromHex(hexResult);
    return decoded;
  } else {
    return null;
  }
};
