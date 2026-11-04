/**
 * Pure validation of live Vercel project metadata. Does NOT create, alter,
 * deploy or remove protection. A metadata pass is not a signed-out access test.
 */
export const EXPECTED_VERCEL_TEAM="team_sUozs2OsaXlQcWcxyIjWzmRw";
export const EXPECTED_PROJECT="looke-ultra-staging";
export const DISABLED_FLAGS=[
  "LOOKE_PUBLIC_BETA_ENABLED","LOOKE_M4_TRADING_ENABLED",
  "LOOKE_SOCIAL_WRITES_ENABLED","LOOKE_M6_EVIDENCE_ENABLED",
] as const;
type Target="preview"|"production";
export type VercelProject={name?:string;id?:string;link?:{repo?:string;type?:string};
  ssoProtection?:{deploymentType?:string};previewDeploymentsDisabled?:boolean};
export type VercelEnvironmentVariable={key?:string;target?:Target|Target[];value?:string};
export type VercelProtectionReport={
  status:"verified-metadata"|"blocked";
  projectIdentity:boolean;authAllUrls:boolean;
  gitLinked:boolean;disabledReleaseFlags:boolean;
  signedOutBrowserChecked:false;
  reasons:string[];
};

export function assessVercelProtection(
 project:VercelProject|null,envs:VercelEnvironmentVariable[],
):VercelProtectionReport{
  const reasons:string[]=[];
  const projectIdentity=project?.name===EXPECTED_PROJECT&&typeof project.id==="string"&&project.id.length>0;
  if(!projectIdentity)reasons.push("Dedicated Looke staging project identity not confirmed.");
  const authAllUrls=project?.ssoProtection?.deploymentType==="all";
  if(!authAllUrls)reasons.push("Vercel Authentication is not enabled on ALL deployment URLs.");
  const gitLinked=project?.link?.repo==="mushee-io/looke" &&
    ["github","github-limited"].includes(project?.link?.type??"");
  if(!gitLinked)reasons.push("Staging project is not linked to the expected Looke GitHub repository.");
  if(project?.previewDeploymentsDisabled===true)reasons.push("Preview deployments are disabled for this project.");
  let disabledReleaseFlags=true;
  for(const target of ["preview","production"] as const) {
    for(const key of [...DISABLED_FLAGS,"LOOKE_M4_MARKETS_JSON"]){
      const matches=envs.filter(x=>x.key===key&&(Array.isArray(x.target)?x.target.includes(target):x.target===target));
      const expected=key==="LOOKE_M4_MARKETS_JSON"?"[]":"false";
      if(matches.length!==1||matches[0].value!==expected){
        disabledReleaseFlags=false;
        reasons.push(`${target} / ${key} not confirmed with a safe exact value.`);
      }
    }
  }
  const complete=projectIdentity&&authAllUrls&&gitLinked&&!project?.previewDeploymentsDisabled&&disabledReleaseFlags;
  return {status:complete?"verified-metadata":"blocked",projectIdentity,
    authAllUrls,gitLinked,disabledReleaseFlags,signedOutBrowserChecked:false,reasons};
}
