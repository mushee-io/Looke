import type {TablePage} from "../ultra-native-rpc";
import type {UniqToken} from "../ultra-native";
import {positiveId,validateNativeAccount} from "../ultra-native";

/** Bounded, independent native Ultra Testnet account-scope proof walk.
 * A miss never proves absence of ownership. */
export async function findNativeUniq(
 account:string,tokenId:string,
 reader:(account:string,limit:number,cursor?:string)=>Promise<TablePage<UniqToken>>,
 maxPages=3
):Promise<{found:UniqToken|null;pages:number;scanned:number;truncated:boolean;irreversibleBlock:number}>{
 const scope=validateNativeAccount(account);
 const id=positiveId(tokenId);
 if(!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>5)throw new Error("Unsafe lookup page limit.");
 const seen=new Set<string>();
 let cursor:undefined|string;
 let pages=0,scanned=0,irreversibleBlock=0;
 for(let i=0;i<maxPages;i++){
   const page=await reader(scope,50,cursor);
   pages++;scanned+=page.rows.length;
   if(!Number.isSafeInteger(page.irreversibleBlock)||page.irreversibleBlock<0)
     throw new Error("Unverified native Testnet finality marker.");
   irreversibleBlock=page.irreversibleBlock;
   const found=page.rows.find(row=>row.id===id)??null;
   if(found)return {found,pages,scanned,truncated:false,irreversibleBlock};
   if(!page.more)return {found:null,pages,scanned,truncated:false,irreversibleBlock};
   if(!page.next_key||seen.has(page.next_key))
     return {found:null,pages,scanned,truncated:true,irreversibleBlock};
   seen.add(page.next_key);cursor=page.next_key;
 }
 return {found:null,pages,scanned,truncated:true,irreversibleBlock};
}
