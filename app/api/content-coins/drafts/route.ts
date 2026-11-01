import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
import {
  checkedContentPostId,contentSnapshot,contentSnapshotIsCurrent,
  MAX_CONTENT_DRAFTS,normalizeContentCoinDraft
} from "@/lib/content-coin.mjs";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};

/**
 * Private creator workspace: visible owned posts and proposals only.
 * A saved snapshot is not an onchain attestation or a minted token.
 */
export async function GET() {
 try {
  const owner=await currentProfile();
  if(!owner)return NextResponse.json({error:"Sign in first"},{status:401,headers});
  const sql=database();
  const [posts,rows]=await Promise.all([
   sql`SELECT id,text,created_at,edited_at FROM looke_posts
     WHERE profile_id=${owner.id}::uuid AND moderation_status='visible'
     ORDER BY created_at DESC,id DESC LIMIT 40`,
   sql`SELECT d.post_id,d.name,d.symbol,d.supply_tokens::text AS supply_tokens,
       d.metadata_uri,d.content_ref,d.source_text_hash,d.ref_version,
       d.created_at,d.updated_at,p.text AS post_text,p.moderation_status
     FROM looke_content_coin_drafts d JOIN looke_posts p ON p.id=d.post_id
     WHERE d.profile_id=${owner.id}::uuid
     ORDER BY d.updated_at DESC LIMIT ${MAX_CONTENT_DRAFTS}`,
  ]);
  const drafts=rows.map(row=>{
   const current=row.moderation_status==="visible" &&
     contentSnapshotIsCurrent({textHash:row.source_text_hash,contentRef:row.content_ref},
       row.post_id,owner.evm_address,row.post_text);
   return {
     postId:row.post_id,name:row.name,symbol:row.symbol,
     supplyTokens:row.supply_tokens,metadataURI:row.metadata_uri,
     contentRef:row.content_ref,sourceTextHash:row.source_text_hash,
     refVersion:row.ref_version,createdAt:row.created_at,updatedAt:row.updated_at,
     sourceCurrent:current,
     status:current?"valid_offchain_snapshot":"stale_or_hidden_source",
   };
  });
  return NextResponse.json({
   creator:{handle:owner.handle,address:owner.evm_address},
   posts:posts.map(post=>({id:post.id,text:post.text,createdAt:post.created_at,editedAt:post.edited_at})),
   drafts,issuanceEnabled:false,
  },{headers});
 }catch{
  return NextResponse.json({error:"Content coin drafts unavailable"},{status:503,headers});
 }
}

/**
 * Only the creator of a visible Looke post can bind an offchain proposal to it.
 * Atomic row locks stop an edit from racing the text snapshot captured here.
 */
export async function POST(request:Request) {
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers});
 try {
  const owner=await currentProfile();
  if(!owner)return NextResponse.json({error:"Sign in first"},{status:401,headers});
  if(!owner.handle)return NextResponse.json({error:"Save a public creator handle first"},{status:409,headers});
  const json=await parseJson(request);
  let input:{postId:string;name:string;symbol:string;supplyTokens:number;metadataURI:string};
  try{input=normalizeContentCoinDraft(json);}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid content coin draft"},{status:400,headers});}
  const sql=database();
  const result=await sql.begin(async tx=>{
   await tx`SELECT pg_advisory_xact_lock(hashtext(${owner.id}::text||':content-drafts'))`;
   const posts=await tx`SELECT id,text FROM looke_posts
      WHERE id=${input.postId}::uuid AND profile_id=${owner.id}::uuid
        AND moderation_status='visible' FOR SHARE`;
   if(!posts.length)return {status:"not_owner"} as const;
   const existing=await tx`SELECT 1 FROM looke_content_coin_drafts
     WHERE post_id=${input.postId}::uuid AND profile_id=${owner.id}::uuid`;
   if(!existing.length){
    const count=await tx`SELECT count(*)::int AS count FROM looke_content_coin_drafts
      WHERE profile_id=${owner.id}::uuid`;
    if(Number(count[0]?.count??0)>=MAX_CONTENT_DRAFTS)return {status:"limit"} as const;
   }
   const snapshot=contentSnapshot(input.postId,owner.evm_address,posts[0].text);
   const rows=await tx`INSERT INTO looke_content_coin_drafts(
      post_id,profile_id,creator_address,source_text_hash,content_ref,ref_version,
      name,symbol,supply_tokens,metadata_uri
    ) VALUES (
      ${input.postId}::uuid,${owner.id}::uuid,${snapshot.creatorAddress},
      ${snapshot.textHash},${snapshot.contentRef},${snapshot.version},
      ${input.name},${input.symbol},${input.supplyTokens},${input.metadataURI}
    ) ON CONFLICT(post_id) DO UPDATE SET
      creator_address=excluded.creator_address,source_text_hash=excluded.source_text_hash,
      content_ref=excluded.content_ref,ref_version=excluded.ref_version,
      name=excluded.name,symbol=excluded.symbol,supply_tokens=excluded.supply_tokens,
      metadata_uri=excluded.metadata_uri,updated_at=now()
    WHERE looke_content_coin_drafts.profile_id=${owner.id}::uuid
    RETURNING post_id,content_ref,source_text_hash,updated_at`;
   if(!rows.length)return {status:"not_owner"} as const;
   return {status:"saved",draft:rows[0],snapshot} as const;
  });
  if(result.status==="not_owner")return NextResponse.json({error:"Visible post not found or not owned by your account"},{status:404,headers});
  if(result.status==="limit")return NextResponse.json({error:"Maximum 20 content coin drafts per creator"},{status:429,headers});
  return NextResponse.json({
    saved:true,postId:result.draft.post_id,contentRef:result.snapshot.contentRef,
    sourceTextHash:result.snapshot.textHash,
    offchainSnapshot:true,creatorSignatureVerified:false,issuanceEnabled:false,
  },{status:201,headers});
 }catch{
  return NextResponse.json({error:"Cannot prepare content coin draft"},{status:503,headers});
 }
}

/** Delete a private proposal. Post deletion also cascades to its proposal. */
export async function DELETE(request:Request) {
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers});
 const postId=new URL(request.url).searchParams.get("postId");
 let id:string;
 try{id=checkedContentPostId(postId);}
 catch{return NextResponse.json({error:"Invalid post ID"},{status:400,headers});}
 try {
  const owner=await currentProfile();
  if(!owner)return NextResponse.json({error:"Sign in first"},{status:401,headers});
  const sql=database();
  const rows=await sql`DELETE FROM looke_content_coin_drafts
     WHERE post_id=${id}::uuid AND profile_id=${owner.id}::uuid RETURNING post_id`;
  if(!rows.length)return NextResponse.json({error:"Draft not found"},{status:404,headers});
  return NextResponse.json({deleted:true,issuanceEnabled:false},{headers});
 }catch{
  return NextResponse.json({error:"Cannot remove content coin draft"},{status:503,headers});
 }
}
