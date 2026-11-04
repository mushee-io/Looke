import type {RpcEvidence} from "./m8-probe";
import type {DbAudit} from "./m8-db-audit";

export type Alert = {code:string;severity:"critical"|"warning";message:string};
export function evaluateAlerts(
  rpc:RpcEvidence|null,db:DbAudit|null,stagingProtected:boolean,
):Alert[] {
  const alerts:Alert[]=[];
  if(!stagingProtected)alerts.push({code:"STAGING_UNPROTECTED",severity:"critical",
    message:"Protected preview deployment has not been independently verified; do not distribute a staging URL."});
  if(!rpc)alerts.push({code:"RPC_UNCHECKED",severity:"critical",
    message:"No real RPC evidence artifact was produced."});
  else {
    if(rpc.evm.status!=="verified")alerts.push({code:"EVM_BLOCKED",severity:"critical",
      message:"Ultra EVM chain 18881 has no fresh verified head evidence."});
    if(rpc.native.status!=="verified")alerts.push({code:"NATIVE_BLOCKED",severity:"critical",
      message:"Ultra native Testnet has no verified chain/irreversible ledger observation."});
  }
  if(!db)alerts.push({code:"SOCIAL_DB_UNVERIFIED",severity:"warning",
    message:"No real PostgreSQL schema/TLS operational audit completed."});
  else if(db.status!=="verified")alerts.push({code:"SOCIAL_DB_BLOCKED",severity:"critical",
    message:"PostgreSQL read-only schema/connection audit failed."});
  return alerts;
}
export function githubAnnotations(alerts:Alert[]):string[] {
  // No secrets, addresses, or user-supplied raw message data enter annotations.
  return alerts.map(x=>`::${x.severity==="critical"?"error":"warning"} title=Looke M8 ${x.code}::${x.message}`);
}
