import {NextResponse} from "next/server";
import {database} from "@/lib/server/database";
import {currentProfile,parseJson,validOrigin} from "@/lib/server/session";
import {checkedUniqDraftId} from "@/lib/uniq-creation.mjs";
import {normalizeUniqItemEdit} from "@/lib/uniq-tools.mjs";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
/**
 * Revision-checked author-only edition editing. Cannot move a draft into
 * another creator's collection or change the onchain issued NFT supply.
 */
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers});
 let id:string;
 try{id=checkedUniqDraftId((await params).id);}
 catch{return NextResponse.json({error:"Invalid item ID"},{status:400,headers});}
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers});
  let input:{collectionId:string;name:string;description:string;imageURI:string;
    editionLimit:number;expectedRevision:number};
  try{input=normalizeUniqItemEdit(await parseJson(request));}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid item revision"},{status:400,headers});}
  const sql=database();
  const rows=await sql`UPDATE looke_uniq_item_drafts
    SET name=${input.name},description=${input.description},image_uri=${input.imageURI},
      edition_limit=${input.editionLimit},revision=revision+1,updated_at=now()
    WHERE id=${id}::uuid AND profile_id=${me.id}::uuid
      AND collection_id=${input.collectionId}::uuid
      AND revision=${input.expectedRevision}
      AND EXISTS (SELECT 1 FROM looke_uniq_collection_drafts c
       WHERE c.id=${input.collectionId}::uuid AND c.profile_id=${me.id}::uuid)
    RETURNING id,revision,updated_at AS "updatedAt"`;
  if(rows.length)return NextResponse.json({saved:true,revision:rows[0].revision,
    updatedAt:rows[0].updatedAt,minted:false},{headers});
  const found=await sql`SELECT revision,collection_id FROM looke_uniq_item_drafts
    WHERE id=${id}::uuid AND profile_id=${me.id}::uuid LIMIT 1`;
  if(!found.length || String(found[0].collection_id)!==input.collectionId)
    return NextResponse.json({error:"Item unavailable in your collection"},{status:404,headers});
  return NextResponse.json({error:"Another edit changed this Uniq. Refresh before retrying.",
    conflict:true,currentRevision:found[0].revision},{status:409,headers});
 }catch{return NextResponse.json({error:"Uniq revision service unavailable"},{status:503,headers});}
}
