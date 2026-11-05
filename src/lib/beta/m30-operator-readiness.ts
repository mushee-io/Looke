/** M30 independently classified operator prerequisites.
 * Configuration is NOT evidence. No submitted status can authorize a release.
 * This module never exposes values of database passwords, API secrets or tokens.
 */
export const M30_EXPECTED_PRODUCTION="dpl_29EdVrfrJNTC5Q7gkZMcpaxLhQiG" as const;
export const M30_PROJECT_ID="prj_QXWBZ7UU1AtxXJ7XbckAwLrRZbdO" as const;
export const M30_CATEGORIES=[
 "wallet_sessions","hosted_media","creator_coin","native_uniq",
 "postgres_restore19","points_anti_sybil","security_audit","incident_rollback",
] as const;
export type M30Category=typeof M30_CATEGORIES[number];
export type M30Status="blocked_missing_prerequisite"|"blocked_unverified_external_evidence"|
 "read_only_technical_source_verified";
export type M30Step={id:M30Category;status:M30Status;reason:string;
 source:string;humanAcceptanceVerified:false};
export function m30ReleaseFlagsClosed(env:Record<string,string|undefined>){
 const flags=[
  "LOOKE_PUBLIC_BETA_ENABLED","LOOKE_M4_TRADING_ENABLED",
  "LOOKE_SOCIAL_WRITES_ENABLED","LOOKE_MEDIA_UPLOADS_ENABLED",
  "LOOKE_POINTS_ACCOUNTING_ENABLED","LOOKE_M20_INDEX_WRITES_ENABLED",
  "LOOKE_M23_ACCEPTANCE_WRITES_ENABLED","LOOKE_M24_INCIDENT_WRITES_ENABLED",
  "LOOKE_M25_REVIEW_WRITES_ENABLED","LOOKE_M26_WITNESS_WRITES_ENABLED",
  "LOOKE_M6_EVIDENCE_ENABLED",
 ];
 return flags.every(k=>env[k]!=="true")&&
  (!env.LOOKE_M4_MARKETS_JSON||env.LOOKE_M4_MARKETS_JSON==="[]");
}
const ready=(name:string,env:Record<string,string|undefined>)=>Boolean(env[name]?.trim());
export function m30ConfigPreflight(env:Record<string,string|undefined>){
 const keys=[
  "DATABASE_URL","LOOKE_M27_RESTORE_DATABASE_URL",
  "LOOKE_CLOUDINARY_CLOUD_NAME","LOOKE_CLOUDINARY_API_KEY",
  "LOOKE_CLOUDINARY_API_SECRET","LOOKE_M29_SECURITY_REVIEWERS",
  "LOOKE_M29_OPERATOR_REVIEWERS","VERCEL_TOKEN",
  "LOOKE_M23_PREVIEW_ORIGIN",
 ];
 const available=Object.fromEntries(keys.map(key=>[key,ready(key,env)])) as Record<string,boolean>;
 const missing=keys.filter(key=>!available[key]);
 const origins=env.LOOKE_M23_PREVIEW_ORIGIN;
 const commit=env.VERCEL_GIT_COMMIT_SHA||env.LOOKE_M23_PREVIEW_SHA;
 const identityValid=Boolean(origins&&/^https:\/\/[^/?#]+$/.test(origins)&&
  new URL(origins).origin===origins&&commit&&/^[a-f0-9]{40}$/.test(commit));
 const flagsClosed=m30ReleaseFlagsClosed(env);
 return {milestone:"M30" as const,readOnly:true as const,
  exposedCredentialValues:false as const,credentialPresence:available,
  missingEnvironmentKeys:missing,exactImmutablePreviewIdentityConfigured:identityValid,
  releaseFlagsClosed:flagsClosed,
  canQueryExistingPostgreSQL:available.DATABASE_URL,
  canAttemptRealProviderInspection:available.DATABASE_URL&&
   available.LOOKE_CLOUDINARY_CLOUD_NAME&&available.LOOKE_CLOUDINARY_API_KEY&&
   available.LOOKE_CLOUDINARY_API_SECRET,
  canAttemptSeparateTLSRecovery:available.DATABASE_URL&&available.LOOKE_M27_RESTORE_DATABASE_URL,
  canAttemptIndependentSignedFileVerification:
   available.LOOKE_M29_SECURITY_REVIEWERS&&available.LOOKE_M29_OPERATOR_REVIEWERS,
  proofOfRealHumanIndependence:false as const,
  independentSecurityAuditApproved:false as const,
  actualRestorationWitnessAccepted:false as const,
  launchDecision:"NO_GO" as const,
 };
}
export type M30Observation=Partial<Record<M30Category,{observed:boolean;
 sourceVerified:boolean;reason?:string}>>;
export function m30AcceptanceReport(
 env:Record<string,string|undefined>,observations:M30Observation={}
){
 const configuration=m30ConfigPreflight(env);
 const prerequisite:Record<M30Category,boolean>={
  wallet_sessions:configuration.canQueryExistingPostgreSQL,
  hosted_media:configuration.canAttemptRealProviderInspection,
  creator_coin:true,native_uniq:true,
  postgres_restore19:configuration.canAttemptSeparateTLSRecovery,
  points_anti_sybil:configuration.canQueryExistingPostgreSQL,
  security_audit:configuration.canQueryExistingPostgreSQL&&
    configuration.canAttemptIndependentSignedFileVerification,
  incident_rollback:configuration.credentialPresence.VERCEL_TOKEN,
 };
 const labels:Record<M30Category,string>={
  wallet_sessions:"Two original PostgreSQL-consumed wallet challenges and independent observer keys",
  hosted_media:"Real moderated uploads compared to authenticated Cloudinary source",
  creator_coin:"Canonical Ultra EVM 18881 CoinCreated receipt and deployed token",
  native_uniq:"Actual irreversible native Uniq factory, token and owner",
  postgres_restore19:"Original and separately restored TLS PostgreSQL full nineteen-table row/schema digest",
  points_anti_sybil:"Complete approved Points sources and separate human anti-sybil investigation",
  security_audit:"Original security report bytes, two signed references and independent finding retest",
  incident_rollback:"Pinned Vercel production alias GET plus independently witnessed incident drill",
 };
 const steps:M30Step[]=M30_CATEGORIES.map(id=>{
  const check=observations[id];
  const ok=check?.observed===true&&check.sourceVerified===true&&prerequisite[id];
  return {id,status:!prerequisite[id]?"blocked_missing_prerequisite":
    ok?"read_only_technical_source_verified":"blocked_unverified_external_evidence",
   reason:!prerequisite[id]?"Required independently controlled source or credentials are not configured.":
    check?.reason??"Actual independently sourced input has not been supplied and checked.",
   source:labels[id],humanAcceptanceVerified:false};
 });
 return {milestone:"M30" as const,readOnly:true as const,configuration,
  steps,technicallyVerifiedCount:steps.filter(s=>s.status==="read_only_technical_source_verified").length,
  humanAcceptanceVerifiedCount:0 as const,
  distinctRealHumanWitnessesAccepted:false as const,
  externalAuditorFindingsApproved:false as const,
  operatorAndSecurityReleaseSignoffAccepted:false as const,
  publicBetaOpen:false as const,productionPromotionAllowed:false as const,
  socialMediaWritesAllowed:false as const,pointsAccountingAllowed:false as const,
  tokenMintOrClaimAllowed:false as const,financialBroadcastAllowed:false as const,
  privateMessagingAllowed:false as const,
  transactionsSent:0 as const,releaseDecision:"NO_GO" as const,
  note:"Source inspection and configured secrets never establish independent humans, audit remediation, legitimate backup provenance or a final release authorization.",
 };
}
