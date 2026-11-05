/** M22 protected-beta go/no-go. Test fixtures and unverified documents are never approvals. */
import {M21_GATES,type M21GateId,type M21Report} from "../ops/m21-acceptance";
export const REQUIRED_RELEASE_EVIDENCE=[
 "realWitnessWithOneTimeNonce",
 "twoWalletIsolation",
 "hostedMediaProviderAndModeration",
 "currentCreatorTokenAndUniqProofs",
 "pointsLedgerAndAntiAbuse",
 "restoredDatabaseOperatorWitness",
 "signedOutPreviewChallenge",
 "independentSecurityReview",
 "explicitOperatorGoLiveAuthorization",
] as const;
export type M22ReleaseEvidence=typeof REQUIRED_RELEASE_EVIDENCE[number];
export type M22Blocker={id:M22ReleaseEvidence|M21GateId;reason:string};
export function deriveM22Readiness(input:{
 m21:M21Report;
 flagsClosed:boolean;
 restoredDbIndependentlySignedOff?:boolean;
 humanSignedBetaAuthorization?:boolean;
}){
 if(input.m21.required!==M21_GATES.length||
  new Set(input.m21.checks.map(x=>x.id)).size!==M21_GATES.length||
  M21_GATES.some(x=>!input.m21.checks.some(y=>y.id===x)))
  throw Error("Incomplete M21 audit. Cannot evaluate public beta.");
 const failed=input.m21.checks.filter(c=>c.status!=="verified")
  .map(c=>({id:c.id,reason:c.reason}));
 // These are independent operational witnesses. A boolean submitted by a browser
 // is never a release instruction. This helper cannot activate anything.
 const required: M22Blocker[]=[
  {id:"realWitnessWithOneTimeNonce",reason:"No independently issued, one-use, human-witnessed real wallet session recorded."},
  {id:"twoWalletIsolation",reason:"Independent distinct-wallet isolation witness has not been approved."},
  {id:"hostedMediaProviderAndModeration",reason:"Live media scan, approved hosting access and moderation have not all been signed off."},
  {id:"currentCreatorTokenAndUniqProofs",reason:"Creator token receipts and native Uniq ownership must be individually reverified."},
  {id:"pointsLedgerAndAntiAbuse",reason:"No independent reward policy and cross-wallet sybil assessment accepted."},
  {id:"restoredDatabaseOperatorWitness",reason:"No independently witnessed TLS backup/restore drill approved."},
  {id:"signedOutPreviewChallenge",reason:"Browser-level protected Preview challenge needs external confirmation."},
  {id:"independentSecurityReview",reason:"Independent security review and signed audit have not been accepted."},
  {id:"explicitOperatorGoLiveAuthorization",reason:"An authorized human beta launch decision has not been recorded."},
 ];
 return {
  milestone:"M22" as const,releaseDecision:"NO_GO" as const,
  publicBetaOpen:false as const,mayActivate:false as const,
  financialTransactionsEnabled:false as const,pointsClaimsEnabled:false as const,
  privateMessagingEnabled:false as const,
  flagsClosed:input.flagsClosed,
  m21Verified:input.m21.verified,m21Total:input.m21.required,
  m21Unverified:failed,
  requiredWitnesses:required,
  blockers:failed.length+required.length+(input.flagsClosed?0:1),
  note:"Preview build and tests are engineering acceptance only. This endpoint has no ability to grant beta permission, create users/tokens, mark audits complete, or toggle a release flag.",
 };
}
