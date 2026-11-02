export const ATTESTATION_CHAIN_ID:18881;
export const ATTESTATION_CONFIRMATIONS:bigint;
export const ATTESTATION_TTL_SECONDS:bigint;
export const AUTH_TYPES:{readonly CoinAuthorization:readonly {name:string;type:string}[]};
export function reviewedContentSource(row:Record<string,unknown>):{
 postId:string;creator:`0x${string}`;kind:1;contentRef:`0x${string}`;
 sourceTextHash:`0x${string}`;name:string;symbol:string;
 initialSupplyTokens:bigint;metadataURI:string;
};
export function verifiedFactoryObservations(first:Record<string,unknown>,
 second:Record<string,unknown>,
 configuration:{factory:string;attestor:string;codeHash:string}):{
 factory:`0x${string}`;attestor:`0x${string}`;codeHash:string;
 nonce:bigint;blockHash:string;observedAt:bigint;
};
export function unsignedContentPermit(source:Record<string,unknown>,
 observed:Record<string,unknown>):{
 typedData:Record<string,unknown>;digest:string;constructorAttestor:string;
 factoryCodeHash:string;observedBlockHash:string;sourcePostId:string;
 manualApprovalRequired:true;signed:false;releaseApproved:false;
 issuanceEnabled:false;warning:string;
};