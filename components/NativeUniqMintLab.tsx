"use client";
import {useEffect,useRef,useState} from "react";
import {AlertTriangle,ExternalLink,ImagePlus,ShieldCheck,RefreshCw} from "lucide-react";

type NativeSdk={
 connect:()=>Promise<{data:{blockchainid:string}}>;
 signTransaction:(transaction:{
  contract:string;action:string;data:{issue:{
   to:string;token_configs:{token_factory_id:number;amount:number;custom_data:string}[];
   memo:string;authorizer:string|null;maximum_uos_payment:string;
  }};
 })=>Promise<{data:{transactionHash:string}}>;
};
type FactoryReview={account:string;factoryId:string;role:string;eligibleForReview:boolean;
 reasons:string[];warning:string;mintingEnabled:false;walletControlVerified:false};

/**
 * Highly restricted, still disabled-by-default opt-in SDK testnet issuance.
 * The native signer account is verified both before and immediately prior
 * to the wallet's explicit signTransaction prompt. No server signing keys.
 */
export function NativeUniqMintLab({account}:{account:string|null}){
 const [open,setOpen]=useState(false);
 const [ready,setReady]=useState(false);
 const [verified,setVerified]=useState(false);
 const [factory,setFactory]=useState("");
 const [limit,setLimit]=useState("1.00000000");
 const [minter,setMinter]=useState(false);
 const [review,setReview]=useState<FactoryReview|null>(null);
 const [reviewedAt,setReviewedAt]=useState(0);
 const [agreed,setAgreed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [tx,setTx]=useState("");
 const wallet=useRef<NativeSdk|null>(null);
 useEffect(()=>{
  let active=true;
  import("@ultraos/wallet-sdk").then(({UltraWalletSDK})=>{
   if(active){wallet.current=new UltraWalletSDK({environment:"testnet",provider:"extension"}) as unknown as NativeSdk;setReady(true);}
  }).catch(()=>{if(active)setMessage("Ultra Wallet SDK unavailable.");});
  return()=>{active=false;};
 },[]);
 useEffect(()=>{setVerified(false);setReview(null);setReviewedAt(0);setAgreed(false);setTx("");},[account]);
 useEffect(()=>{setReview(null);setReviewedAt(0);setAgreed(false);setTx("");},[factory,minter]);
 if(!account)return null;
 if(process.env.NEXT_PUBLIC_LOOKE_UNIQ_MINT_LAB!=="true")
  return <p style={{fontSize:12,opacity:.7,margin:"12px 0"}}>
   Native Uniq minting remains disabled. Use the Creator Studio to prepare metadata;
   independently verify factory roles, permissions, media pinning and testnet receipts before activating this private lab.
  </p>;

 function checkedFactory(){
  if(!/^[1-9][0-9]{0,19}$/.test(factory))throw Error("Enter an existing positive numeric Uniq factory ID.");
  const parsed=BigInt(factory);
  if(parsed>BigInt(Number.MAX_SAFE_INTEGER))throw Error("This factory ID exceeds this wallet integration's safe numeric range.");
  return Number(parsed);
 }
 function checkedLimit(){
  if(!/^(0|[1-9][0-9]?)\.[0-9]{8}$/.test(limit))throw Error("Use an exact UOS price cap with 8 decimals.");
  const [whole,fraction]=limit.split(".");
  const units=BigInt(whole)*100_000_000n+BigInt(fraction);
  if(units<=0n||units>1_000_000_000n)
   throw Error("Testnet UOS payment cap must be above zero and no more than 10 UOS.");
 }
 async function queryReview(id:number){
  const response=await fetch("/api/uniqs/factory?"+new URLSearchParams({
   factoryId:String(id),account
  }),{cache:"no-store"});
  const data=await response.json() as FactoryReview&{error?:string};
  if(!response.ok)throw Error(data.error??"Native factory check unavailable");
  if(data.factoryId!==String(id)||data.account!==account)
   throw Error("Factory/account changed during read-only review");
  return data;
 }
 function exactRole(item:FactoryReview){
  return item.eligibleForReview &&
   item.role===(minter?"authorized_minter":"asset_manager");
 }
 async function verify(){
  setBusy(true);setMessage("");setTx("");setReview(null);
  try{
   if(!wallet.current)throw Error("Ultra native SDK is still loading.");
   const {data}=await wallet.current.connect();
   if(!data||data.blockchainid!==account)throw Error("Native testnet wallet account changed.");
   setVerified(true);
   setMessage("Native testnet account matched. Next check the specific onchain factory and signer role.");
  }catch(e){setVerified(false);setMessage(e instanceof Error?e.message:"Wallet verification failed");}
  finally{setBusy(false);}
 }
 async function preflight(){
  setBusy(true);setMessage("");setTx("");setReview(null);
  try{
   if(!verified)throw Error("Verify your connected native wallet before reviewing the factory.");
   const id=checkedFactory(),info=await queryReview(id);
   if(!exactRole(info))throw Error((info.reasons?.join("; ")||"Factory role mismatch")+" (requested role does not match)");
   setReview(info);setReviewedAt(Date.now());
   setMessage("Factory role and active minting status read on native Ultra testnet. Not an approval or transaction simulation.");
  }catch(e){setReviewedAt(0);setMessage(e instanceof Error?e.message:"Native factory preflight unavailable");}
  finally{setBusy(false);}
 }
 async function mint(){
  setMessage("");setTx("");
  if(!wallet.current||!verified||!agreed||!account){setMessage("Reverify the native wallet and acknowledge the action.");return;}
  let id:number;
  try{
   id=checkedFactory();checkedLimit();
   if(!review||review.factoryId!==String(id)||review.account!==account||
      !exactRole(review)||Date.now()-reviewedAt>30_000)
    throw Error("Factory review expired or mismatched. Review the native factory again.");
  }catch(e){setMessage(e instanceof Error?e.message:"Invalid mint review");return;}
  setBusy(true);
  try{
   // Verify native extension account and refresh onchain conditions before
   // the wallet asks for a user-controlled signature.
   const {data:connection}=await wallet.current.connect();
   if(connection?.blockchainid!==account)throw Error("Native wallet changed. Mint cancelled.");
   const fresh=await queryReview(id);
   if(!exactRole(fresh))throw Error("Factory permissions/status changed. Mint cancelled.");
   const {data}=await wallet.current.signTransaction({
    contract:"eosio.nft.ft",action:"issue.b",
    data:{issue:{
     to:account,token_configs:[{token_factory_id:id,amount:1,custom_data:""}],
     memo:"Looke restricted native testnet Uniq lab",
     authorizer:minter?account:null,
     maximum_uos_payment:limit+" UOS"
    }}
   });
   if(!/^[a-f0-9]{64}$/i.test(data?.transactionHash??""))
    throw Error("Wallet did not return a valid transaction hash.");
   setTx(data.transactionHash);
   setAgreed(false);setReview(null);
   setMessage("Wallet reported a native Ultra testnet broadcast. Verify actual receipt and finality independently in the explorer.");
  }catch(e){setMessage(e instanceof Error?e.message:"Native wallet rejected or contract denied mint");}
  finally{setBusy(false);}
 }
 return <section style={{border:"1px solid #e4e4e4",borderRadius:16,padding:18,margin:"22px 0"}}>
  <button type="button" onClick={()=>setOpen(v=>!v)} style={{display:"inline-flex",gap:9,alignItems:"center",fontWeight:700}}>
   <ImagePlus size={18}/>{open?"Hide":"Open"} restricted Uniq testnet mint lab
  </button>
  {open&&<div style={{display:"grid",gap:12,marginTop:15}}>
   <p style={{fontSize:13}}>Only for a genuine native testnet factory manager or positive-quota authorized minter. No factory creation, metadata pinning, or public minting happens here.</p>
   <div style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:12}}>
    <AlertTriangle size={17}/><span>This action may consume real testnet UOS. The native wallet must explicitly approve it; a broadcast is not an independently confirmed mint.</span>
   </div>
   <label>Existing factory ID
    <input value={factory} inputMode="numeric" placeholder="Verified factory ID" onChange={e=>setFactory(e.target.value)}/>
   </label>
   <label>Maximum test UOS payment
    <input value={limit} placeholder="1.00000000" onChange={e=>{setLimit(e.target.value);setAgreed(false);}}/>
   </label>
   <label style={{display:"flex",gap:9}}>
    <input type="checkbox" checked={minter} onChange={e=>setMinter(e.target.checked)}/>
    Use an authorized minter account rather than the factory asset manager
   </label>
   <p style={{fontSize:12,opacity:.75}}>Recipient: {account} · Quantity: 1 · Action: eosio.nft.ft::issue.b on native Ultra testnet</p>
   <button type="button" className="login-provider" disabled={busy||!ready} onClick={()=>void verify()}>
    <ShieldCheck size={16}/>{verified?"Native account verified":"Verify native testnet wallet"}
   </button>
   <button type="button" className="login-provider" disabled={busy||!verified||!factory}
    onClick={()=>void preflight()}><RefreshCw size={15}/> Read factory status and signer role</button>
   {review&&<p role="status" style={{fontSize:12}}>
    Role: {review.role}; eligibility checked: {review.eligibleForReview?"yes":"no"}.
    Factory status, authorization and costs may change before issuance.
   </p>}
   <label style={{display:"flex",gap:9}}>
    <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>
    I understand this is a real testnet wallet action, subject to native factory permissions, fees and explicit signature consent.
   </label>
   <button type="button" className="primary-button"
    disabled={busy||!verified||!agreed||!review||!exactRole(review)||Date.now()-reviewedAt>30_000}
    onClick={()=>void mint()}>
    Sign & broadcast one native testnet mint
   </button>
   {message&&<p role="status" style={{fontSize:12,overflowWrap:"anywhere"}}>{message}</p>}
   {tx&&<a href={"https://explorer.testnet.ultra.io/tx/"+tx} target="_blank" rel="noreferrer"
    style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12}}>
    Review native Ultra testnet transaction evidence <ExternalLink size={14}/>
   </a>}
  </div>}
 </section>;
}
