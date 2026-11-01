import {NextRequest,NextResponse} from "next/server";
import {database} from "@/lib/server/database";
import {currentProfile,parseJson,validOrigin} from "@/lib/server/session";
import {checkedPayoutEvidenceId,normalizePayoutEvidence,
 MAX_PAYOUT_EVIDENCE_PER_ACCOUNT,MAX_PAYOUT_EVIDENCE_PER_DAY} from "@/lib/creator-earnings.mjs";

export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store"};
export async function GET(){
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers:HEADERS});
  const sql=database();
  const evidence=await sql`
    SELECT id,native_account AS "nativeAccount",tx_id AS "txId",
      factory_id AS "factoryId",evidence_kind AS "kind",
      verification_status AS "status",created_at AS "submittedAt"
    FROM looke_creator_payout_evidence
    WHERE profile_id=${me.id}::uuid
    ORDER BY created_at DESC,id DESC
    LIMIT ${MAX_PAYOUT_EVIDENCE_PER_ACCOUNT}
  `;
  return NextResponse.json({evidence,
   creditedEarningsRawUos:null,realizedEarningsVerified:false,
   nativeWalletOwnershipVerified:false,payoutsEnabled:false,
   warning:"These are unverified creator-submitted transaction references. No amount is credited, confirmed paid, or withdrawable."},
   {headers:HEADERS});
 }catch{return NextResponse.json({error:"Payout evidence service unavailable"},{status:503,headers:HEADERS});}
}
export async function POST(request:Request){
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers:HEADERS});
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers:HEADERS});
  let input:{nativeAccount:string;txId:string;kind:string;factoryId:string|null};
  try{input=normalizePayoutEvidence(await parseJson(request));}
  catch(e){return NextResponse.json({
   error:e instanceof Error?e.message:"Invalid transaction evidence"
  },{status:400,headers:HEADERS});}
  const sql=database();
  const result=await sql.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(hashtext(${me.id}::text||':creator-payout-evidence'))`;
    const counts=await tx`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE created_at>=now()-interval '24 hours')::int AS today
      FROM looke_creator_payout_evidence WHERE profile_id=${me.id}::uuid`;
    if(Number(counts[0]?.total??0)>=MAX_PAYOUT_EVIDENCE_PER_ACCOUNT ||
       Number(counts[0]?.today??0)>=MAX_PAYOUT_EVIDENCE_PER_DAY)
      return {status:"rate_limited"} as const;
    const saved=await tx`INSERT INTO looke_creator_payout_evidence(
      profile_id,native_account,tx_id,factory_id,evidence_kind
    ) VALUES(${me.id}::uuid,${input.nativeAccount},${input.txId},
      ${input.factoryId},${input.kind})
      ON CONFLICT(profile_id,tx_id) DO NOTHING
      RETURNING id,verification_status`;
    return saved.length?{status:"submitted",id:saved[0].id} as const:
      {status:"duplicate"} as const;
  });
  if(result.status==="rate_limited")return NextResponse.json({
   error:"Evidence submission limit reached (5 in 24 hours; 30 total per creator)"
  },{status:429,headers:HEADERS});
  if(result.status==="duplicate")return NextResponse.json({
   error:"That transaction reference is already in your private evidence queue"
  },{status:409,headers:HEADERS});
  return NextResponse.json({id:result.id,status:"unverified",credited:false,
   payoutInitiated:false,transactionChecked:false,
   note:"This is a reference for independent future reconciliation, not verified earnings."
  },{status:201,headers:HEADERS});
 }catch{
  return NextResponse.json({error:"Unable to save unverified receipt reference"},{status:503,headers:HEADERS});
 }
}
export async function DELETE(request:NextRequest){
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers:HEADERS});
 let id:string;
 try{id=checkedPayoutEvidenceId(request.nextUrl.searchParams.get("id"));}
 catch{return NextResponse.json({error:"Invalid evidence ID"},{status:400,headers:HEADERS});}
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers:HEADERS});
  const sql=database();
  const deleted=await sql`DELETE FROM looke_creator_payout_evidence
   WHERE id=${id}::uuid AND profile_id=${me.id}::uuid
     AND verification_status='unverified'
   RETURNING id`;
  if(!deleted.length)return NextResponse.json({error:"Evidence entry unavailable"},{status:404,headers:HEADERS});
  return NextResponse.json({deleted:true,onchainTransactionChanged:false},
   {headers:HEADERS});
 }catch{
  return NextResponse.json({error:"Unable to remove private evidence entry"},{status:503,headers:HEADERS});
 }
}
