/** Print a release-only message for an authorized EVM wallet to sign, never signs for the user. */
import { releaseText } from "../src/lib/beta/policy";
const revision=process.argv[2]||"";
const expiresAt=process.argv[3]||"";
try {
  const now=Date.now(),expiry=Date.parse(expiresAt);
  if(!Number.isFinite(expiry)||expiry<=now||expiry>now+24*3600_000)throw new Error("Expiry must be within the next 24 hours.");
  process.stdout.write(releaseText(revision,expiresAt)+"\n");
  process.stdout.write("\nNo wallet was contacted and no transaction was signed.\n");
}catch(error){
  console.error(error instanceof Error?error.message:error);
  process.exitCode=1;
}
