import "server-only";
import {probeProtectedStaging} from "./m10-protection";
/** Server-only release gate. No Vercel token or bypass cookie is returned to the browser. */
export async function protectedStagingForRelease():Promise<boolean>{
  if(process.env.LOOKE_PUBLIC_BETA_ENABLED!=="true")return false;
  const result=await probeProtectedStaging({
    vercelToken:process.env.VERCEL_TOKEN,
    deploymentUrl:process.env.LOOKE_M10_STAGING_URL,
    expectedRevision:process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M6_DEPLOY_REVISION,
  });
  return result.status==="verified" && result.signedOutChallengeVerified;
}
