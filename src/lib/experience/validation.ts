/** Looke M14 creation options. No token is deployable until pairing review. */
export const LOOKE_PAIR_CHOICES=["ULTRA","LOOKE"] as const;
export type LookePair=(typeof LOOKE_PAIR_CHOICES)[number];
export type QuickTokenDraft={name:string;symbol:string;pair:LookePair};
export function validateLookePair(input:unknown):LookePair{
  if(input!=="ULTRA"&&input!=="LOOKE")
    throw new Error("Only verified Ultra and Looke pair preferences are supported.");
  return input;
}
export function validateQuickTokenDraft(name:string,symbol:string,pair:unknown):QuickTokenDraft{
  const cleanName=name.trim(),cleanTicker=symbol.trim().toUpperCase();
  if(cleanName.length<2||cleanName.length>64||!/^[-\p{L}\p{N} ._]{2,64}$/u.test(cleanName))
    throw new Error("Token name must be 2–64 plain-text characters.");
  if(!/^[A-Z0-9]{2,12}$/.test(cleanTicker))
    throw new Error("Ticker must be 2–12 alphanumeric characters.");
  return {name:cleanName,symbol:cleanTicker,pair:validateLookePair(pair)};
}
export const LOOKE_NOTIFY_CATEGORIES=[
  "All","Subscriptions","Mentions","Trades","Comments","Follows","Other",
] as const;
export function safeSocialFilter(category:string):boolean{
  return LOOKE_NOTIFY_CATEGORIES.includes(category as (typeof LOOKE_NOTIFY_CATEGORIES)[number]);
}
