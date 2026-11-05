/** M32 protected Preview-only read-only dual-source compatibility check.
 * Never migrates data, reuses legacy sessions or exposes connection details.
 */
import {NextResponse} from "next/server";
import {Pool} from "pg";
import {compareM32Sources,inspectM32RealSource,requireDistinctM32Sources} from "../../../../lib/beta/m32-reconciliation";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=20;
const headers={"cache-control":"private, no-store"};
export async function GET(){
 if(process.env.VERCEL_ENV!=="preview")
  return NextResponse.json({error:"Only protected branch Preview can inspect M32 sources."},{status:404,headers});
 const legacy=process.env.LOOKE_M32_LEGACY_DATABASE_URL;
 const current=process.env.DATABASE_URL;
 if(!legacy||!current){
  return NextResponse.json({
   ...compareM32Sources(null,null),sourceStatus:"missing_authorized_dual_source",
   legacyConfigured:!!legacy,currentConfigured:!!current,
   originalSourcesQueried:false,transactionsSent:0,personalRecordsRead:0,
   note:"The connected legacy Neon project is not automatically authorized as this Preview's source. Configure separate read-only TLS connections only after human source review."
  },{headers});
 }
 const pools:Pool[]=[];
 try{
  requireDistinctM32Sources(legacy,current);
  const l=new Pool({connectionString:legacy,max:1,connectionTimeoutMillis:5000,statement_timeout:7000});
  pools.push(l);
  const c=new Pool({connectionString:current,max:1,connectionTimeoutMillis:5000,statement_timeout:7000});
  pools.push(c);
  const legacySource=await l.connect();
  let legacyReport;
  try{legacyReport=await inspectM32RealSource(legacySource,true);}finally{legacySource.release();}
  const currentSource=await c.connect();
  let currentReport;
  try{currentReport=await inspectM32RealSource(currentSource,true);}finally{currentSource.release();}
  return NextResponse.json({
   ...compareM32Sources(legacyReport,currentReport),
   sourceStatus:"genuine_read_only_tls_observed",
   legacy:legacyReport,current:currentReport,
   originalSourcesQueried:true,transactionsSent:0,personalRecordsRead:0,
   separateIndependentRestoreVerified:false,realHumanApprovalsVerified:false,
   note:"Authenticated TLS schema and aggregate observations ONLY, not database migration permission, human consent, original hosted-media proof or asset ownership."
  },{headers});
 }catch{
  return NextResponse.json({
   ...compareM32Sources(null,null),sourceStatus:"source_separation_tls_or_query_blocked",
   legacyConfigured:true,currentConfigured:true,originalSourcesQueried:false,
   exposedCredentials:false,transactionsSent:0,personalRecordsRead:0,
   note:"Connection, distinct-source, TLS or read-only inspection blocked. Error and source identity are deliberately redacted."
  },{headers});
 }finally{await Promise.allSettled(pools.map(p=>p.end()));}
}
