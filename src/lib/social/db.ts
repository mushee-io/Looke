import { Pool, type QueryResultRow } from "pg";

let pool:Pool|undefined;
export function socialDb():Pool {
  const url=process.env.DATABASE_URL;
  if(!url)throw new Error("Social database not configured; no posts or profiles are being fabricated.");
  if(!pool)pool=new Pool({connectionString:url,max:5,idleTimeoutMillis:10000,connectionTimeoutMillis:7000});
  return pool;
}
export async function query<T extends QueryResultRow = QueryResultRow>(sql:string,params:unknown[]=[]){
  return socialDb().query<T>(sql,params);
}

export async function rateLimit(actor:string,category:string,limit:number,windowSeconds:number){
  const seconds=Math.floor(Date.now()/1000/windowSeconds)*windowSeconds;
  const bucket=new Date(seconds*1000);
  const result=await query<{count:number}>(`
    INSERT INTO social_rate_windows(actor,category,window_start,count) VALUES($1,$2,$3,1)
    ON CONFLICT(actor,category,window_start) DO UPDATE SET count=social_rate_windows.count+1
    RETURNING count`,[actor,category,bucket]);
  if(result.rows[0].count>limit)throw new RateLimitError(`Rate limit exceeded for ${category}. Try later.`);
}
export class RateLimitError extends Error{}
