export const fetchTokenUriData = async (tokenUri: string) => {
  let tokenMetadata: Response | undefined;
  if (tokenUri?.startsWith("ipfs://")) {
    tokenMetadata = await fetch(
      `https://pure-st.mypinata.cloud/ipfs/${
        tokenUri.split("ipfs://")[1]
      }?pinataGatewayToken=OwjiAhUSmeNh3slN52ig-i3YXZ-9gkG8d5uxrdYEikBXPAwUpr3LcdiJ9F0udzn7`
    );
  } else if (tokenUri?.startsWith("https://")) {
    tokenMetadata = await fetch(tokenUri);
  }
  return await tokenMetadata?.json();
};
