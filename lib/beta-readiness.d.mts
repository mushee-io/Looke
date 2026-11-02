export const LOOKE_BETA_CHAIN_ID:18881;
export const BETA_REQUIRED_GATES:readonly {id:string;title:string;detail:string}[];
export function summarizeBetaReadiness(probe?:{chainId?:number;head?:bigint|number}|null):{
 milestone:"M22";title:string;network:string;chainId:18881;
 observation:{state:string;observedBlock:string|null;observedBlockFinal:false};
 mode:"preview_only";publicBetaOpen:false;protectedStagingAccepted:false;
 realUserWalletAcceptanceVerified:false;externalSecurityAuditAccepted:false;
 issuerOperational:false;nativeUniqAccepted:false;publicIssuanceEnabled:false;
 publicTradingEnabled:false;mainnetReady:false;approvalEligible:false;
 sourceModules:readonly {id:string;label:string;state:string}[];
 requiredGates:{id:string;title:string;detail:string;state:string}[];warning:string;
};
export function assessWalletObservation(input?:{chainId?:unknown;accounts?:unknown;connectedAddress?:unknown;sessionAddress?:unknown}):{
 chainIdExpected:18881;networkMatch:boolean;accountPresent:boolean;
 matchesConnectedWallet:boolean;matchesSignedInSession:boolean;
 observedAccount:string|null;status:string;
 walletControlCryptographicallyVerified:false;nativeWalletVerified:false;
 betaApproved:false;warning:string;
};