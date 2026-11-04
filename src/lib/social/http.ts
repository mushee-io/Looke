import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";
import { RateLimitError } from "./db";

export function failure(error:unknown):NextResponse {
  if(error instanceof ZodError)return NextResponse.json(
    {error:"Invalid request data.",issues:error.issues.map(x=>({path:x.path.join("."),message:x.message}))},{status:400});
  if(error instanceof HttpError)return NextResponse.json({error:error.message},{status:error.status});
  if(error instanceof RateLimitError)return NextResponse.json({error:error.message},{status:429});
  if(error && typeof error==="object" && "code" in error) {
    const code=String((error as {code:unknown}).code);
    if(code==="23505")return NextResponse.json({error:"That identifier or action already exists."},{status:409});
    if(code==="23503")return NextResponse.json({error:"Referenced profile or post does not exist."},{status:404});
  }
  // Missing database is an explicit operational gate, never a fake empty feed.
  if(error instanceof Error && /database not configured|social application origin|ECONNREFUSED/.test(error.message)){
    return NextResponse.json({error:"Looke social backend is not configured."},{status:503});
  }
  console.error("Looke social request failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:"Looke social service unavailable."},{status:503});
}
export async function readJson(req:Request):Promise<Record<string,unknown>>{
  const raw=await req.text();
  if(raw.length>9000)throw new HttpError(413,"Social request is too large.");
  let result:unknown;
  try{result=JSON.parse(raw);}catch{throw new HttpError(400,"Invalid JSON.");}
  if(!result || typeof result!=="object" || Array.isArray(result))throw new HttpError(400,"Expected a JSON object.");
  return result as Record<string,unknown>;
}
