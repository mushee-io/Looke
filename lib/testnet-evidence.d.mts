export const TESTNET_EVIDENCE_CHAIN_ID:number;
export const TESTNET_EVIDENCE_DEPTH:number;
export const MAX_RECEIPT_LOGS:number;
export function checkedEvidenceHash(value:unknown):string;
export function checkedEvidenceAddress(value:unknown):string;
export function checkedIndependentRpc(value:unknown,primary:string):string;
export function corroborateTestnetReceipt(primary:unknown,secondary:unknown,args:{
 txHash:string;source:string;eventSelector:string;kind:"factory"|"swaps";expectedFrom?:string|null;
}):{
 chainId:number;txHash:string;source:string;kind:string;transactionSigner:string;
 blockNumber:string;blockHash:string;eventLogIndexes:number[];
 confirmationDepthAtLeast:number;independentRpcsAgreed:true;
 codeMatchAtObservedBlock:true;transactionStatus:string;contentAuthorizationVerified:false;
 marketOriginAudited:false;userWalletConsentProved:false;safeForMainnet:false;warning:string;
};
export function acceptanceGate(value?:{
 stagingDeployed?:boolean;independentSecurityAudit?:boolean;
 creatorAuthorizationFixed?:boolean;nativeWalletIdentityTested?:boolean;
 realTradingReceiptsReviewed?:boolean;incidentRunbookApproved?:boolean;
}):{
 approved:false;mainnetReady:false;tradingEnabled:false;
 pending:string[];reason:string;
};
