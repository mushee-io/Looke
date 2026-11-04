export const lookeCoinFactoryAbi = [
  {
    type: "function",
    name: "createCoin",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "initialSupply", type: "uint256" },
    ],
    outputs: [{ name: "coin", type: "address" }],
  },
  {
    type: "event",
    name: "CoinCreated",
    anonymous: false,
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "coin", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
      { name: "initialSupply", type: "uint256", indexed: false },
    ],
  },
] as const;
