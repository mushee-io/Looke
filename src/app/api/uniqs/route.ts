import { NextRequest, NextResponse } from "next/server";
import { activeListings, getFactory, getListing, getNativeTestnetInfo, ownedUniqs } from "../../../lib/ultra-native-rpc";
import { positiveId, validateNativeAccount } from "../../../lib/ultra-native";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const kind = params.get("kind") || "status";
  const limitInput = params.get("limit") || "20";
  if (!/^[1-9][0-9]{0,1}$/.test(limitInput) || Number(limitInput) > 50) {
    return NextResponse.json({ error: "Invalid page size (1–50)." }, { status: 400 });
  }
  const cursor = params.get("cursor") || "";
  if (cursor && !/^[0-9]{1,16}$/.test(cursor)) {
    return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  }
  try {
    let data: unknown;
    switch (kind) {
      case "status": {
        const info = await getNativeTestnetInfo();
        data = { chainId: info.chain_id, headBlock: info.head_block_num, irreversibleBlock: info.last_irreversible_block_num };
        break;
      }
      case "owned":
        data = await ownedUniqs(validateNativeAccount(params.get("account") || ""), Number(limitInput), cursor);
        break;
      case "listings":
        data = await activeListings(Number(limitInput), cursor);
        break;
      case "factory":
        data = await getFactory(positiveId(params.get("id") || ""));
        break;
      case "listing":
        data = await getListing(positiveId(params.get("id") || ""));
        break;
      default:
        return NextResponse.json({ error: "Unsupported query kind." }, { status: 400 });
    }
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Native chain query failed.";
    const inputError = /^(Invalid|Enter|Uniq\/factory ID)/.test(message);
    return NextResponse.json({ error: message }, { status: inputError ? 400 : 503, headers: { "cache-control": "no-store" } });
  }
}
