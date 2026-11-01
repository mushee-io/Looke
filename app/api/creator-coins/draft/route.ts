import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
import { normalizeCreatorCoinDraft } from "@/lib/creator-coin.mjs";

export const dynamic="force-dynamic";
const cacheHeaders={"Cache-Control":"private, no-store"};

/** One draft per signed-in, named Looke creator. Not evidence of any minted token. */
export async function GET() {
 try {
  const owner=await currentProfile();
  if(!owner)return NextResponse.json({error:"Sign in to manage your creator coin draft"},{status:401,headers:cacheHeaders});
  const sql=database();
  const rows=await sql`
    SELECT name,symbol,supply_tokens::text AS supply_tokens,metadata_uri,updated_at
    FROM looke_creator_coin_drafts WHERE profile_id=${owner.id}::uuid LIMIT 1
  `;
  return NextResponse.json({
    creator:{handle:owner.handle,address:owner.evm_address},
    draft:rows[0]??null,issuanceEnabled:false,
  },{headers:cacheHeaders});
 }catch {
  return NextResponse.json({error:"Creator coin drafts unavailable"},{status:503,headers:cacheHeaders});
 }
}

/** Stores a reviewed, non-executable creator coin specification. */
export async function PUT(request:Request) {
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers:cacheHeaders});
 try {
  const owner=await currentProfile();
  if(!owner)return NextResponse.json({error:"Sign in required"},{status:401,headers:cacheHeaders});
  if(typeof owner.handle!=="string" || !owner.handle)
    return NextResponse.json({error:"Save a public Looke creator handle first"},{status:409,headers:cacheHeaders});
  const input=await parseJson(request);
  let draft:{name:string;symbol:string;supplyTokens:number;metadataURI:string};
  try{draft=normalizeCreatorCoinDraft(input);}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid creator coin draft"},{status:400,headers:cacheHeaders});}
  const sql=database();
  const rows=await sql`
    INSERT INTO looke_creator_coin_drafts(profile_id,name,symbol,supply_tokens,metadata_uri)
    VALUES(${owner.id}::uuid,${draft.name},${draft.symbol},${draft.supplyTokens},${draft.metadataURI})
    ON CONFLICT(profile_id) DO UPDATE SET
      name=excluded.name,symbol=excluded.symbol,supply_tokens=excluded.supply_tokens,
      metadata_uri=excluded.metadata_uri,updated_at=now()
    RETURNING name,symbol,supply_tokens::text AS supply_tokens,metadata_uri,updated_at
  `;
  return NextResponse.json({draft:rows[0],saved:true,issuanceEnabled:false},{headers:cacheHeaders});
 }catch {
  return NextResponse.json({error:"Creator coin draft could not be saved"},{status:503,headers:cacheHeaders});
 }
}

/** Delete a social draft only — does not affect a deployed blockchain token. */
export async function DELETE(request:Request) {
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers:cacheHeaders});
 try {
  const owner=await currentProfile();
  if(!owner)return NextResponse.json({error:"Sign in required"},{status:401,headers:cacheHeaders});
  const sql=database();
  await sql`DELETE FROM looke_creator_coin_drafts WHERE profile_id=${owner.id}::uuid`;
  return NextResponse.json({deleted:true,issuanceEnabled:false},{headers:cacheHeaders});
 }catch{
  return NextResponse.json({error:"Creator coin draft removal unavailable"},{status:503,headers:cacheHeaders});
 }
}
