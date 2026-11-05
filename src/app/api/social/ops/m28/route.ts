import {type NextRequest,NextResponse} from "next/server";
import {getAddress,isAddress} from "viem";
import {requireViewer} from "../../../../../lib/social/auth";
import {query} from "../../../../../lib/social/db";
import {failure} from "../../../../../lib/social/http";
import {assertModerator} from "../../../../../lib/social/m18";
import {GET as m27ReadOnly} from "../m27/route";
import {inspectEvmCoin,inspectNativeUniq} from "../../../../../lib/beta/acceptance";
import {positiveId,validateNativeAccount,ULTRA_NATIVE_TESTNET} from "../../../../../lib/ultra-native";
import {inspectProviderRows,finalM28Decision,type ApprovedMediaRow} from "../../../../../lib/beta/m28-real-evidence";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const headers={"cache-control":"private, no-store"};
type MediaRow=ApprovedMediaRow;
const nonZeroHash=(s:string)=>/^0x[0-9a-f]{64}$/i.test(s)&&!/^0x0{64}$/i.test(s);
async function inspectAssets(req:NextRequest){
 const p=req.nextUrl.searchParams;
 const tokenFactory=p.get("tokenFactory"),coinTx=p.get("coinTx");
 const uniqFactory=p.get("uniqFactoryId"),uniqOwner=p.get("uniqOwner"),uniqToken=p.get("uniqTokenId");
 const suppliedToken=tokenFactory!==null||coinTx!==null;
 const suppliedUniq=uniqFactory!==null||uniqOwner!==null||uniqToken!==null;
 const token:{status:string;reason:string;txHash?:string;confirmations?:number;coin?:string}={
  status:"not_checked",reason:"A real Ultra EVM creator coin factory and transaction hash were not supplied."};
 const uniq:{status:string;reason:string;irreversibleBlock?:number;tokenId?:string;factoryId?:string}={
  status:"not_checked",reason:"A real native Uniq factory, token ID and current owner were not supplied."};
 if(suppliedToken){
  if(!tokenFactory||!isAddress(tokenFactory)||/^0x0{40}$/i.test(tokenFactory)||
    !coinTx||!nonZeroHash(coinTx)){
   token.status="blocked";token.reason="Invalid or incomplete canonical creator coin proof input.";
  }else{
   try{
    const result=await inspectEvmCoin(getAddress(tokenFactory),coinTx);
    if(result.chainId!==18881||result.confirmations<2||
       result.txHash.toLowerCase()!==coinTx.toLowerCase())throw Error("not independently finalized");
    Object.assign(token,{status:"verified",reason:"Actual canonical Ultra EVM Testnet receipt and current deployed coin state independently read.",
     txHash:result.txHash,confirmations:result.confirmations,coin:result.coin});
   }catch{token.status="blocked";token.reason="Actual canonical transaction receipt or verified contract state not available.";}
  }
 }
 if(suppliedUniq){
  try{
   const factoryId=positiveId(uniqFactory??""),tokenId=positiveId(uniqToken??"");
   const owner=validateNativeAccount(uniqOwner??"");
   const result=await inspectNativeUniq(factoryId,owner,tokenId);
   if(result.chainId!==ULTRA_NATIVE_TESTNET.chainId||result.irreversibleBlock<1||
      result.factoryId!==factoryId||result.tokenId!==tokenId||result.owner!==owner)
    throw Error("Invalid irreversible owner proof");
   Object.assign(uniq,{status:"verified",reason:"Actual native Ultra Testnet irreversible owner and factory proof independently read.",
    irreversibleBlock:result.irreversibleBlock,tokenId,factoryId});
  }catch{uniq.status="blocked";uniq.reason="Actual irreversible native ownership and factory proof not independently confirmed.";}
 }
 return {token,uniq,bothIndependentlyVerified:token.status==="verified"&&uniq.status==="verified",
  transactionBroadcasts:0};
}
export async function GET(req:NextRequest){
 try{
  const operator=(await requireViewer(req)).address;assertModerator(operator);
  const prior=await m27ReadOnly(req);
  if(!prior.ok)return prior;
  const prev=await prior.json() as {
   previewSha:string|null;releaseDecision:"NO_GO";
   walletAcceptance:{active_wallet_keys:number;accepted_nonce_records:number};
   moderatedMedia:{moderatorApprovedPostReceipts:number;pendingMedia:number};
   pointsFullSourceReconciliation:{complete:boolean;issues:unknown[];scanned:number;totalApproved:number}|null;
   pointsScanBlocker:string|null;
   dualRole:{realSignedReferenceRows:number;qualifiedTwoRoleReviewIds:string[]};
   recovery:{requiredTables:number};externalAudit:{signedReferences:number};
   incidentRehearsal:{realRecordedIncidents:number};
  };
  const live=req.nextUrl.searchParams.get("inspectProvider")==="true";
  let media:{status:string;inspected:number;verified:number;reason:string;
    independentHumanModeratorAccepted:boolean;results?:unknown}={
      status:"not_checked",inspected:0,verified:0,
      reason:"Live authenticated Cloudinary comparison not requested; no provider proof inferred.",
      independentHumanModeratorAccepted:false};
  let mediaSourceCount=0;
  if(live){
   const rows=await query<MediaRow>(`SELECT p.id::text AS post_id,u.owner,u.public_id,
    u.kind,u.mime,u.declared_bytes,p.media_url,
    (SELECT count(*)::integer FROM social_moderation_audit a
      WHERE a.target_id=p.id::text AND a.action='approve_media') AS moderation_count
    FROM social_media_uploads u
    JOIN social_posts p ON p.id=u.post_id AND p.author=u.owner
    WHERE u.state='attached' AND p.media_status='approved'
      AND p.hidden=false AND p.deleted_at IS NULL
      AND u.verified_url=p.media_url
    ORDER BY u.attached_at DESC,u.id DESC LIMIT 3`);
   mediaSourceCount=rows.rowCount??rows.rows.length;
   try{media=await inspectProviderRows(rows.rows);}
   catch{media={status:"blocked",inspected:0,verified:0,
    reason:"Authenticated provider credentials or independent inspection unavailable.",
    independentHumanModeratorAccepted:false};}
  }
  const chain=await inspectAssets(req);
  const points=prev.pointsFullSourceReconciliation;
  const gate=finalM28Decision({
   walletProofs:prev.walletAcceptance.active_wallet_keys,
   providerVerified:media.status==="verified",
   chainToken:chain.token.status==="verified",chainUniq:chain.uniq.status==="verified",
   pointsComplete:points?.complete??false,pointsDrift:points?.issues.length??0,
   restore19Matched:false,realHumanApproval:false,securityAuditorContentsVerified:false,
   rollbackWitnessVerified:false,
  });
  return NextResponse.json({
   milestone:"M28",operatorAuthorized:true,readOnly:true,
   immutablePreviewCommit:prev.previewSha,gate,
   wallets:{distinctKeysWithConsumedNonce:prev.walletAcceptance.active_wallet_keys,
    authenticConsumedProofRecords:prev.walletAcceptance.accepted_nonce_records,
    independentlyVerifiedTwoHumanWitnesses:false,
    operatorProofCLI:"npm run m28:verify-wallet-evidence -- --file /safe/path/witness.json"},
   liveMedia:{requested:live,actualApprovedSourceRows:mediaSourceCount,...media},
   chain,points:{...points,blockedReason:prev.pointsScanBlocker,
    independentAntiSybilReviewerCleared:false},
   dualRole:{...prev.dualRole,actualHumanApprovalVerified:false},
   recovery:{fullTables:19,sourceAndSeparatelyRestoredTLSVerifiedByThisRequest:false,
    independentRestoreHumanWitness:false,
    operatorCLI:"npm run m27:full-restore-audit"},
   audit:{signedReferenceCount:prev.externalAudit.signedReferences,
    actualFileDigestVerifiedByThisRequest:false,realAuditFindingsAndRemediationsInspected:false,
    operatorCLI:"npm run m24:verify-evidence"},
   incident:{actualJournalEntries:prev.incidentRehearsal.realRecordedIncidents,
    independentlyWitnessedRollback:false,productionPromotionAllowed:false},
   productionDeploymentAltered:false,publicBetaOpen:false,
   transactionsSent:0,tokenClaimsSent:0,
   note:"All live provider/chain checks are read-only. Independent actual human witnessing, security approval, backup restoration and production launch remain external, unverified conditions.",
  },{headers});
 }catch(e){return failure(e);}
}
