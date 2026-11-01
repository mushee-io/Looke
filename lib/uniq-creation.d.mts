export type UniqCollectionInput={name:string;description:string;imageURI:string;nativeAccount:string|null;factoryId:string|null};
export type UniqItemInput={collectionId:string;name:string;description:string;imageURI:string;editionLimit:number};
export const MAX_UNIQ_COLLECTIONS:number;
export const MAX_UNIQ_ITEMS_PER_COLLECTION:number;
export function checkedUniqDraftId(value:unknown):string;
export function checkedNativeAccount(value:unknown):string;
export function checkedUniqFactoryId(value:unknown):string;
export function normalizeUniqCollection(value:unknown):UniqCollectionInput;
export function normalizeUniqItem(value:unknown):UniqItemInput;
export function buildUniqManifest(kind:"collection"|"uniq",input:UniqCollectionInput|UniqItemInput):string;
export function reviewNativeUniqFactory(row:unknown,account:unknown,nowSeconds:number):{
 eligible:boolean;reasons:string[];role:string;assetManager?:string|null;assetCreator?:string|null;
 maximumMintable?:number|null;mintedTokens?:number|null;
};
