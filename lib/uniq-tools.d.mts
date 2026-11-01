export const MAX_DRAFT_REVISION:number;
export function checkedDraftRevision(value:unknown):number;
export function normalizeCollectionEdit(value:unknown):{
 name:string;description:string;imageURI:string;nativeAccount:string|null;
 factoryId:string|null;expectedRevision:number;
};
export function normalizeUniqItemEdit(value:unknown):{
 collectionId:string;name:string;description:string;imageURI:string;
 editionLimit:number;expectedRevision:number;
};
export function checksumBytes(value:string):string;
export function buildCreatorExport(collection:unknown,items:unknown):{
 json:string;sha256:string;itemCount:number;totalPlannedEditions:string;
};
