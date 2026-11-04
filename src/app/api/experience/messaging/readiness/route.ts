import {NextResponse} from "next/server";
import {DM_SECURITY_GATES} from "../../../../../lib/experience/dm-envelope";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** No plaintext messaging endpoint is enabled; readiness requires audit evidence. */
export function GET(){
 return NextResponse.json({
   milestone:"M15",mode:"foundation-only",transport:"disabled",
   ...DM_SECURITY_GATES,
   disclaimer:"Storage tables and a schema do not constitute audited end-to-end encryption.",
   messagesSent:0,
 },{headers:{"cache-control":"no-store"}});
}
