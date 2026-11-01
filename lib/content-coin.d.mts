export type ContentCoinDraft={postId:string;name:string;symbol:string;supplyTokens:number;metadataURI:string};
export type ContentSnapshot={postId:string;creatorAddress:string;chainId:number;version:string;textHash:`0x${string}`;contentRef:`0x${string}`};
export const LOOKE_CONTENT_CHAIN_ID:number;
export const MAX_CONTENT_DRAFTS:number;
export function checkedContentPostId(value:unknown):string;
export function normalizeContentCoinDraft(input:unknown):ContentCoinDraft;
export function contentSnapshot(postId:string,creatorAddress:string,text:string):ContentSnapshot;
export function contentSnapshotIsCurrent(snapshot:{textHash?:string;contentRef?:string}|null|undefined,postId:string,creatorAddress:string,text:string):boolean;
