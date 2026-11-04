import { releaseControlsFromEnv,rollbackEnvironment } from "./policy";

export type Rehearsal = {
  simulated:true;remoteChanges:0;
  initialFlagsUnsafe:boolean;restoredFlagsSafe:boolean;
  stagingStillRequiresProtection:true;betaActivated:false;
  recommendedFlags:ReturnType<typeof rollbackEnvironment>;
};
export function rehearseRollback():Rehearsal {
  const initial={...rollbackEnvironment(),LOOKE_PUBLIC_BETA_ENABLED:"true",
    LOOKE_M4_TRADING_ENABLED:"true"};
  const flags=rollbackEnvironment();
  const initialFlagsUnsafe=!releaseControlsFromEnv(initial).safe;
  const restoredFlagsSafe=releaseControlsFromEnv(flags).safe;
  if(!initialFlagsUnsafe||!restoredFlagsSafe)throw new Error("Rollback rehearsal invariants failed.");
  return {simulated:true,remoteChanges:0,initialFlagsUnsafe,restoredFlagsSafe,
    stagingStillRequiresProtection:true,betaActivated:false,recommendedFlags:flags};
}
