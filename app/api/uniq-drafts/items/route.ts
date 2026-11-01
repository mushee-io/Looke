import {NextRequest,NextResponse} from "next/server";
import {database} from "@/lib/server/database";
import {currentProfile,parseJson,validOrigin} from "@/lib/server/session";
import {checkedUniqDraftId,normalizeUniqItem,MAX_UNIQ_ITEMS_PER_COLLECTION} from "@/lib/uniq-creation.mjs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};

export async function GET(request:NextRequest){
 let id:string;
 try{id=checkedUniqDraftId(request.nextUrl.searchParams.get("collectionId"));}
 catch{return NextResponse.json({error:"Invalid collection ID"},{status:400,headers});}
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers});
  const sql=database();
  const exists=await sql`SELECT id FROM looke_uniq_collection_drafts
    WHERE id=${id}::uuid AND profile_id=${me.id}::uuid`;
  if(!exists.length)return NextResponse.json({error:"Private collection unavailable"},{status:404,headers});
  const items=await sql`SELECT id,collection_id AS "collectionId",name,description,
    image_uri AS "imageURI",edition_limit AS "editionLimit",
    created_at AS "createdAt" FROM looke_uniq_item_drafts
    WHERE collection_id=${id}::uuid AND profile_id=${me.id}::uuid
    ORDER BY created_at DESC,id DESC LIMIT ${MAX_UNIQ_ITEMS_PER_COLLECTION}`;
  return NextResponse.json({items,minted:false},{headers});
 }catch{return NextResponse.json({error:"Uniq item drafts unavailable"},{status:503,headers});}
}
export async function POST(request:Request){
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers});
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers});
  let input:{collectionId:string;name:string;description:string;imageURI:string;editionLimit:number};
  try{input=normalizeUniqItem(await parseJson(request));}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid Uniq item draft"},{status:400,headers});}
  const sql=database();
  const result=await sql.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(hashtext(${me.id}::text||':uniq-items:'||${input.collectionId}))`;
    const collections=await tx`SELECT id FROM looke_uniq_collection_drafts
      WHERE id=${input.collectionId}::uuid AND profile_id=${me.id}::uuid FOR SHARE`;
    if(!collections.length)return {status:"missing"} as const;
    const rows=await tx`SELECT count(*)::int AS count FROM looke_uniq_item_drafts
      WHERE collection_id=${input.collectionId}::uuid AND profile_id=${me.id}::uuid`;
    if(Number(rows[0]?.count??0)>=MAX_UNIQ_ITEMS_PER_COLLECTION)return {status:"limit"} as const;
    const inserted=await tx`INSERT INTO looke_uniq_item_drafts(
      collection_id,profile_id,name,description,image_uri,edition_limit)
      VALUES(${input.collectionId}::uuid,${me.id}::uuid,${input.name},
      ${input.description},${input.imageURI},${input.editionLimit})
      RETURNING id,name,edition_limit`;
    return {status:"saved",item:inserted[0]} as const;
  });
  if(result.status==="missing")return NextResponse.json({error:"Collection not found or not yours"},{status:404,headers});
  if(result.status==="limit")return NextResponse.json({error:"Maximum 50 item drafts per collection"},{status:429,headers});
  return NextResponse.json({item:result.item,created:true,minted:false},{status:201,headers});
 }catch{return NextResponse.json({error:"Cannot prepare Uniq item draft"},{status:503,headers});}
}
export async function DELETE(request:NextRequest){
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers});
 let id:string;
 try{id=checkedUniqDraftId(request.nextUrl.searchParams.get("id"));}
 catch{return NextResponse.json({error:"Invalid item draft ID"},{status:400,headers});}
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers});
  const sql=database();
  const deleted=await sql`DELETE FROM looke_uniq_item_drafts
    WHERE id=${id}::uuid AND profile_id=${me.id}::uuid RETURNING id`;
  if(!deleted.length)return NextResponse.json({error:"Private draft unavailable"},{status:404,headers});
  return NextResponse.json({deleted:true,nativeTokenBurned:false},{headers});
 }catch{return NextResponse.json({error:"Cannot remove Uniq item draft"},{status:503,headers});}
}
