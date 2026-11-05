/** Genuine Preview-only database schema inspection, unlike credential-presence
 * checks. Only known table/column names and aggregate compatibility statuses
 * leave the server. Never return connection strings or actual user records.
 */
import {NextResponse} from "next/server";
import {Pool} from "pg";
import {inspectM31Schema} from "../../../../lib/beta/m31-source-compatibility";
import {m30ConfigPreflight} from "../../../../lib/beta/m30-operator-readiness";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=15;
const headers={"cache-control":"private, no-store"};
export async function GET(){
 if(process.env.VERCEL_ENV==="production")
  return NextResponse.json({error:"Production operator diagnostics disabled."},
   {status:404,headers});
 const config=m30ConfigPreflight(process.env);
 const url=process.env.DATABASE_URL;
 if(!url){
  return NextResponse.json({milestone:"M31",sourceStatus:"not_connected",
   schemaCompatible:false,missingCurrentDatabaseConnection:true,
   availableConfigKeysOnly:config.credentialPresence,
   releaseFlagsClosed:config.releaseFlagsClosed,
   externalCloudinaryLookupPerformedByThisEndpoint:false,
   separateTLSRestoreVerified:false,
   userSessionsRead:0,providerAssetsRead:0,transactionsSent:0,
   releaseDecision:"NO_GO",publicBetaOpen:false,
   note:"No DATABASE_URL is configured on this Vercel Preview. A separate connected Neon project is not automatically this deployment's database or a valid social_* source."},
   {headers});
 }
 const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:5000,statement_timeout:7000});
 try{
  const c=await pool.connect();
  try{
   const s=await inspectM31Schema(c,true);
   return NextResponse.json({...s,sourceStatus:s.status,
    configuredReadOnlyPostgresConnection:true,
    availableConfigKeysOnly:config.credentialPresence,
    releaseFlagsClosed:config.releaseFlagsClosed,
    realRowsInspected:false,externalCloudinaryLookupPerformedByThisEndpoint:false,
    separateTLSRestoreVerified:false,
    userSessionsRead:0,providerAssetsRead:0,transactionsSent:0,
    releaseDecision:"NO_GO",publicBetaOpen:false}, {headers});
  }finally{c.release();}
 }catch{
  return NextResponse.json({milestone:"M31",sourceStatus:"connection_or_tls_blocked",
   schemaCompatible:false,configuredReadOnlyPostgresConnection:true,
   exposedConnectionErrors:false,realRowsInspected:false,
   separateTLSRestoreVerified:false,transactionsSent:0,
   releaseDecision:"NO_GO",publicBetaOpen:false,
   note:"Could not establish an authenticated actual TLS PostgreSQL read-only metadata inspection. Raw connection errors and credentials are not disclosed."},
   {headers});
 }finally{await pool.end();}
}
