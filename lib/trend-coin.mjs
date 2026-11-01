import { encodeAbiParameters, keccak256, toBytes } from "viem";
import { normalizeCreatorCoinDraft } from "./creator-coin.mjs";

export const TREND_CHAIN_ID=18881;
export const TREND_MIN_POSTS=3;
export const TREND_MIN_AUTHORS=2;
export const TREND_MAX_NOMINATIONS_30D=3;
export const TREND_MAX_ENDORSEMENTS_24H=15;
const DOMAIN=keccak256(toBytes("looke.trend.v1"));
const RESERVED=new Set(["official","support","admin","looke","ultra","team","verified","system","governance"]);

export function normalizeTrendTopic(raw){
 if(typeof raw!=="string")throw new RangeError("Topic must be text");
 const topic=raw.trim().replace(/\s+/g," ").toLowerCase();
 if(topic.length<3 || topic.length>48 || !/^[a-z0-9]+(?:[ -][a-z0-9]+)*$/.test(topic))
   throw new RangeError("Topic needs 3–48 letters, numbers, spaces or hyphens");
 const slug=topic.replace(/[ -]+/g,"-");
 if(RESERVED.has(slug))throw new RangeError("Reserved trend topic");
 return {topic,slug};
}
export function normalizeTrendProposal(input){
 if(!input || typeof input!=="object" || Array.isArray(input))throw new RangeError("Invalid trend proposal");
 if(Object.keys(input).some(k=>!["topic","name","symbol","supplyTokens","metadataURI"].includes(k)))
   throw new RangeError("Unknown trend proposal field");
 const {topic,slug}=normalizeTrendTopic(input.topic);
 const {name,symbol,supplyTokens,metadataURI}=normalizeCreatorCoinDraft({
  name:input.name,symbol:input.symbol,
  supplyTokens:input.supplyTokens,metadataURI:input.metadataURI
 });
 return {topic,slug,name,symbol,supplyTokens,metadataURI};
}
export function trendReference(value){
 const {topic,slug}=normalizeTrendTopic(value);
 const topicHash=keccak256(toBytes(slug));
 const trendRef=keccak256(encodeAbiParameters(
  [{type:"bytes32"},{type:"uint256"},{type:"bytes32"}],
  [DOMAIN,BigInt(TREND_CHAIN_ID),topicHash]
 ));
 return {topic,slug,topicHash,trendRef,chainId:TREND_CHAIN_ID,kind:2,
   version:"looke.trend.v1"};
}
export function trendEvidenceEligible(posts,authors){
 return Number.isInteger(posts)&&Number.isInteger(authors)&&
   posts>=TREND_MIN_POSTS&&authors>=TREND_MIN_AUTHORS;
}
export function checkedTrendId(value){
 if(typeof value!=="string" ||
   !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value))
   throw new RangeError("Invalid trend proposal ID");
 return value.toLowerCase();
}
