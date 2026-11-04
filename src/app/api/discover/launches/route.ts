import {NextRequest,NextResponse} from "next/server";
import {indexCreatorLaunches} from "../../../../lib/ops/m13-index";

export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Genuine, finalized historical CoinCreated pages; no data writes or sample tokens. */
export async function GET(req:NextRequest){
  const cursor=req.nextUrl.searchParams.get("cursor");
  if(cursor!==null&&!/^(0|[1-9][0-9]{0,19})$/.test(cursor))
    return NextResponse.json({error:"Invalid canonical block cursor."},{status:400});
  const q=(req.nextUrl.searchParams.get("q")??"").trim().toLocaleLowerCase("en-US").slice(0,64);
  const result=await indexCreatorLaunches(cursor);
  // Filtering only within the scanned page: never imply a complete global search.
  const launches=result.launches.filter(l=>!q||
    [l.symbol,l.name,l.token,l.creator].some(s=>s.toLocaleLowerCase("en-US").includes(q)));
  return NextResponse.json({...result,launches,filterScope:"current-finalized-block-page",
    verifiedInPage:launches.length},{
      status:result.status==="blocked"?503:200,
      headers:{"cache-control":"no-store"},
    });
}
