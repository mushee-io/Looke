const UUID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const BLOCKED=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
export function checkedSocialUuid(raw) {
 if(typeof raw!=="string"||!UUID.test(raw))throw new RangeError("Invalid identifier");
 return raw.toLowerCase();
}
export function cleanComment(input) {
 if(typeof input!=="string")throw new RangeError("Comment must be text");
 const text=input.trim().replace(/\r\n?/g,"\n");
 if(!text || Array.from(text).length>500 || BLOCKED.test(text))throw new RangeError("Comment must be 1–500 valid characters");
 return text;
}
export function sharePostPath(id) {
 return "/#post-"+checkedSocialUuid(id);
}
