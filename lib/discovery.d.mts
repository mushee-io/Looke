export type DiscoveryMode = "latest" | "trending" | "for-you" | "following";
export function checkedDiscoveryMode(value:unknown):DiscoveryMode;
export function normalizeDiscoveryQuery(raw:unknown):string;
export function discoveryScore(input:{likes?:number;comments?:number;reposts?:number;ageHours?:number;followed?:boolean}):number;
