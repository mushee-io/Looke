import {checkedNativeAccount,checkedUniqFactoryId} from "./uniq-creation.mjs";
const UOS=/^(0|[1-9][0-9]{0,13})\.([0-9]{8}) UOS$/;
const MAX_U64=18446744073709551615n;
export const MAX_PAYOUT_EVIDENCE_PER_ACCOUNT=30;
export const MAX_PAYOUT_EVIDENCE_PER_DAY=5;

/** Positive, exactly eight-decimal native UOS asset. No USD/FX conversion. */
export function parseUosAmount(raw){
 if(typeof raw!=="string")throw new RangeError("Invalid UOS amount");
 const hit=UOS.exec(raw);
 if(!hit)throw new RangeError("Require exactly eight-decimal UOS, not an FX estimate");
 const units=BigInt(hit[1])*100000000n+BigInt(hit[2]);
 if(units<1n||units>MAX_U64)throw new RangeError("UOS amount outside native asset limit");
 return units;
}
function bps(raw){
 if(typeof raw!=="number"||!Number.isInteger(raw)||raw<0||raw>10000)
  throw new RangeError("Invalid payout basis points");
 return raw;
}
export function normalizedShares(raw,max=50){
 if(!Array.isArray(raw)||raw.length>max)throw new RangeError("Invalid share beneficiaries");
 return raw.map(entry=>{
  if(!entry||typeof entry!=="object"||Array.isArray(entry))
   throw new RangeError("Malformed resale beneficiary");
  return {receiver:checkedNativeAccount(entry.receiver),basisPoint:bps(entry.basis_point)};
 });
}
export function estimateNativeResaleDistribution({price,seller,factoryShares,globalShares,
 promoterBasisPoints,promoterRecipient,promoterPaymentsEnabled}){
 const units=parseUosAmount(price);
 const owner=checkedNativeAccount(seller);
 const factory=normalizedShares(factoryShares);
 const global=normalizedShares(globalShares,4);
 const promoter=bps(promoterBasisPoints);
 if(typeof promoterPaymentsEnabled!=="boolean")
  throw new RangeError("Promoter payment configuration unavailable");
 const effectivePromoter=promoterPaymentsEnabled?promoter:0;
 if(effectivePromoter>0&&!promoterRecipient)
  throw new RangeError("Promoter recipient unknown; cannot distribute");
 const destination=effectivePromoter?checkedNativeAccount(promoterRecipient):null;
 const totalBps=global.reduce((s,x)=>s+x.basisPoint,0)+
  factory.reduce((s,x)=>s+x.basisPoint,0)+effectivePromoter;
 if(totalBps>10000)throw new RangeError("Resale beneficiary shares exceed sale price");
 const payout=(entry,kind)=>({
  kind,receiver:entry.receiver,basisPoint:entry.basisPoint,
  rawUos:(units*BigInt(entry.basisPoint)/10000n).toString()
 });
 const allocations=[
  ...global.map(x=>payout(x,"protocol")),
  ...factory.map(x=>payout(x,"factory_beneficiary")),
  ...(destination?[payout({receiver:destination,basisPoint:effectivePromoter},"promoter")]:[])
 ];
 const allocated=allocations.reduce((n,x)=>n+BigInt(x.rawUos),0n);
 if(allocated>units)throw new RangeError("Invalid payout rounding");
 const sellerResidual=units-allocated;
 return {
  listedPrice:price,totalRawUos:units.toString(),
  allocationBasisPoints:totalBps,
  allocations:[...allocations,{kind:"seller_residual",receiver:owner,
   basisPoint:10000-totalBps,rawUos:sellerResidual.toString()}],
  scenario:"hypothetical_if_listing_sells_under_current_policy",
  actualSaleVerified:false,earningsCredited:false,
  payoutReceiptsVerified:false,
  warning:"Integer scenario only. No sale, payment, payout ledger credit, exchange rate or independent onchain settlement is established."
 };
}
export function checkedNativeTransactionId(raw){
 if(typeof raw!=="string"||!/^[a-f0-9]{64}$/i.test(raw))
  throw new RangeError("Transaction ID must be a 64-digit native Ultra transaction hash");
 return raw.toLowerCase();
}
export function checkedPayoutEvidenceId(raw){
 if(typeof raw!=="string"||
  !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(raw))
  throw new RangeError("Invalid payout evidence ID");
 return raw.toLowerCase();
}
export function normalizePayoutEvidence(input){
 if(!input||typeof input!=="object"||Array.isArray(input)||
   Object.keys(input).some(key=>!["nativeAccount","txId","kind","factoryId"].includes(key)))
  throw new RangeError("Unexpected payout evidence fields");
 const nativeAccount=checkedNativeAccount(input.nativeAccount);
 const txId=checkedNativeTransactionId(input.txId);
 if(!["resale_royalty","resale_seller_proceeds","other_creator_transfer"].includes(input.kind))
  throw new RangeError("Invalid evidence classification");
 const factoryId=input.factoryId==null||input.factoryId===""?
   null:checkedUniqFactoryId(input.factoryId);
 return {nativeAccount,txId,kind:input.kind,factoryId};
}
