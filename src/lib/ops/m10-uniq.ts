import {positiveId,type UniqToken} from "../ultra-native";
import type {TablePage} from "../ultra-native-rpc";

/**
 * A native token.b table read must be scoped to the claimed owner and use
 * lower_bound equal to the requested token ID with limit=1.
 * No ownership is inferred from a factory listing or a public profile.
 */
export function verifiedTargetUniq(
  page:TablePage<UniqToken>,tokenId:string,factoryId:string,
):UniqToken {
  const id=positiveId(tokenId),factory=positiveId(factoryId);
  if(!Number.isSafeInteger(page.irreversibleBlock)||page.irreversibleBlock<=0){
    throw new Error("Uniq ownership read has no irreversible ledger evidence.");
  }
  if(page.rows.length!==1 || page.rows[0]?.id!==id ||
     page.rows[0]?.token_factory_id!==factory){
    throw new Error("The targeted Uniq is not present in the claimed owner's native token table.");
  }
  return page.rows[0];
}
