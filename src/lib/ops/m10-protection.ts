/**
 * M10 Vercel deployment protection proof.
 * Only reads the specifically named Looke staging project. Does not create
 * projects, enable deploys, change environment variables or generate bypass URLs.
 */
import {
  assessVercelProtection, EXPECTED_PROJECT, EXPECTED_VERCEL_TEAM,
  type VercelProject, type VercelEnvironmentVariable,
} from "./m9-vercel";

export type StagingProtectionProof = {
  status:"verified"|"blocked";
  metadataVerified:boolean;
  signedOutChallengeVerified:boolean;
  project:string;
  deploymentOrigin:string|null;
  checkedAt:string;
  reason:string;
  publicBetaOpen:false;
};

export function stagingUrl(raw:string):URL {
  const u=new URL(raw);
  if(u.protocol!=="https:"||u.username||u.password||u.port||
     u.pathname!=="/"||u.search||u.hash ||
     u.hostname==="vercel.app"||!u.hostname.endsWith(".vercel.app") ||
     !/^[a-z0-9.-]+$/.test(u.hostname)) {
    throw new Error("Protected staging must use a canonical HTTPS *.vercel.app origin.");
  }
  return u;
}

/** Accept only a real Vercel authentication challenge; 404 and ordinary app redirects are NOT protected. */
export function isAuthenticationChallenge(status:number,headers:Headers):boolean {
  if(status===401||status===403) {
    return Boolean(headers.get("x-vercel-id")) &&
      (/vercel/i.test(headers.get("server")||"") ||
       /vercel/i.test(headers.get("x-vercel-error")||"") ||
       /vercel/i.test(headers.get("www-authenticate")||""));
  }
  if(![301,302,303,307,308].includes(status))return false;
  const raw=headers.get("location");
  if(!raw)return false;
  try {
    const destination=new URL(raw);
    return destination.protocol==="https:"&&
      ["vercel.com","www.vercel.com"].includes(destination.hostname) &&
      /^\/(?:sso|login|authentication|api\/auth)(?:\/|\?|$)/i.test(destination.pathname);
  }catch{return false;}
}
type Fetcher = typeof fetch;
async function readJson<T>(url:string,token:string,fetcher:Fetcher):Promise<T>{
  const res=await fetcher(url,{method:"GET",redirect:"manual",cache:"no-store",
    headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
    signal:AbortSignal.timeout(8_000)});
  if(!res.ok)throw new Error(`Protected staging metadata unavailable (HTTP ${res.status}).`);
  return res.json() as Promise<T>;
}

export async function probeProtectedStaging(
  input:{vercelToken?:string;deploymentUrl?:string;expectedRevision?:string},
  fetcher:Fetcher=fetch,now=new Date(),
):Promise<StagingProtectionProof>{
  const failure=(reason:string):StagingProtectionProof=>({
    status:"blocked",metadataVerified:false,signedOutChallengeVerified:false,
    project:EXPECTED_PROJECT,deploymentOrigin:null,checkedAt:now.toISOString(),
    reason,publicBetaOpen:false,
  });
  if(!input.vercelToken || input.vercelToken.length<10)return failure("No authorized Vercel read-only credentials configured.");
  if(!input.deploymentUrl)return failure("No independently protected staging deployment URL is configured.");
  let url:URL;
  try{url=stagingUrl(input.deploymentUrl);}
  catch{return failure("Staging URL is not a canonical HTTPS Vercel deployment origin.");}
  const team=encodeURIComponent(EXPECTED_VERCEL_TEAM),project=encodeURIComponent(EXPECTED_PROJECT);
  try{
    const [metadata,variables]=await Promise.all([
      readJson<VercelProject>(`https://api.vercel.com/v10/projects/${project}?teamId=${team}`,input.vercelToken,fetcher),
      readJson<{envs?:VercelEnvironmentVariable[]}>(`https://api.vercel.com/v10/projects/${project}/env?teamId=${team}`,input.vercelToken,fetcher),
    ]);
    const config=assessVercelProtection(metadata,variables.envs??[]);
    if(config.status!=="verified-metadata") {
      return failure("Vercel project authentication, repository or safe environment settings unverified.");
    }
    // Never accept the authentication challenge of an unrelated Vercel app.
    // The exact URL must belong to a READY Preview deployment of the expected project
    // at the same immutable Git revision currently executing this release gate.
    const deployed = await readJson<{deployments?:Array<{
      url?:string;readyState?:string;target?:string;
      meta?:{githubCommitSha?:string};gitSource?:{sha?:string};
    }>}>(
      `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(metadata.id||"")}&teamId=${team}&limit=50`,
      input.vercelToken,fetcher,
    );
    if(!input.expectedRevision || !/^[0-9a-f]{40}$/i.test(input.expectedRevision)){
      return failure("Expected immutable deployed Git revision was not supplied.");
    }
    const deployedMatch = (deployed.deployments??[]).some(d=>
      d.url?.toLowerCase()===url.hostname &&
      d.readyState==="READY" && d.target==="preview" &&
      (d.meta?.githubCommitSha||d.gitSource?.sha)?.toLowerCase()===input.expectedRevision?.toLowerCase()
    );
    if(!deployedMatch){
      return failure("Signed-out URL is not a READY Preview deployment for the pinned Looke Git commit.");
    }
    const res=await fetcher(url.href,{method:"GET",redirect:"manual",cache:"no-store",
      headers:{Accept:"text/html"},signal:AbortSignal.timeout(8_000)});
    const protectedVisit=isAuthenticationChallenge(res.status,res.headers);
    return {
      status:protectedVisit?"verified":"blocked",
      metadataVerified:true,signedOutChallengeVerified:protectedVisit,
      project:EXPECTED_PROJECT,deploymentOrigin:url.origin,checkedAt:now.toISOString(),
      reason:protectedVisit?
        "Staging project, all-URL authentication, safe environment flags and signed-out challenge verified.":
        "Signed-out deployment did not return a verifiable Vercel authentication challenge.",
      publicBetaOpen:false,
    };
  }catch{
    return failure("Vercel metadata or signed-out staging response unavailable; release stays blocked.");
  }
}
