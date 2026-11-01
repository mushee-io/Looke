import {NextRequest,NextResponse} from "next/server";
import {database} from "@/lib/server/database";
import {currentProfile} from "@/lib/server/session";
import {checkedUniqDraftId} from "@/lib/uniq-creation.mjs";
import {buildCreatorExport} from "@/lib/uniq-tools.mjs";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
/** Private deterministic bundle. No remote image fetch, IPFS upload or native transaction. */
export async function GET(request:NextRequest){
 let id:string;
 try{id=checkedUniqDraftId(request.nextUrl.searchParams.get("collectionId"));}
 catch{return NextResponse.json({error:"Invalid collection ID"},{status:400,headers});}
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers});
  const sql=database();
  const records=await sql.begin(async tx=>{
   await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
   const cols=await tx`SELECT id,revision,name,description,image_uri AS "imageURI",
     planned_native_account AS "nativeAccount",planned_factory_id AS "factoryId"
     FROM looke_uniq_collection_drafts
     WHERE id=${id}::uuid AND profile_id=${me.id}::uuid LIMIT 1`;
   if(!cols.length)return null;
   const items=await tx`SELECT id,collection_id AS "collectionId",revision,
     name,description,image_uri AS "imageURI",edition_limit AS "editionLimit"
     FROM looke_uniq_item_drafts WHERE collection_id=${id}::uuid
       AND profile_id=${me.id}::uuid ORDER BY id LIMIT 50`;
   return {collection:cols[0],items};
  });
  if(!records)return NextResponse.json({error:"Private collection unavailable"},{status:404,headers});
  const bundle=buildCreatorExport(records.collection,records.items);
  return NextResponse.json({...bundle,network:"Ultra Native Testnet",
    exportFormat:"looke.uniq.creator-bundle.v1",pinningVerified:false,
    walletControlVerified:false,issuedTokens:0,
    note:"SHA-256 is only a byte-integrity check. This offchain draft bundle is not a minted Uniq, verified IPFS content or actual native factory."},{headers});
 }catch{
  return NextResponse.json({error:"Creator metadata export unavailable"},{status:503,headers});
 }
}
