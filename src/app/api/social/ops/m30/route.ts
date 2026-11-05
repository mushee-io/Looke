/** M30 moderator-owned source status. Calls the real, authenticated M29
 * source route and never transitions from NO_GO or creates evidence.
 */
import {type NextRequest,NextResponse} from "next/server";
import {requireViewer} from "../../../../../lib/social/auth";
import {assertModerator} from "../../../../../lib/social/m18";
import {failure} from "../../../../../lib/social/http";
import {GET as readM29} from "../m29/route";
import {m30AcceptanceReport,type M30Observation} from "../../../../../lib/beta/m30-operator-readiness";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
export async function GET(req:NextRequest){
 try{
  const user=(await requireViewer(req)).address;assertModerator(user);
  const prior=await readM29(req);
  if(!prior.ok)return prior;
  const observed=await prior.json() as {
   realTechnicalObservations:{
    distinctAcceptedKeyCount:number;recordsWithMissingOrInvalidConsumption:number;
    matchingAuthenticatedCloudinaryAssets:number;currentCanonicalEvmReceiptVerified:boolean;
    currentIrreversibleNativeUniqVerified:boolean;sourcePointsScanComplete:boolean;
    sourcePointsDiscrepancies:number;twoDistinctSignedReviewRoles:boolean;
   };
   sourceReviewResult:{liveMedia:{requested:boolean;status:string};chain:{
    bothIndependentlyVerified:boolean}};
  };
  const stat=observed.realTechnicalObservations;
  const inspect=req.nextUrl.searchParams.get("inspectProvider")==="true";
  const source:M30Observation={
   wallet_sessions:{observed:true,sourceVerified:stat.distinctAcceptedKeyCount>=2&&
    stat.recordsWithMissingOrInvalidConsumption===0,
    reason:"Existing original consumed key-control records; independent human attendance unverified."},
   hosted_media:{observed:inspect,sourceVerified:inspect&&stat.matchingAuthenticatedCloudinaryAssets>0,
    reason:inspect?"Actual hosted provider and moderator source checked. Content-safety approval is external.":"Authenticated live provider inspection not requested."},
   creator_coin:{observed:true,sourceVerified:stat.currentCanonicalEvmReceiptVerified,
    reason:"Actual canonical Ultra EVM Testnet CoinCreated proof needed."},
   native_uniq:{observed:true,sourceVerified:stat.currentIrreversibleNativeUniqVerified,
    reason:"Actual native Ultra irreversible owner proof needed."},
   points_anti_sybil:{observed:true,sourceVerified:stat.sourcePointsScanComplete&&
    stat.sourcePointsDiscrepancies===0,
    reason:"Approved Points source check is not independent sybil clearance."},
  };
  const report=m30AcceptanceReport(process.env,source);
  return NextResponse.json({...report,
   moderatorAuthenticated:true,immutableCommit:process.env.VERCEL_GIT_COMMIT_SHA||
    process.env.LOOKE_M23_PREVIEW_SHA||null,
   actualReadOnlySourceExamined:true,readOnly:true,financialBroadcasts:0,
   externalHumanSecurityAndOperatorApproval:false,
   originalExternalAuditFindingsApproved:false,
   realBackupRestoredByThisAPI:false,
   evidence:observed.realTechnicalObservations},{
    headers:{"cache-control":"private, no-store"}});
 }catch(e){return failure(e);}
}
