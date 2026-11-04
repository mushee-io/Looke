/**
 * Run one READ-ONLY M11 acceptance session.
 * No token creation, NFT mint, V2 trade execution, wallet approval or deploy.
 */
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {collectLiveRpcEvidence} from "../src/lib/ops/m8-probe";
import {probeUltraLiquidity} from "../src/lib/ops/m9-liquidity";
import {probeProtectedStaging} from "../src/lib/ops/m10-protection";
import {inspectEvmFactory,inspectEvmCoin,inspectNativeUniq} from "../src/lib/beta/acceptance";
import {verifyNativeMint,validateNativeMintManifest} from "../src/lib/ops/m11-native";
import {validateTradeSubmissions,verifySubmittedSwap} from "../src/lib/ops/m11-trades";
import {inspectSocialOperations} from "../src/lib/ops/m11-social";
import {rehearseRollback} from "../src/lib/ops/m8-rollback";
import {createM11Report,m11Finding,type M11Finding} from "../src/lib/ops/m11-report";
import {parseProofManifest} from "../src/lib/ops/acceptance";

type Manifest={
  evmFactory?:unknown;creatorCoin?:unknown;nativeUniq?:unknown;
  nativeMint?:unknown;trades?:unknown;
};
async function receiptState(raw:Manifest|null) {
  const good={factory:false,coin:false,uniqOwner:false,uniqMint:false,buy:false,sell:false};
  if(!raw)return good;
  // User-supplied public proof references ONLY. Never create fallback demo transactions.
  let p:ReturnType<typeof parseProofManifest>;
  try{p=parseProofManifest(raw);}
  catch{return good;}
  try{const x=await inspectEvmFactory(p.evmFactory.address,p.evmFactory.deploymentTx);
    good.factory=x.confirmations>=2;
  }catch{/* no verified deployment */}
  try{const x=await inspectEvmCoin(p.evmFactory.address,p.creatorCoin.creationTx);
    good.coin=x.confirmations>=2&&BigInt(x.totalSupply)>0n;
  }catch{/* no verified coin */}
  try{const x=await inspectNativeUniq(p.nativeUniq.factoryId,p.nativeUniq.owner,p.nativeUniq.tokenId);
    good.uniqOwner=x.irreversibleBlock>0;
  }catch{/* no verified owner */}
  if(raw.nativeMint){
    try{
      const x=await verifyNativeMint(validateNativeMintManifest(raw.nativeMint));
      good.uniqMint=x.status==="verified"&&x.factoryId===p.nativeUniq.factoryId &&
        x.owner===p.nativeUniq.owner&&x.tokenId===p.nativeUniq.tokenId;
    }catch{/* no executed native mint trace */}
  }
  if(raw.trades){
    try{
      const trades=validateTradeSubmissions(raw.trades);
      for(const t of trades){
        const receipt=await verifySubmittedSwap(t);
        if(receipt.status==="verified"){
          if(t.direction==="buy")good.buy=true;
          if(t.direction==="sell")good.sell=true;
        }
      }
    }catch{good.buy=false;good.sell=false;}
  }
  return good;
}
async function main(){
  const file=process.argv[2]&&!process.argv[2].startsWith("--")?process.argv[2]:undefined;
  const raw=file?JSON.parse(await readFile(file,"utf8")) as Manifest:null;
  const [network,pools,stage,social,receipts]=await Promise.all([
    collectLiveRpcEvidence(),probeUltraLiquidity(),probeProtectedStaging({
      vercelToken:process.env.VERCEL_TOKEN,
      deploymentUrl:process.env.LOOKE_M10_STAGING_URL,
      expectedRevision:process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M6_DEPLOY_REVISION,
    }),inspectSocialOperations(),receiptState(raw),
  ]);
  const rollback=rehearseRollback();
  const findings:M11Finding[]=[
    m11Finding("protectedVercelStaging",stage.status==="verified","Actual authenticated staging deployment observed.","No verified protected staging project and signed-out access challenge."),
    m11Finding("ultraEvmReadOnlyRpc",network.evm.status==="verified","Actual Ultra EVM head confirmed.","Ultra EVM Testnet head unavailable."),
    m11Finding("ultraNativeReadOnlyRpc",network.native.status==="verified","Actual Ultra native irreversible ledger confirmed.","Ultra native chain unavailable."),
    m11Finding("creatorFactoryReceipt",receipts.factory,"Real EVM factory creation receipt and code verified.","No actual wallet-signed factory transaction receipt supplied."),
    m11Finding("creatorCoinReceipt",receipts.coin,"Real CoinCreated event/signer/balance verified.","No real creator coin creation receipt supplied."),
    m11Finding("nativeUniqIssueReceipt",receipts.uniqMint,"Real Ultra native issue.b execution and current ownership verified.","No verifiable executed issue.b history trace supplied."),
    m11Finding("nativeUniqOwnerLedger",receipts.uniqOwner,"Current owner-scoped native Uniq row and factory verified.","No real owner/factory/token row supplied."),
    m11Finding("realBuySwapReceipt",receipts.buy,"Real BUY router calldata, pair event and token transfer verified.","No real wallet-sent BUY receipt supplied."),
    m11Finding("realSellSwapReceipt",receipts.sell,"Real SELL router calldata, pair event and token transfer verified.","No real wallet-sent SELL receipt supplied."),
    m11Finding("fundedReviewedV2Pool",pools.allVerified,"Real V2 pool bytecode and nonzero two-sided reserves observed; security review separate.","No approved, funded real V2 Testnet pool."),
    m11Finding("socialDatabaseTLSAndRole",social.status==="verified","Actual TLS-backed schema and non-superuser Postgres role checked.","Staging TLS database, schema or least-privilege role unavailable."),
    m11Finding("independentWalletWitness",false,"","Actual witness review of EVM/native wallets and explicit user approval missing."),
    m11Finding("independentSecurityReview",false,"","Independent contract/security audit and review record missing."),
    m11Finding("backupAndRestoreDrill",false,"","Real operator-performed Postgres backup restoration not evidenced."),
    m11Finding("operatorReleaseAuthorization",false,"","Human operator release signoff and deployment-specific signature not verified."),
    m11Finding("rollbackSafety",rollback.restoredFlagsSafe,"In-memory fail-closed rollback flags verified; remote rollback still needs rehearsal.","Fail-closed rollback configuration check did not pass."),
  ];
  const report=createM11Report(findings);
  await mkdir("artifacts/m11",{recursive:true});
  await writeFile("artifacts/m11/acceptance.json",
    JSON.stringify({report,network,pools,stage,social,receipts},null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify({milestone:report.milestone,status:report.status,
    verified:report.verified,total:report.required,blocked:report.blocked,
    note:"artifact: artifacts/m11/acceptance.json; no transactions were signed/broadcast."},null,2));
  if(process.argv.includes("--strict")&&report.status==="blocked")process.exitCode=2;
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=2;});
