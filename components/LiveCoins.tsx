"use client";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
type Token = {coin_address:string;creator_address:string;kind:number;metadata_uri:string;supply_raw:string;tx_hash:string;block_number:string};
export function LiveCoins(){
 const [coins,setCoins]=useState<Token[]>([]);
 const [available,setAvailable]=useState(false);
 useEffect(()=>{
   let active=true;
   fetch("/api/coins",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()).then(data=>{
     if(active){setCoins(data.coins||[]);setAvailable(true);}
   }).catch(()=>{if(active)setAvailable(false);});
   return()=>{active=false;};
 },[]);
 return <section style={{margin:"24px 0",border:"1px solid #e9e9e9",padding:"18px",borderRadius:14}}>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
     <div><strong>Ultra EVM testnet launches</strong><div style={{fontSize:12,opacity:.65}}>Indexed onchain events, not demo prices</div></div>
     <span style={{fontSize:11,opacity:.75}}>{available?"Connected index":"Indexer pending"}</span>
   </div>
   {available && coins.length ? <div style={{marginTop:14,display:"grid",gap:9}}>
     {coins.map(c=><div key={c.tx_hash+":"+c.coin_address} style={{borderTop:"1px solid #eee",paddingTop:10,display:"flex",gap:12,alignItems:"center"}}>
       <div style={{flex:1}}><strong>{["Creator","Content","Trend"][c.kind]??"Coin"} coin</strong>
         <div style={{fontSize:12,opacity:.65,overflowWrap:"anywhere"}}>{c.coin_address}</div>
         <small>Supply: {(BigInt(c.supply_raw)/10n**18n).toLocaleString()} · Block {c.block_number}</small>
       </div>
       <a target="_blank" rel="noreferrer" aria-label="View testnet transaction" href={"https://evmexplorer.testnet.ultra.io/tx/"+c.tx_hash}><ExternalLink size={17}/></a>
     </div>)}
   </div>:<p style={{fontSize:13,opacity:.65,marginTop:12}}>{available?"No verified factory events indexed yet.":"Live launch indexing will appear once a tested factory, database and worker are configured."}</p>}
 </section>;
}
