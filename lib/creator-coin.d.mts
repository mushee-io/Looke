export type CreatorCoinDraft = {name:string;symbol:string;supplyTokens:number;metadataURI:string};
export type CreatorCoinPreview=CreatorCoinDraft & {creatorAddress:string;kind:0;contentRef:string;supplyRaw:string;network:string;chainId:18881;mintRecipient:string;liquidityCreated:false;executionEnabled:false};
export const MAX_CREATOR_SUPPLY:number;
export function checkedIpfsMetadataUri(value:unknown):string;
export function normalizeCreatorCoinDraft(input:unknown):CreatorCoinDraft;
export function creatorCoinPreview(draft:CreatorCoinDraft,creatorAddress:string):CreatorCoinPreview;
