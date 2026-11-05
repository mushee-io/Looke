import {type NextRequest,NextResponse} from "next/server";
import {HttpError,requireViewer,verifyRequestOrigin} from "../../../../../../lib/social/auth";
import {failure,readJson} from "../../../../../../lib/social/http";
import {assertModerator} from "../../../../../../lib/social/m18";
import {verifyWitness} from "../../../../../../lib/beta/m22-witness";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Stateless cryptographic verification only. Does not issue sessions,
 * consume a challenge, approve beta, or broadcast a transaction.
 */
export async function POST(req:NextRequest){
 try{
  verifyRequestOrigin(req);
  const reviewer=(await requireViewer(req)).address;assertModerator(reviewer);
  const origin=process.env.LOOKE_M22_PREVIEW_ORIGIN;
  const revision=process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M22_ACCEPTANCE_SHA;
  if(!origin||!revision)throw new HttpError(503,
   "Expected immutable Preview origin and commit must be explicitly configured.");
  const body=await readJson(req);
  const result=await verifyWitness(body,{expectedOrigin:origin,expectedRevision:revision});
  return NextResponse.json({readOnly:true,...result},
   {status:result.status==="cryptographic-proof-only"?200:422,
    headers:{"cache-control":"private, no-store"}});
 }catch(e){return failure(e);}
}
