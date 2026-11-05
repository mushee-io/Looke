import {type NextRequest,NextResponse} from "next/server";
import {isAddress,getAddress} from "viem";
import {requireViewer,HttpError} from "../../../../../lib/social/auth";
import {query} from "../../../../../lib/social/db";
import {failure} from "../../../../../lib/social/http";
import {assertModerator} from "../../../../../lib/social/m18";
import {GET as m21ReadOnly} from "../acceptance/route";
import {deriveM22Readiness} from "../../../../../lib/beta/m22-readiness";
import {inspectEvmCoin,inspectNativeUniq} from "../../../../../lib/beta/acceptance";
import {positiveId,validateNativeAccount,ULTRA_NATIVE_TESTNET} from "../../../../../lib/ultra-native";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const headers={"cache-control":"private, no-store"};
type Creator={address:string;handle:string;created_at:Date;visible_posts:number};
type VisiblePost={id:string;author:string;handle:string;created_at:Date;
 media_status:string;asset_type:string|null;asset_chain:string|null;asset_id:string|null};
type Recovery={revision:string;cursor_at:Date;updated_at:Date;rewinds:number;scans:number};
const zeroHash=/^0x0{64}$/i;
async function verifyAssetReference(req:NextRequest){
 const params=req.nextUrl.searchParams;
 if(!params.has("assetKind"))return null;
 const kind=params.get("assetKind");
 if(kind==="token"){
  const factory=params.get("factory")??"",tx=params.get("tx")??"";
  if(!isAddress(factory)||/^0x0{40}$/i.test(factory)||!/^0x[a-f0-9]{64}$/i.test(tx)||zeroHash.test(tx))
   throw new HttpError(400,"Supply a real Testnet factory address and nonzero CoinCreated transaction hash.");
  try{
   const receipt=await inspectEvmCoin(getAddress(factory),tx);
   if(receipt.chainId!==18881||receipt.confirmations<2||
      receipt.txHash.toLowerCase()!==tx.toLowerCase())
    throw Error("Not independently finalized.");
   return {kind:"creator_token",status:"verified",network:"Ultra EVM Testnet",
     source:receipt.txHash,creator:receipt.creator,coin:receipt.coin,
     confirmations:receipt.confirmations,transactionsSent:0,
     note:"Actual Ultra EVM receipt and current token state independently read. No mint was initiated."};
  }catch{return {kind:"creator_token",status:"blocked",source:null,
    note:"No independently verified creator receipt or deployed token evidence.",transactionsSent:0};}
 }
 if(kind==="uniq"){
  const factoryId=params.get("factoryId")??"";
  const tokenId=params.get("tokenId")??"";
  const owner=params.get("nativeOwner")??"";
  let parsed:{factoryId:string;tokenId:string;owner:string};
  try{parsed={factoryId:positiveId(factoryId),tokenId:positiveId(tokenId),
    owner:validateNativeAccount(owner)};}
  catch{throw new HttpError(400,"A real native Ultra account, factory ID and Uniq ID are required.");}
  try{
   const proof=await inspectNativeUniq(parsed.factoryId,parsed.owner,parsed.tokenId);
   if(proof.chainId!==ULTRA_NATIVE_TESTNET.chainId || proof.irreversibleBlock<=0||
      proof.owner!==parsed.owner||proof.factoryId!==parsed.factoryId||
      proof.tokenId!==parsed.tokenId)throw Error("Mismatch in owner/finality.");
   return {kind:"native_uniq",status:"verified",source:String(proof.irreversibleBlock),
     owner:proof.owner,tokenId:proof.tokenId,factoryId:proof.factoryId,
     network:"Ultra native Testnet",transactionsSent:0,
     note:"Actual current owner-scoped native Uniq record independently verified. No NFT mint was initiated."};
  }catch{return {kind:"native_uniq",status:"blocked",source:null,
    note:"No independent native Uniq owner/factory proof confirmed.",transactionsSent:0};}
 }
 throw new HttpError(400,"Asset proof kind must be token or uniq.");
}

/** Moderator-only read-only protected beta preparation.
 * No endpoint creates an operator release approval or changes flags.
 */
export async function GET(req:NextRequest){
 try{
  const reviewer=(await requireViewer(req)).address;assertModerator(reviewer);
  const m21Response=await m21ReadOnly(req);
  if(!m21Response.ok)return m21Response;
  const acceptance=await m21Response.json() as {
   flagsClosed:boolean;report:import("../../../../../lib/ops/m21-acceptance").M21Report;
   reconciliation:{totalApproved:number;scanned:number;complete:boolean;issues:unknown[]};
   operational:{pending_media:number;unreviewed_reports:number;index_events:number};
  };
  const [creators,posts,recovery]=await Promise.all([
   query<Creator>(`
    SELECT p.address,p.handle,p.created_at,
      (SELECT count(*)::integer FROM social_posts s
       WHERE s.author=p.address AND s.hidden=false AND s.deleted_at IS NULL
         AND (s.media_url IS NULL OR s.media_status='approved')) AS visible_posts
    FROM social_profiles p WHERE p.suspended=false
    ORDER BY p.created_at DESC,p.address DESC LIMIT 12`),
   query<VisiblePost>(`
    SELECT p.id,p.author,c.handle,p.created_at,p.media_status,
      p.asset_type,p.asset_chain,p.asset_id
    FROM social_posts p JOIN social_profiles c ON c.address=p.author
    WHERE p.hidden=false AND p.deleted_at IS NULL AND c.suspended=false
      AND (p.media_url IS NULL OR p.media_status='approved')
    ORDER BY p.created_at DESC,p.id DESC LIMIT 12`),
   query<Recovery>(`
    SELECT cp.revision,cp.cursor_at,cp.updated_at,
      (SELECT count(*)::integer FROM social_index_runs WHERE action='rewind') AS rewinds,
      (SELECT count(*)::integer FROM social_index_runs WHERE action='scan') AS scans
    FROM social_index_checkpoints cp WHERE cp.stream='creator_activity'`),
  ]);
  // Attaching a token address/Uniq ID to a social post never verifies ownership:
  // separately look up the original confirmed on-chain receipt/owner state.
  const proof=await verifyAssetReference(req);
  const readiness=deriveM22Readiness({m21:acceptance.report,flagsClosed:acceptance.flagsClosed});
  return NextResponse.json({
   reviewerAuthorized:true,readOnly:true,source:"real-postgres-plus-independent-testnet-proof",
   milestone:"M22",readiness,
   realCreatorProfiles:creators.rows,
   visibleModeratedPosts:posts.rows.map(p=>({
    ...p,assetAttachmentVerified:false,
    note:p.asset_id?"The post contains an unverified asset reference until independently checked.":undefined,
   })),
   moderation:{pendingMedia:acceptance.operational.pending_media,
     unresolvedReports:acceptance.operational.unreviewed_reports},
   points:{reviewed:acceptance.reconciliation.totalApproved,
     checked:acceptance.reconciliation.scanned,
     complete:acceptance.reconciliation.complete,
     mismatches:acceptance.reconciliation.issues.length,
     claimsEnabled:false,pointsWriteEnabled:false},
   recovery:{checkpoint:recovery.rows[0]??null,
     independentRestoreWitness:false,
     note:"Previous rewinds/scans are audit history, not independent proof of restoring an actual backup."},
   independentAssetProof:proof,
   witness:{signatureCheckAvailable:true,noncePersistenceEnabled:false,
     liveWalletSessionAccepted:false,
     note:"Signature verification proves key control only; no one-time nonce consumption or independent human witness is recorded."},
   testFundingGuidance:[
    "Select Ultra EVM Testnet (chain ID 18881) in a compatible wallet. Ultra native Testnet is a different account model.",
    "Locate the current official Ultra Testnet documentation and its documented faucet or test-token distribution path; verify source authenticity before requesting funds.",
    "Use two separately controlled wallets; obtain only Testnet gas and nonvaluable test assets. Never share seed phrases, private keys or recovery codes.",
    "Inspect chain ID, faucet receipt and balance on official explorers or independently configured read-only RPC before attempting test actions.",
    "Financial trading, token issuance, NFT mint, reward claims and public posting remain disabled in this Preview; funds do not activate them.",
    "Record wallet-approved actions and actual receipt hashes separately during an operator-authorized acceptance session. No transactions are initiated by this dashboard.",
   ],
   betaActivated:false,transactionsSent:0,
  },{headers});
 }catch(e){return failure(e);}
}
