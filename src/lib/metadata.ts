import { validateMetadataJSON } from "../../vendor/zora/coins-sdk/validateMetadataJSON";

export type CoinDraft = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  metadataURI: string;
  supply: string;
};

export function validateCoinDraft(input: CoinDraft): CoinDraft {
  const draft = {
    name: input.name.trim(),
    symbol: input.symbol.trim().toUpperCase(),
    description: input.description.trim(),
    image: input.image.trim(),
    metadataURI: input.metadataURI.trim(),
    supply: input.supply.trim(),
  };
  if (!draft.name || draft.name.length > 64) throw new Error("Coin name must be 1–64 characters.");
  if (!/^[A-Z0-9]{2,12}$/.test(draft.symbol)) throw new Error("Ticker must be 2–12 letters or numbers.");
  if (!draft.description) throw new Error("Add a description for your coin.");
  validateMetadataJSON({ name: draft.name, description: draft.description, image: draft.image });
  if (!/^(ipfs:\/\/|ar:\/\/|https:\/\/)/.test(draft.metadataURI)) {
    throw new Error("Metadata JSON URI must start with ipfs://, ar:// or https://.");
  }
  if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(draft.supply) || Number(draft.supply) <= 0) {
    throw new Error("Initial supply must be a positive number with up to 18 decimals.");
  }
  return draft;
}
