/** Configuration-only M30 status; no secret values, user records or tokens.
 * Preview behind Vercel SSO. Never serve readiness metadata on production.
 */
import {NextResponse} from "next/server";
import {m30AcceptanceReport} from "../../../../lib/beta/m30-operator-readiness";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 if(process.env.VERCEL_ENV==="production")
  return NextResponse.json({error:"Operator diagnostics unavailable on production."},
   {status:404,headers:{"cache-control":"no-store"}});
 return NextResponse.json({...m30AcceptanceReport(process.env),
  executedLiveAcceptance:false,independentlyWitnessedRecovery:false,
  sourceResultsRequireAuthenticatedOperator:true,
  operatorCommand:"npm run m30:operator-acceptance -- --live",
  note:"Only credential PRESENCE was checked. No database queried, media fetched, on-chain evidence verified or backup restored."},
  {headers:{"cache-control":"private, no-store"}});
}
