/**
 * Cursor for deterministic reverse-chronological feed pages.
 * This is a public paging token, not authentication.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function canonicalTimestamp(value) {
 if (typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
 const date=new Date(value.slice(0,-4)+"Z");
 return Number.isNaN(date.getTime()) || date.toISOString().slice(0,-1)!==value.slice(0,-4) ? null : value;
}
export function encodeFeedCursor(createdAt,id) {
 const date=createdAt instanceof Date ? createdAt.toISOString().replace(/Z$/,"000Z") : createdAt;
 if(!canonicalTimestamp(date)||typeof id!=="string"||!UUID.test(id)) throw new RangeError("Invalid feed cursor data");
 return Buffer.from(JSON.stringify([date,id.toLowerCase()]),"utf8").toString("base64url");
}
export function decodeFeedCursor(token) {
 if(typeof token!=="string" || !/^[A-Za-z0-9_-]{1,200}$/.test(token)) throw new RangeError("Invalid feed cursor");
 try{
   const parsed=JSON.parse(Buffer.from(token,"base64url").toString("utf8"));
   if(!Array.isArray(parsed)||parsed.length!==2||!canonicalTimestamp(parsed[0])||
      typeof parsed[1]!=="string"||!UUID.test(parsed[1]) ||
      encodeFeedCursor(parsed[0],parsed[1])!==token)throw Error("Malformed cursor");
   return {createdAt:parsed[0],id:parsed[1].toLowerCase()};
 }catch{throw new RangeError("Invalid feed cursor");}
}
