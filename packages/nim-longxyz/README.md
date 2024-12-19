# long.xyz

Long platform to lanch and trade tokens.

## Installation

Insall the monorepo dependencies,

```
bun install
```

then build the doppler v3 sdk:

```
cd packages/doppler-v3-sdk
bun install
bun build
```

and v4:

```
cd packages/doppler-v4-sdk
bun install
bun build
```

Alternatively, run the `build` command from the the monorepo's root packages.json.

## Development

Rename `.env.example` to `.env` and provide values to:

- `PUBLIC_PRIVY_APP_ID`
- and `PUBLIC_ALCHEMY_API_KEY`

```
cd packages/nim-longxyz
bun install
bun run dev
```

### Create token

- visit: https://localhost/create
-

## Deployment

**TBD**

- setup github action
- manual deployment
- ..
