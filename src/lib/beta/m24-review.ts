import {z} from "zod";
import {M21_GATES,type M21Report} from "../ops/m21-acceptance";
import {uuid} from "../social/validation";
export const incidentSchema=z.object({
 action:z.literal("record_incident"),
 eventType:z.enum(["incident","rollback_rehearsal","recovery_observation"]),
 severity:z.enum(["info","low","medium","high","critical"]),
 observation:z.string().trim().min(20).max(1000),
 evidenceId:uuid.nullable().default(null),
}).strict();
export function m24IncidentWritesEnabled(){return process.env.LOOKE_M24_INCIDENT_WRITES_ENABLED==="true";}
export const requiredReleaseProofs=[
 "two_real_wallets_with_independent_human_witness",
 "genuine_hosted_media_provider_scan_and_moderation",
 "current_ultra_evm_creator_coin_receipt",
 "current_ultra_native_uniq_ownership",
 "complete_points_reconciliation_and_anti_sybil_review",
 "complete_postgres_backup_restore_hashes",
 "different_operator_witnessed_restore",
 "independent_security_audit_content_hash_and_signoff",
 "signed_out_preview_authentication_witness",
 "incident_drill_and_verified_rollback_procedure",
 "explicit_operator_public_beta_go_live_authorization",
] as const;
export type ReviewEvidenceStatus={realWallets:number;pointScanComplete:boolean;
 pointIssues:number;pendingMedia:number;openReports:number;criticalIncidents:number;
 restoreFullCompareVerified:boolean;auditorContentInspected:boolean};
export function launchReview(params:{m21:M21Report; evidence:ReviewEvidenceStatus;
 featureFlagsClosed:boolean}){
 if(params.m21.required!==M21_GATES.length||
  params.m21.checks.length!==M21_GATES.length ||
  new Set(params.m21.checks.map(x=>x.id)).size!==M21_GATES.length ||
  M21_GATES.some(id=>!params.m21.checks.some(x=>x.id===id)))
  throw Error("Full 18-gate security evidence is mandatory.");
 const details=requiredReleaseProofs.map(gate=>({gate,status:"blocked" as const,
  note:"External proof, independent content verification, or approved human signoff is not yet established by CI."}));
 return {
  milestone:"M24" as const,decision:"NO_GO" as const,publicBetaOpen:false as const,
  mayActivate:false as const,productionDeploymentAuthorized:false as const,
  financialBroadcastAuthorized:false as const,tokenClaimsAuthorized:false as const,
  messagingAuthorized:false as const,
  reviewGates:details,unverifiedM21Gates:params.m21.checks.filter(x=>x.status!=="verified").map(x=>x.id),
  featureFlagsClosed:params.featureFlagsClosed,
  sourceObservation:params.evidence,transactionsSent:0 as const,
  note:"This evidence readout has no release transition. Even signed references and matching database hashes cannot replace independent content review, human security approval and explicit authorization.",
 };
}
