import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const QUERY = `query OwnedUniqs($walletId: WalletId!) {
  uniqsOfWallet(walletId:$walletId,pagination:{limit:20,skip:0}) {
    totalCount
    data {
      id
      owner
      serialNumber
      type
      metadata { content { name description } }
      resale { price { amount currency { symbol } } }
    }
  }
}`;

/** Server-side proxy for the official Ultra Uniq API. Never accept client GraphQL queries or forward secrets. */
export async function GET(request: NextRequest) {
  const walletId=request.nextUrl.searchParams.get("wallet") ?? "";
  if(!/^[a-z1-5.]{1,13}$/.test(walletId)) return NextResponse.json({error:"Invalid Ultra native account"}, {status:400});
  const token=process.env.ULTRA_API_BEARER_TOKEN;
  const clientId=process.env.ULTRA_API_CLIENT_ID;
  if(!token||!clientId) return NextResponse.json({error:"Ultra NFT API credentials are not configured"}, {status:503});
  const endpoint=process.env.ULTRA_API_ENV==="production"
    ? "https://api.ultra.io/graphql" : "https://staging.api.ultra.io/graphql";
  try{
    const response=await fetch(endpoint,{
      method:"POST",
      headers:{"content-type":"application/json","authorization":"Bearer "+token,"X-Client-ID":clientId},
      body:JSON.stringify({query:QUERY,variables:{walletId}}),
      signal:AbortSignal.timeout(8000),
      cache:"no-store"
    });
    if(!response.ok) return NextResponse.json({error:"Ultra NFT API did not accept the request"}, {status:502});
    const payload=await response.json() as {data?:{uniqsOfWallet?:{totalCount:number;data:unknown[]}};errors?:unknown[]};
    if(payload.errors?.length || !payload.data?.uniqsOfWallet) return NextResponse.json({error:"Ultra NFT API returned a GraphQL error"}, {status:502});
    return NextResponse.json({walletId,network:process.env.ULTRA_API_ENV==="production"?"mainnet":"testnet",total:payload.data.uniqsOfWallet.totalCount,uniqs:payload.data.uniqsOfWallet.data},{headers:{"Cache-Control":"private, max-age=30"}});
  }catch{return NextResponse.json({error:"Ultra NFT API unavailable"}, {status:502});}
}
