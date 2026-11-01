export function trustedVercelIp(headers: Headers, isVercelRuntime: boolean): string | null;
export function authIpBucketKey(secret: string, scope: "challenge" | "verify", ip: string): string;
