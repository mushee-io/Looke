"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, ImagePlus, ShieldCheck } from "lucide-react";
type NativeSdk = {
  connect: () => Promise<{data:{blockchainid:string}}>;
  signTransaction: (transaction:{
    contract:string; action:string; data:{
      issue:{
        to:string;
        token_configs:{token_factory_id:number;amount:number;custom_data:string}[];
        memo:string;
        authorizer:string|null;
        maximum_uos_payment:string;
      };
    };
  })=>Promise<{data:{transactionHash:string}}>;
};

/**
 * TESTNET LAB. User signs themselves, via official native Ultra Wallet.
 * No server keys, mainnet actions, unattended signing or auto-minting.
 * Cannot mint unless the connected account owns an approved Uniq factory or is its authorized minter.
 */
export function NativeUniqMintLab({account}:{account:string|null}){
 const [open,setOpen]=useState(false);
 const [ready,setReady]=useState(false);
 const [verified,setVerified]=useState(false);
 const [factory,setFactory]=useState("");
 const [limit,setLimit]=useState("1.00000000");
 const [minter,setMinter]=useState(false);
 const [agreed,setAgreed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [tx,setTx]=useState("");
 const wallet=useRef<NativeSdk|null>(null);
 useEffect(()=>{
  let mounted=true;
  import("@ultraos/wallet-sdk").then(({UltraWalletSDK})=>{
    if(mounted){wallet.current=new UltraWalletSDK({environment:"testnet",provider:"extension"}) as unknown as NativeSdk;setReady(true);}
  }).catch(()=>{if(mounted)setMessage("Ultra Wallet SDK is unavailable.");});
  return()=>{mounted=false;};
 },[]);
 useEffect(()=>{setVerified(false);setTx("");},[account]);
 if(!account)return null;
 if(process.env.NEXT_PUBLIC_LOOKE_UNIQ_MINT_LAB!=="true")
  return <p style={{fontSize:12,opacity:.7,margin:"12px 0"}}>Uniq testnet minting lab is disabled until the factory permissions and security review are ready.</p>;

 async function verify(){
  setBusy(true);setMessage("");setTx("");
  try{
    if(!wallet.current)throw Error("Ultra Wallet SDK is loading.");
    const {data}=await wallet.current.connect();
    if(!data||data.blockchainid!==account)throw Error("Connected Ultra account changed. Reconnect the correct testnet account.");
    setVerified(true);
    setMessage("Native Ultra testnet account verified. Review every mint parameter before signing.");
  }catch(e){setVerified(false);setMessage(e instanceof Error?e.message:"Wallet verification rejected");}
  finally{setBusy(false);}
 }
 function validated(){
   const id=Number(factory);
   if(!Number.isSafeInteger(id)||id<=0)throw Error("Factory ID must be a positive safe integer.");
   if(!/^\d{1,2}\.\d{8}$/.test(limit) || Number(limit)<=0 || Number(limit)>10)throw Error("UOS payment cap must be between 0 and 10, with 8 decimals.");
   if(!verified||!agreed)throw Error("Verify your wallet and acknowledge the transaction first.");
   return id;
 }
 async function mint(){
   setMessage("");setTx("");
   let id:number;
   try{id=validated();}catch(e){setMessage(e instanceof Error?e.message:"Invalid mint parameters");return;}
   if(!wallet.current){setMessage("Ultra Wallet not ready");return;}
   setBusy(true);
   try{
     // Wallet request directly within user click. User approves exact native action.
     const {data}=await wallet.current.signTransaction({
       contract:"eosio.nft.ft",action:"issue.b",
       data:{issue:{
         to:account,
         token_configs:[{token_factory_id:id,amount:1,custom_data:""}],
         memo:"Looke testnet authorized Uniq mint",
         authorizer:minter?account:null,
         maximum_uos_payment:limit+" UOS"
       }}
     });
     if(!/^[a-f0-9]{64}$/i.test(data.transactionHash))throw Error("No valid transaction receipt returned.");
     setTx(data.transactionHash);
     setMessage("Transaction broadcast on Ultra native testnet. Verify execution and irreversibility in the explorer; this is not finality proof.");
   }catch(e){setMessage(e instanceof Error?e.message:"Wallet rejected or contract denied minting");}
   finally{setBusy(false);}
 }
 return <section style={{border:"1px solid #e4e4e4",borderRadius:16,padding:18,margin:"22px 0"}}>
   <button type="button" onClick={()=>setOpen(!open)} style={{display:"inline-flex",gap:9,alignItems:"center",fontWeight:700}}><ImagePlus size={18}/>{open?"Hide":"Open"} authorized Uniq testnet mint lab</button>
   {open&&<div style={{display:"grid",gap:12,marginTop:15}}>
     <p style={{fontSize:13}}>Only for factory managers or approved minters. No factory is created here. Requires Ultra extension on the <strong>native testnet</strong>.</p>
     <div style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:12}}><AlertTriangle size={17}/><span>This sends a real testnet transaction, may charge test UOS and can fail if you lack factory authorization. Never connect mainnet here.</span></div>
     <label>Factory ID <input type="number" min={1} step={1} value={factory} onChange={e=>setFactory(e.target.value)} placeholder="Authorized factory ID"/></label>
     <label>Maximum test UOS payment <input value={limit} onChange={e=>setLimit(e.target.value)} placeholder="1.00000000"/></label>
     <label style={{display:"flex",gap:9}}><input type="checkbox" checked={minter} onChange={e=>setMinter(e.target.checked)}/> I am an authorized minter, rather than factory manager</label>
     <p style={{fontSize:12,opacity:.7}}>Recipient: {account} · Quantity: 1 Uniq · Contract: eosio.nft.ft · Action: issue.b</p>
     <button type="button" className="login-provider" onClick={verify} disabled={busy||!ready}><ShieldCheck size={16}/>{verified?"Wallet verified":"Verify native testnet wallet"}</button>
     <label style={{display:"flex",gap:9}}><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/> I understand the price cap, factory permissions and consequences of a signed testnet transaction.</label>
     <button type="button" className="primary-button" disabled={busy||!verified||!agreed} onClick={mint}>Sign & broadcast one testnet mint</button>
     {message&&<p role="status" style={{fontSize:12,overflowWrap:"anywhere"}}>{message}</p>}
     {tx&&<a href={"https://explorer.testnet.ultra.io/tx/"+tx} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12}}>Verify native Ultra transaction <ExternalLink size={14}/></a>}
   </div>}
 </section>;
}
