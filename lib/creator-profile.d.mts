export type NormalizedCreatorProfile = {handle:string;displayName:string;bio:string};
export function canonicalCreatorHandle(value:unknown):string|null;
export function normalizeCreatorProfile(data:unknown):NormalizedCreatorProfile;
export function creatorProfilePath(handle:unknown):string;
