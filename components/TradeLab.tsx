"use client";
import {useState,type FormEvent} from "react";
import {ArrowRightLeft,Calculator,ShieldAlert,RefreshCw,Wallet,Info} from "lucide-react";
import {formatUnits} from "viem";
import {parseRawTradeAmount,checkedPoolFeeBps,checkedSlippageBps,
 simulateSwapExactIn} from "@/lib/market/trade-guard.mjs";
type Sim=ReturnType<typeof simulateSwapExactIn>;
type ChainQuote=Sim&{
 pool:string;tokenIn:string;tokenOut:string;
 inputSymbol:string;outputSymbol:string;inputDecimals:number;outputDecimals:number;
 reserveAgeSeconds:number;observedBlock:string;expiresAt:string;
 chainId:number;tradeEnabled:false;verification:string;warning:string;
};
type WalletPreflight={wallet:string;tokenBalanceRaw:string;uosBalanceWei:string;tokenBalanceEnough:boolean;
 gasEnough:string;allowanceEnough:string;walletOwnershipVerified:boolean;transactionSimulationPassed:boolean};
type ChainPreflight={quote:ChainQuote;wallet:WalletPreflight|null;
 preflight:{checks:Record<string,boolean>;passing:boolean;executionEnabled:false};
 blockers:string[];executionEnabled:false};

const fieldStyle={display:"block",width:"100%",padding:"11px 12px",
 border:"1px solid #e1dfe7",borderRadius:9,font:"inherit",marginTop:7};
function rawText(value:string,decimals:number){
 try{return formatUnits(BigInt(value),decimals);}
 catch{return "unavailable";}
}
/**
 * Completely read-only trading exploration. Never calls ethereum.request, opens a
 * signing UI, builds swap calldata, or creates approvals.
 */
export function TradeLab({walletAddress}:{walletAddress:string|null}) {
 const [simAmount,setSimAmount]=useState("1000");
 const [simIn,setSimIn]=useState("10000");
 const [simOut,setSimOut]=useState("10000");
 const [simFee,setSimFee]=useState("30");
 const [slippage,setSlippage]=useState("50");
 const [sim,setSim]=useState<Sim|null>(null);
 const [simError,setSimError]=useState("");
 const [pool,setPool]=useState("");
 const [tokenIn,setTokenIn]=useState("");
 const [realAmount,setRealAmount]=useState("");
 const [quote,setQuote]=useState<ChainQuote|null>(null);
 const [preflight,setPreflight]=useState<ChainPreflight|null>(null);
 const [readError,setReadError]=useState("");
 const [busy,setBusy]=useState(false);

 function simulate(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setSim(null);setSimError("");
  try{
   setSim(simulateSwapExactIn({
    amountIn:parseRawTradeAmount(simAmount),
    reserveIn:parseRawTradeAmount(simIn),
    reserveOut:parseRawTradeAmount(simOut),
    feeBps:checkedPoolFeeBps(simFee),
    slippageBps:checkedSlippageBps(slippage)
   }));
  }catch(e){setSimError(e instanceof Error?e.message:"Invalid simulation input");}
 }
 async function inspect(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setReadError("");setQuote(null);setPreflight(null);setBusy(true);
  try{
   const query=new URLSearchParams({
    pool,tokenIn,amountIn:realAmount,slippageBps:slippage
   });
   const path=walletAddress?"/api/trade/preflight":"/api/quote";
   if(walletAddress)query.set("wallet",walletAddress);
   const response=await fetch(path+"?"+query.toString(),{cache:"no-store"});
   const data=await response.json() as (ChainQuote&{error?:string}) |
     (ChainPreflight&{error?:string});
   if(!response.ok)throw Error(data.error??"No current Ultra testnet quote");
   if(walletAddress){
    const inspected=data as ChainPreflight;
    setQuote(inspected.quote);setPreflight(inspected);
   }else setQuote(data as ChainQuote);
  }catch(e){setReadError(e instanceof Error?e.message:"Pool reading unavailable");}
  finally{setBusy(false);}
 }
 return <section aria-label="Read-only trading lab" style={{border:"1px solid #e6e4ec",borderRadius:15,padding:20,background:"#fdfcff",margin:"24px 0"}}>
  <div style={{display:"flex",alignItems:"center",gap:9}}>
   <ArrowRightLeft size={20}/><h2 style={{fontSize:20,margin:0}}>Trading simulation lab</h2>
  </div>
  <p style={{color:"#777",fontSize:12,lineHeight:1.6,margin:"10px 0 16px"}}>
   Compare hypothetical constant-product swaps and inspect <strong>read-only</strong> Ultra EVM testnet pools.
   No audited router, live trading, token spending, approvals or transaction signing is enabled.
  </p>
  <form onSubmit={simulate} style={{padding:15,border:"1px solid #ebe8f1",borderRadius:12,background:"#fff",display:"grid",gap:11}}>
   <div style={{display:"flex",alignItems:"center",gap:8}}><Calculator size={17}/><strong style={{fontSize:14}}>Hypothetical AMM simulator</strong></div>
   <p style={{margin:0,fontSize:11,color:"#8b8690"}}>Use your own example amounts and reserves in raw base units. These numbers are not observed market reserves or prices.</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
    <label style={{fontSize:12,fontWeight:700}}>Input amount (raw)
      <input required value={simAmount} inputMode="numeric" onChange={e=>setSimAmount(e.target.value)} style={fieldStyle}/></label>
    <label style={{fontSize:12,fontWeight:700}}>Reserve in (raw)
      <input required value={simIn} inputMode="numeric" onChange={e=>setSimIn(e.target.value)} style={fieldStyle}/></label>
    <label style={{fontSize:12,fontWeight:700}}>Reserve out (raw)
      <input required value={simOut} inputMode="numeric" onChange={e=>setSimOut(e.target.value)} style={fieldStyle}/></label>
    <label style={{fontSize:12,fontWeight:700}}>Assumed pool fee (bps)
      <input required value={simFee} inputMode="numeric" onChange={e=>setSimFee(e.target.value)} style={fieldStyle}/></label>
    <label style={{fontSize:12,fontWeight:700}}>Slippage (bps, max 500)
      <input required value={slippage} inputMode="numeric" onChange={e=>{setSlippage(e.target.value);setQuote(null);setPreflight(null);}} style={fieldStyle}/></label>
   </div>
   <button type="submit" className="subtle-cta"><Calculator size={15}/> Simulate without wallet</button>
   {simError&&<p role="alert" style={{fontSize:12,color:"#a92f49",margin:0}}>{simError}</p>}
   {sim&&<div role="status" style={{padding:13,borderRadius:9,background:"#f5f2fb",fontSize:12}}>
     <strong>Hypothetical output: {sim.expectedOut} raw units</strong>
     <p style={{margin:"7px 0"}}>Minimum after allowed slippage: {sim.minOut} · Estimated input fee: {sim.feeEstimateInRaw} raw units</p>
     <p style={{margin:"7px 0",color:sim.highImpact?"#ae3951":"#676271"}}>
       AMM price impact (excluding LP fee): {sim.priceImpactBps} bps {sim.highImpact?"· HIGH IMPACT":""}
     </p>
     <small>Not a real price, gas estimate, trade instruction or executable offer.</small>
   </div>}
  </form>
  <form onSubmit={e=>void inspect(e)} style={{padding:15,border:"1px solid #e9e6f1",borderRadius:12,background:"#fff",marginTop:14,display:"grid",gap:11}}>
   <div style={{display:"flex",alignItems:"center",gap:8}}><ShieldAlert size={17}/><strong style={{fontSize:14}}>Ultra testnet pool review (read-only)</strong></div>
   <p style={{fontSize:11,color:"#8b8690",margin:0}}>Requires a real operator-allowlisted, V2-compatible pool. Arbitrary user-provided pools are rejected. A pool allowlist alone does not prove that a venue is audited.</p>
   <label style={{fontSize:12,fontWeight:700}}>Approved pool contract address
     <input required value={pool} placeholder="0x…" onChange={e=>{setPool(e.target.value);setQuote(null);}} style={fieldStyle}/></label>
   <label style={{fontSize:12,fontWeight:700}}>Pool input-token address
     <input required value={tokenIn} placeholder="0x…" onChange={e=>{setTokenIn(e.target.value);setQuote(null);}} style={fieldStyle}/></label>
   <label style={{fontSize:12,fontWeight:700}}>Input amount in token raw base units
     <input required value={realAmount} placeholder="e.g. 1000000000000000000 for 1 token with 18 decimals"
       inputMode="numeric" onChange={e=>{setRealAmount(e.target.value);setQuote(null);}} style={fieldStyle}/></label>
   <button type="submit" className="subtle-cta" disabled={busy}>
     <RefreshCw size={14}/> {busy?"Reading pinned block…":"Inspect quote and preflight"}
   </button>
   <p style={{fontSize:11,color:"#86818f",margin:0}}>
    <Wallet size={13} style={{display:"inline"}}/> {walletAddress?
      "Connected EVM wallet supplied for public balance checks. No signatures are requested.":
      "Connect an Ultra EVM testnet wallet for optional public balance checks; quoting does not require login."}
   </p>
   {readError&&<p role="alert" style={{fontSize:12,color:"#b72c4d",margin:0}}>{readError}</p>}
   {quote&&<div role="status" style={{fontSize:12,padding:13,background:"#f6f5fa",borderRadius:9,overflowWrap:"anywhere"}}>
     <strong>Indicative quote at block {quote.observedBlock}</strong>
     <p style={{margin:"8px 0"}}>{rawText(quote.amountIn,quote.inputDecimals)} {quote.inputSymbol} → {rawText(quote.expectedOut,quote.outputDecimals)} {quote.outputSymbol}</p>
     <p style={{margin:"8px 0"}}>Minimum output: {rawText(quote.minOut,quote.outputDecimals)} {quote.outputSymbol} · Impact: {quote.priceImpactBps} bps {quote.highImpact?"(HIGH)":""}</p>
     <p style={{margin:"8px 0"}}>Fee assumption: {quote.feeBps} bps · Last reserve update: {quote.reserveAgeSeconds}s before observed block</p>
     <p style={{margin:"8px 0"}}>Expires: {new Date(quote.expiresAt).toLocaleTimeString()} · Quote already may be stale.</p>
     <small>{quote.verification}</small>
   </div>}
   {preflight&&<div style={{padding:12,border:"1px solid #eee",borderRadius:9,fontSize:12}}>
     <strong>Wallet and execution review</strong>
     <p style={{margin:"8px 0"}}>Input-token balance: {preflight.wallet?.tokenBalanceRaw??"not checked"} raw units ·
       Enough for input: {preflight.wallet?.tokenBalanceEnough?"yes":"no"}</p>
     <p style={{margin:"8px 0"}}>UOS balance: {preflight.wallet?.uosBalanceWei??"not checked"} wei ·
       Real swap gas requirement and allowance: <strong>unknown</strong></p>
     <p style={{color:"#a82e4e"}}>Execution disabled: no independently audited and deployed router, no verified calldata simulation or spending permissions.</p>
   </div>}
   <p style={{fontSize:11,color:"#8d536c",margin:0,lineHeight:1.5}}><Info size={14} style={{display:"inline",verticalAlign:"middle"}}/> All results are estimates, not guaranteed fills. No approval or swap button exists.</p>
  </form>
 </section>;
}
