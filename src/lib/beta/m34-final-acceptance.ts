/** M34 FINAL engineering acceptance: real read-only diagnostics, immutable NO-GO.
 * This report is not a human security audit, restored backup or beta authorization.
 */
import {createHash} from "node:crypto";
import {m30ReleaseFlagsClosed,M30_EXPECTED_PRODUCTION} from "./m30-operator-readiness";

export type M34GateId=
 |"release_flags_closed"|"ultra_evm_chain18881"|"ultra_native_testnet"
 |"current_postgres_19_table_schema"|"authenticated_cloudinary_prefix"
 |"media_post_mutations_closed"|"messaging_transport_closed"
 |"original_creator_coin_receipt"|"original_native_uniq_ownership"
 |"actual_wallet_nonce_and_replay_evidence"|"original_moderation_and_provider_records"
 |"complete_points_anti_sybil"|"separate_19_table_tls_restore"
 |"external_audit_and_finding_retests"|"independent_human_release_witnesses"
 |"independently_witnessed_rollback"|"production_alias_independently_checked";
export type M34Gate={id:M34GateId;status:"technical_verified"|"blocked";source:string;note:string;humanApproved:false};
export type M34Runtime={
 flags:Record<string,string|undefined>;
 live?:unknown;
 media?:unknown;messaging?:unknown;
 deploymentSha?:string;
 observedAt?:Date;
};
function obj(v:unknown):Record<string,unknown>{
 return v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
}
function int(v:unknown):boolean{
 return typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
}
export function assessM34Acceptance(input:M34Runtime){
 const observation=obj(input.live),evm=obj(observation.evm),
  native=obj(observation.native),pg=obj(observation.postgres),
  cloud=obj(observation.hostedMedia),media=obj(input.media),dm=obj(input.messaging);
 const actual=observation.milestone==="M33"&&observation.mode==="live"&&
   observation.liveRPCChecksPerformed===true&&
   observation.releaseDecision==="NO_GO"&&
   observation.publicBetaOpen===false;
 const flags=m30ReleaseFlagsClosed(input.flags)&&
   (input.live===undefined||observation.flagsClosed===true);
 const evmReal=actual&&evm.verified===true&&evm.chainId===18881&&
   typeof evm.latestBlock==="string"&&/^[1-9][0-9]*$/.test(evm.latestBlock);
 const nativeReal=actual&&native.verified===true&&int(native.irreversibleBlock)&&
   Number(native.irreversibleBlock)>0&&int(native.headBlock)&&
   Number(native.headBlock)>=Number(native.irreversibleBlock);
 const dbReal=actual&&pg.verified===true&&pg.status==="schema_verified_only"&&
   pg.currentTables===19&&pg.requiredTables===19;
 const providerReal=actual&&cloud.providerVerified===true&&
   cloud.status==="authenticated_prefix_search"&&
   int(cloud.matchingLookePrefixAssets)&&
   observation.cloudinaryAssetsQueried===true;
 const mediaClosed=media.enabled===false&&media.moderationRequired===true;
 const messagingClosed=dm.transport==="disabled"&&dm.messagesSent===0;
 const raw: Array<[M34GateId,boolean,string,string]>=[
  ["release_flags_closed",flags,"Preview environment","All public-beta, social, media, financial, Points and review-write flags are closed."],
  ["ultra_evm_chain18881",evmReal,"Actual Ultra EVM RPC","Observed an actual chain-18881 head; this is not a deployed creator coin."],
  ["ultra_native_testnet",nativeReal,"Actual Ultra native RPC","Observed actual irreversible block; this is not a user-owned Uniq proof."],
  ["current_postgres_19_table_schema",dbReal,"TLS PostgreSQL information_schema","All 19 current social tables found. Schema alone never authenticates users or backups."],
  ["authenticated_cloudinary_prefix",providerReal,"Authenticated Cloudinary Search API","Actual Looke-prefix aggregate observed; media ownership and moderation remain unverified."],
  ["media_post_mutations_closed",mediaClosed,"Actual media API GET","Media uploads remain disabled, with manual moderation required."],
  ["messaging_transport_closed",messagingClosed,"Actual messaging readiness API","Unreviewed E2EE and plaintext transport remain disabled."],
  ["original_creator_coin_receipt",false,"Canonical Ultra EVM CoinCreated receipt","Operator must independently submit original deployment and creation hashes for confirmation."],
  ["original_native_uniq_ownership",false,"Native Ultra irreversible owner/factory/token check","Original native account and token proof not submitted as part of this report."],
  ["actual_wallet_nonce_and_replay_evidence",false,"Signed wallet and consumed nonce ledger","Two genuine independently witnessed wallet signatures and consumed PostgreSQL nonces missing."],
  ["original_moderation_and_provider_records",false,"Actual moderated SQL/provider rows","Authenticated provider count does not establish actual approved original media."],
  ["complete_points_anti_sybil",false,"Original Points ledger and external review","Complete original source-backed reconciliation and anti-sybil human review missing."],
  ["separate_19_table_tls_restore",false,"Independent TLS backup restoration","Full original and independently restored 19-table row digests plus a human witness missing."],
  ["external_audit_and_finding_retests",false,"Original independent audit","Original security report bytes, human findings and independent retests are unavailable."],
  ["independent_human_release_witnesses",false,"Two real independent humans","No human release authorization inferred from configuration, CI or chain heads."],
  ["independently_witnessed_rollback",false,"Real protected rollback rehearsal","CI non-destructive rehearsal is NOT an independently witnessed production incident drill."],
  ["production_alias_independently_checked",false,"External Vercel alias control plane","The API cannot claim to have checked production DNS/alias assignment. Verify separately."],
 ];
 const gates:M34Gate[]=raw.map(([id,ok,source,note])=>({id,
  status:ok?"technical_verified":"blocked",source,
  note:ok?note:"BLOCKED: "+note,humanApproved:false}));
 const sha=typeof input.deploymentSha==="string"&&/^[0-9a-f]{40}$/.test(input.deploymentSha)?
  input.deploymentSha:null;
 const data={milestone:"M34_FINAL" as const,version:1 as const,
  observedAt:(input.observedAt??new Date()).toISOString(),deployedGitSha:sha,
  expectedProductionAliasDeployment:M30_EXPECTED_PRODUCTION,
  mode:actual?"genuine_read_only_diagnostics":"configuration_and_guard_only",
  liveSourcesQueried:actual,
  gates,technicalVerified:gates.filter(x=>x.status==="technical_verified").length,
  blocked:gates.filter(x=>x.status==="blocked").map(x=>x.id),
  originalHumanApprovals:0 as const,
  externalSecurityAuditApproved:false as const,
  independentRestoreAccepted:false as const,
  userWalletsSigned:0 as const,transactionsSent:0 as const,realPostsCreated:0 as const,
  databasesModified:0 as const,
  publicBetaOpen:false as const,socialWritesEnabled:false as const,
  mediaWritesEnabled:false as const,pointsClaimsEnabled:false as const,
  financialTradingEnabled:false as const,privateMessagingEnabled:false as const,
  releaseDecision:"NO_GO" as const,
 };
 const digest=createHash("sha256").update(JSON.stringify({
  version:data.version,sha:data.deployedGitSha,
  gates:data.gates.map(g=>[g.id,g.status]),decision:data.releaseDecision,
 })).digest("hex");
 return {...data,technicalEvidenceDigestSha256:digest,
  digestDoesNotConstituteSignedHumanApproval:true as const,
  note:"Source-backed technical checks only. The platform is NOT authorized for open beta or financial activity. Independent real-world acceptance remains blocked."};
}
