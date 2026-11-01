export const MAX_PAYOUT_EVIDENCE_PER_ACCOUNT:number;
export const MAX_PAYOUT_EVIDENCE_PER_DAY:number;
export function parseUosAmount(value:unknown):bigint;
export function normalizedShares(value:unknown,max?:number):Array<{receiver:string;basisPoint:number}>;
export function estimateNativeResaleDistribution(args:{
 price:string;seller:string;factoryShares:unknown;globalShares:unknown;
 promoterBasisPoints:number;promoterRecipient:string|null;
 promoterPaymentsEnabled:boolean;
}):{
 listedPrice:string;totalRawUos:string;allocationBasisPoints:number;
 allocations:Array<{kind:string;receiver:string;basisPoint:number;rawUos:string}>;
 scenario:string;actualSaleVerified:false;earningsCredited:false;
 payoutReceiptsVerified:false;warning:string;
};
export function checkedNativeTransactionId(value:unknown):string;
export function checkedPayoutEvidenceId(value:unknown):string;
export function normalizePayoutEvidence(value:unknown):{
 nativeAccount:string;txId:string;kind:"resale_royalty"|"resale_seller_proceeds"|"other_creator_transfer";
 factoryId:string|null;
};
