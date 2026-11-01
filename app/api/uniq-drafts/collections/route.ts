import {NextRequest,NextResponse} from "next/server";
import {database} from "@/lib/server/database";
import {currentProfile,parseJson,validOrigin} from "@/lib/server/session";
import {checkedUniqDraftId,normalizeUniqCollection,MAX_UNIQ_COLLECTIONS} from "@/lib/uniq-creation.mjs";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};

export async function GET(){
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in to view your private Uniq drafts"},{status:401,headers});
  const sql=database();
  const collections=await sql`
   SELECT c.id,c.name,c.description,c.image_uri AS "imageURI",
    c.planned_native_account AS "nativeAccount",c.planned_factory_id AS "factoryId",
    c.created_at AS "createdAt",c.updated_at AS "updatedAt",
    (SELECT count(*)::int FROM looke_uniq_item_drafts i WHERE i.collection_id=c.id) AS "itemCount"
   FROM looke_uniq_collection_drafts c WHERE c.profile_id=${me.id}::uuid
   ORDER BY c.updated_at DESC,c.id DESC LIMIT ${MAX_UNIQ_COLLECTIONS}
  `;
  return NextResponse.json({collections,issuerVerified:false,mintEnabled:false,
    note:"These drafts belong to your Looke EVM session. Native Ultra account ownership has not been proven."},{headers});
 }catch{return NextResponse.json({error:"Uniq drafts unavailable"},{status:503,headers});}
}
export async function POST(request:Request){
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers});
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers});
  if(!me.handle)return NextResponse.json({error:"Save a public Looke creator handle first"},{status:409,headers});
  let input:{name:string;description:string;imageURI:string;nativeAccount:string|null;factoryId:string|null};
  try{input=normalizeUniqCollection(await parseJson(request));}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid Uniq collection"},{status:400,headers});}
  const sql=database();
  const result=await sql.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(hashtext(${me.id}::text||':uniq-collections'))`;
    const rows=await tx`SELECT count(*)::int AS count FROM looke_uniq_collection_drafts
       WHERE profile_id=${me.id}::uuid`;
    if(Number(rows[0]?.count??0)>=MAX_UNIQ_COLLECTIONS)return null;
    const saved=await tx`
      INSERT INTO looke_uniq_collection_drafts(profile_id,name,description,
        image_uri,planned_native_account,planned_factory_id)
      VALUES(${me.id}::uuid,${input.name},${input.description},${input.imageURI},
        ${input.nativeAccount},${input.factoryId})
      RETURNING id,name,created_at
    `;
    return saved[0];
  });
  if(!result)return NextResponse.json({error:"Maximum 8 collection drafts per creator"},{status:429,headers});
  return NextResponse.json({draft:result,created:true,nativeOwnershipVerified:false,
    collectionCreatedOnchain:false},{status:201,headers});
 }catch{return NextResponse.json({error:"Could not save private collection draft"},{status:503,headers});}
}
export async function DELETE(request:NextRequest){
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers});
 let id:string;
 try{id=checkedUniqDraftId(request.nextUrl.searchParams.get("id"));}
 catch{return NextResponse.json({error:"Invalid collection draft ID"},{status:400,headers});}
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers});
  const sql=database();
  const rows=await sql`DELETE FROM looke_uniq_collection_drafts
    WHERE id=${id}::uuid AND profile_id=${me.id}::uuid RETURNING id`;
  if(!rows.length)return NextResponse.json({error:"Collection draft unavailable"},{status:404,headers});
  return NextResponse.json({deleted:true,nativeTokenBurned:false},{headers});
 }catch{return NextResponse.json({error:"Could not remove collection draft"},{status:503,headers});}
}
