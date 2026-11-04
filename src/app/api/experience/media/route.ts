import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {requireViewer,verifyRequestOrigin,HttpError} from "../../../../lib/social/auth";
import {query,rateLimit} from "../../../../lib/social/db";
import {failure,readJson} from "../../../../lib/social/http";
import {
 uploadConfig,uploadEnabled,uploadDraft,uploadId,
 createUploadAuthorization,fetchProviderAsset,verifyProviderAsset,
 type UploadDraft,
} from "../../../../lib/social/upload-provider";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const safe={"cache-control":"private, no-store"};
type StoredUpload={
 id:string;owner:string;public_id:string;kind:"image"|"video";
 mime:UploadDraft["mime"];declared_bytes:number;state:string;
 verified_url:string|null;expires_at:Date;verified_at:Date|null;
};
export async function POST(request:NextRequest){
 try{
   verifyRequestOrigin(request);
   if(!uploadEnabled())throw new HttpError(503,
     "Authorized media uploads are disabled until social, hosting and moderation acceptance.");
   const actor=(await requireViewer(request)).address;
   const input=await readJson(request);
   const action=z.enum(["authorize","confirm"]).parse(input.action);
   const provider=uploadConfig();
   if(action==="authorize"){
     await rateLimit(actor,"media_authorize",5,600);
     const draft=uploadDraft.parse({kind:input.kind,mime:input.mime,bytes:input.bytes});
     const timestamp=Math.floor(Date.now()/1000);
     const signed=createUploadAuthorization(provider,actor,draft,timestamp);
     const record=await query<{id:string}>(`
       INSERT INTO social_media_uploads(
         owner,public_id,kind,mime,declared_bytes,expires_at
       ) VALUES($1,$2,$3,$4,$5,now()+interval '15 minutes') RETURNING id
     `,[actor,signed.publicId,draft.kind,draft.mime,draft.bytes]);
     return NextResponse.json({
       authorized:true,intentId:record.rows[0].id,
       uploadUrl:signed.uploadUrl,apiKey:signed.apiKey,
       fields:{...signed.parameters,signature:signed.signature},
       expiresInSeconds:900,maxBytes:draft.kind==="image"?5_000_000:20_000_000,
       note:"Upload to the authorized provider. Looke will separately verify the asset before a moderated post can refer to it.",
     },{headers:safe});
   }
   await rateLimit(actor,"media_confirm",10,600);
   const id=uploadId.parse(input.intentId);
   const r=await query<StoredUpload>(`
     SELECT id,owner,public_id,kind,mime,declared_bytes,state,verified_url,expires_at,verified_at
     FROM social_media_uploads WHERE id=$1 AND owner=$2
     LIMIT 1
   `,[id,actor]);
   const existing=r.rows[0];
   if(!existing)throw new HttpError(404,"No authorized upload for this wallet.");
   if(existing.state==="verified"&&existing.verified_url)
     return NextResponse.json({intentId:id,confirmed:true,
       media:{url:existing.verified_url,kind:existing.kind},moderation:"not-published",
     },{headers:safe});
   if(existing.state!=="issued"||new Date(existing.expires_at).getTime()<=Date.now())
     throw new HttpError(409,"Upload authorization expired or was already consumed.");
   const draft=uploadDraft.parse({
     kind:existing.kind,mime:existing.mime,bytes:existing.declared_bytes,
   });
   const asset=await fetchProviderAsset(provider,existing.kind,existing.public_id);
   const media=verifyProviderAsset({
     config:provider,asset,publicId:existing.public_id,draft,expectedOwner:actor,
   });
   const updated=await query<StoredUpload>(`
     UPDATE social_media_uploads
     SET state='verified',verified_url=$3,provider_asset_id=$4,verified_at=now()
     WHERE id=$1 AND owner=$2 AND state='issued' AND expires_at>now()
     RETURNING id,owner,public_id,kind,mime,declared_bytes,state,verified_url,expires_at,verified_at
   `,[id,actor,media.url,asset.asset_id]);
   if(updated.rowCount!==1)throw new HttpError(409,"Upload intent was consumed or expired.");
   return NextResponse.json({
     intentId:id,confirmed:true,media,moderation:"pending-after-post",
     note:"Provider evidence verified. Media will remain hidden until post and manual approval.",
   },{headers:safe});
 }catch(error){return failure(error);}
}

/** Unprivileged readiness signal; never return Cloudinary API credentials. */
export function GET(){
 let providerReady=false;
 if(uploadEnabled()){
   try{uploadConfig();providerReady=true;}catch{providerReady=false;}
 }
 return NextResponse.json({
   enabled:providerReady,
   authenticatedUploadRequired:true,
   provider:"cloudinary",
   maxImageBytes:5_000_000,maxVideoBytes:20_000_000,
   moderationRequired:true,
 },{headers:{"cache-control":"no-store"}});
}
