import {NextRequest,NextResponse} from "next/server";
import {readMarketplacePage,NativeMarketReadError} from "@/lib/server/uniq-market";
import {checkedMarketCursor} from "@/lib/uniq-market.mjs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 let cursor:string|null;
 try{cursor=checkedMarketCursor(request.nextUrl.searchParams.get("cursor"));}
 catch{return NextResponse.json({error:"Invalid native resale pagination cursor"},{status:400});}
 try{
  const page=await readMarketplacePage(cursor);
  return NextResponse.json(page,{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  return NextResponse.json({error:e instanceof NativeMarketReadError?e.message:
    "Native Uniq resale source unavailable",listings:[],purchasesEnabled:false},
    {status:e instanceof NativeMarketReadError?e.status:503,
     headers:{"Cache-Control":"no-store"}});
 }
}
