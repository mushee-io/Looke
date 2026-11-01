import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {database} from "@/lib/server/database";
import {currentProfile} from "@/lib/server/session";
import {checkedUniqDraftId,buildUniqManifest} from "@/lib/uniq-creation.mjs";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
/**
 * Canonical offchain Looke metadata, hash of exact UTF-8 JSON bytes.
 * Neither image hosting nor IPFS pinning, native metadata validity, nor
 * actual Uniq factory creation is supplied by this preview endpoint.
 */
export async function GET(request:NextRequest){
 const kind=request.nextUrl.searchParams.get("kind");
 if(kind!=="collection"&&kind!=="uniq")return NextResponse.json({error:"Invalid manifest kind"},{status:400,headers});
 let id:string;
 try{id=checkedUniqDraftId(request.nextUrl.searchParams.get("id"));}
 catch{return NextResponse.json({error:"Invalid draft ID"},{status:400,headers});}
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers});
  const sql=database();
  const rows=kind==="collection"
    ?await sql`SELECT name,description,image_uri AS "imageURI",
      planned_native_account AS "nativeAccount",planned_factory_id AS "factoryId"
      FROM looke_uniq_collection_drafts WHERE id=${id}::uuid AND profile_id=${me.id}::uuid LIMIT 1`
    :await sql`SELECT collection_id AS "collectionId",name,description,image_uri AS "imageURI",edition_limit AS "editionLimit"
      FROM looke_uniq_item_drafts WHERE id=${id}::uuid AND profile_id=${me.id}::uuid LIMIT 1`;
  if(!rows.length)return NextResponse.json({error:"Your private draft was not found"},{status:404,headers});
  const row=rows[0];
  const manifest=kind==="collection"
    ?buildUniqManifest("collection",{
      name:String(row.name),description:String(row.description),imageURI:String(row.imageURI),
      nativeAccount:typeof row.nativeAccount==="string"?row.nativeAccount:null,
      factoryId:typeof row.factoryId==="string"?row.factoryId:null,
    })
    :buildUniqManifest("uniq",{
      collectionId:String(row.collectionId),name:String(row.name),
      description:String(row.description),imageURI:String(row.imageURI),
      editionLimit:Number(row.editionLimit)
    });
  const digest=createHash("sha256").update(Buffer.from(manifest,"utf8")).digest("hex");
  return NextResponse.json({kind,manifest,sha256:digest,byteLength:Buffer.byteLength(manifest,"utf8"),
    network:"Ultra Native Testnet",
    pinningVerified:false,nativeFactoryVerified:false,minted:false,
    note:"This SHA-256 checks exact Looke manifest bytes only; it has not been pinned to IPFS or submitted to eosio.nft.ft."},
    {headers});
 }catch{return NextResponse.json({error:"Uniq manifest unavailable"},{status:503,headers});}
}
