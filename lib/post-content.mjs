/** Validate text without silently changing authors' meaning or accepting control bytes. */
export function cleanPostText(input) {
  if(typeof input!=="string")throw new RangeError("Post must contain 1–1200 characters");
  const text=input.trim().replace(/\r\n?/g,"\n");
  if(!text || Array.from(text).length>1200 ||
     /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text))
    throw new RangeError("Post must contain 1–1200 characters without control characters");
  return text;
}
export const POST_REPORT_REASONS=Object.freeze(["spam","harassment","impersonation","illegal_content","other"]);
export function checkedReportReason(value) {
  if(typeof value!=="string" || !POST_REPORT_REASONS.includes(value))throw new RangeError("Invalid report reason");
  return value;
}
export function checkedPostUuid(value) {
  if(typeof value!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new RangeError("Invalid post ID");
  return value.toLowerCase();
}
