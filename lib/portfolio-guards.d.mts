export const MAX_PORTFOLIO_TOKENS:number;
export const NATIVE_PAGE_SIZE:number;
export const ACTIVITY_BLOCK_WINDOW:bigint;
export function checkedEvmWallet(value:unknown):string;
export function configuredPortfolioTokens(value:unknown):string[];
export function checkedAssetRaw(value:unknown):string;
export function checkedNativePortfolioRow(value:unknown):{
 tokenId:string;factoryId:string;serialNumber:string;
};
export function checkedNativePortfolioCursor(value:unknown):string|null;
export function nativePortfolioNextCursor(rows:Array<{id:string|number}>,more:boolean,nextKey:unknown):string|null;
export function confirmedActivityWindow(head:bigint,confirmations?:bigint):{
 fromBlock:bigint;toBlock:bigint;confirmationDepth:bigint;
}|null;
export type PortfolioTransfer={token:string;from:string;to:string;txHash:string;
 blockNumber:string;logIndex:number;valueRaw:string;direction:"in"|"out"|"self"};
export function normalizePortfolioTransfer(event:unknown,wallet:string):PortfolioTransfer;
export function orderedUniqueTransfers(events:PortfolioTransfer[],max?:number):PortfolioTransfer[];
export function nativeAccountPortfolioLabel(value:unknown):string;
