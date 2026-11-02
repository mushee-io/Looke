/**
 * M22 public beta readiness policy. Source implementation / RPC reachability
 * MUST NOT become a financial launch switch, audit attestation, or proof of
 * real-wallet acceptance. Deliberately no override/enable parameter exists.
 */
export const LOOKE_BETA_CHAIN_ID = 18881;
export const BETA_REQUIRED_GATES = Object.freeze([
  {id:"protected_staging",title:"Protected deployment and isolated database",
   detail:"Independent HTTPS staging access and multi-account database session acceptance required."},
  {id:"real_wallet_evidence",title:"Actual EVM and native wallet acceptance",
   detail:"Record genuine user-approved EVM login, account/network-change checks and separate native wallet observations."},
  {id:"factory_provenance",title:"Audited factory, attestor and source provenance",
   detail:"Independent security audit and approved attestor custody, then separately verified deployed runtime code."},
  {id:"signed_testnet_receipts",title:"Externally signed Testnet transactions",
   detail:"Verify real Ultra EVM deployment/issuance receipts across two RPCs and a third independent explorer."},
  {id:"native_uniq_verification",title:"Native Ultra Uniq test acceptance",
   detail:"Native account and independently verified Uniq actions require a separate chain-specific sign-off."},
  {id:"trading_and_economics",title:"Trading and issuance safety",
   detail:"Audited router, liquidity, gas/allowance simulation, economic controls and explicit release authorization."}
]);
const sourceModules=Object.freeze([
 {id:"wallet",label:"Ultra EVM wallet connection",state:"source_available"},
 {id:"social",label:"Signed social login and posting",state:"staging_unverified"},
 {id:"portfolio",label:"Ultra EVM balances and native Uniq holdings",state:"read_only_sources"},
 {id:"creator",label:"Creator and post-linked coin proposals",state:"drafts_only"},
 {id:"uniq",label:"Native Uniq preparation and discovery",state:"read_only_and_drafts"},
 {id:"issuance",label:"Onchain coin issuance",state:"disabled"},
 {id:"trading",label:"Onchain trading and NFT purchases",state:"disabled"}
]);
export function summarizeBetaReadiness(probe){
 const valid=!!probe && probe.chainId===LOOKE_BETA_CHAIN_ID &&
   (typeof probe.head==="bigint"||Number.isSafeInteger(probe.head)) &&
   BigInt(probe.head)>0n;
 const observation=valid?
   {state:"rpc_reachable",observedBlock:String(probe.head),observedBlockFinal:false}:
   {state:"unavailable_or_wrong_chain",observedBlock:null,observedBlockFinal:false};
 return {
  milestone:"M22",
  title:"Controlled Ultra Testnet beta readiness",
  network:"Ultra EVM Testnet",
  chainId:LOOKE_BETA_CHAIN_ID,
  observation,
  mode:"preview_only",
  publicBetaOpen:false,
  protectedStagingAccepted:false,
  realUserWalletAcceptanceVerified:false,
  externalSecurityAuditAccepted:false,
  issuerOperational:false,
  nativeUniqAccepted:false,
  publicIssuanceEnabled:false,
  publicTradingEnabled:false,
  mainnetReady:false,
  approvalEligible:false,
  sourceModules,
  requiredGates:BETA_REQUIRED_GATES.map(gate=>({...gate,state:"external_evidence_required"})),
  warning:"This page reports source capabilities and one RPC observation only. No real user wallet, signed receipt, audit or release approval is inferred."
 };
}
const EVM_ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const CHAIN_HEX="0x"+LOOKE_BETA_CHAIN_ID.toString(16);
export function assessWalletObservation({chainId,accounts,connectedAddress,sessionAddress}={}){
 const validAccounts=Array.isArray(accounts)&&accounts.length>0&&
   accounts.every(a=>typeof a==="string"&&EVM_ADDRESS.test(a));
 const wallet=validAccounts?accounts[0].toLowerCase():null;
 const connected=typeof connectedAddress==="string"&&EVM_ADDRESS.test(connectedAddress)?
   connectedAddress.toLowerCase():null;
 const session=typeof sessionAddress==="string"&&EVM_ADDRESS.test(sessionAddress)?
   sessionAddress.toLowerCase():null;
 const networkMatch=chainId===CHAIN_HEX;
 const match=networkMatch&&!!wallet&&!!connected&&wallet===connected;
 const accountMatchesSession=!!session&&!!wallet&&wallet===session&&match;
 return {
  chainIdExpected:LOOKE_BETA_CHAIN_ID,
  networkMatch,
  accountPresent:!!wallet,
  matchesConnectedWallet:!!match,
  matchesSignedInSession:accountMatchesSession,
  observedAccount:match?wallet:null,
  status:!networkMatch?"wrong_network":!match?"reconnect_required":
    !session?"login_required":!accountMatchesSession?"session_wallet_mismatch":"session_matches_wallet",
  walletControlCryptographicallyVerified:false,
  nativeWalletVerified:false,
  betaApproved:false,
  warning:"eth_accounts and chainId are wallet-provider observations, not a new wallet signature or financial authorization."
 };
}
