export const MARKET_PAGE_SIZE:number;
export const MARKET_REVIEW_TTL_MS:number;
export function checkedUniqTokenId(value:unknown):string;
export function checkedMarketCursor(value:unknown):string|null;
export function parseNativeSalePrice(value:unknown):{
 amount:string;amountRaw:string;currency:string;decimals:number;
};
export type ResaleRow={token_id:string|number;owner:string;price:string;promoter_basis_point:number};
export type NativeTokenRow={id:string|number;token_factory_id:string|number;serial_number:string|number};
export type VerifiedNativeListing={tokenId:string;owner:string;price:ReturnType<typeof parseNativeSalePrice>;
 promoterBasisPoints:number;factoryId:string;serialNumber:string;nativeOwnerCrosschecked:true;
 assetPriceVerified:true;marketplace:string;transactionEnabled:false};
export function validateResaleRow(value:unknown):{
 tokenId:string;owner:string;price:ReturnType<typeof parseNativeSalePrice>;promoterBasisPoints:number;
};
export function verifyResaleOwnership(resale:unknown,tokenRow:unknown):VerifiedNativeListing;
export function validateMarketIntent(intent:"buy"|"cancel"|"list",account:string,
 listing:VerifiedNativeListing|null,ownedUnlisted:{owner:string}|null):{
 intent:string;account:string;conditionsMet:boolean;reasons:string[];
 walletOwnershipVerified:false;contractExecutionSimulationVerified:false;
 feesFullyVerified:false;executionEnabled:false;
};
export function nextMarketCursor(rows:Array<{token_id:string|number}>,more:boolean,nextKey:unknown):string|null;
