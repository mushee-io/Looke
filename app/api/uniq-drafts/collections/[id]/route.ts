import {NextResponse} from "next/server";
import {database} from "@/lib/server/database";
import {currentProfile,parseJson,validOrigin} from "@/lib/server/session";
import {checkedUniqDraftId} from "@/lib/uniq-creation.mjs";
import {normalizeCollectionEdit} from "@/lib/uniq-tools.mjs";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
/**
 * Owner-only complete metadata replacement with optimistic revision checking.
 * Conflicting edits never silently clobber previously saved author metadata.
 */
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers});
 let id:string;
 try{id=checkedUniqDraftId((await params).id);}
 catch{return NextResponse.json({error:"Invalid collection ID"},{status:400,headers});}
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers});
  let input:{name:string;description:string;imageURI:string;nativeAccount:string|null;
    factoryId:string|null;expectedRevision:number};
  try{input=normalizeCollectionEdit(await parseJson(request));}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid collection revision"},{status:400,headers});}
  const sql=database();
  const rows=await sql`UPDATE looke_uniq_collection_drafts
     SET name=${input.name},description=${input.description},image_uri=${input.imageURI},
       planned_native_account=${input.nativeAccount},planned_factory_id=${input.factoryId},
       revision=revision+1,updated_at=now()
     WHERE id=${id}::uuid AND profile_id=${me.id}::uuid AND revision=${input.expectedRevision}
     RETURNING id,revision,updated_at AS "updatedAt"`;
  if(rows.length)return NextResponse.json({saved:true,revision:rows[0].revision,
    updatedAt:rows[0].updatedAt,onchainChanged:false},{headers});
  const found=await sql`SELECT revision FROM looke_uniq_collection_drafts
    WHERE id=${id}::uuid AND profile_id=${me.id}::uuid LIMIT 1`;
  if(!found.length)return NextResponse.json({error:"Collection unavailable or not yours"},{status:404,headers});
  return NextResponse.json({error:"Another edit changed this collection. Refresh before retrying.",
    conflict:true,currentRevision:found[0].revision},{status:409,headers});
 }catch{return NextResponse.json({error:"Collection revision service unavailable"},{status:503,headers});}
}
