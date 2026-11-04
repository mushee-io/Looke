/**
 * M15: hosted media is allowed only from an operator-owned HTTPS CDN.
 * No uploads, arbitrary URL fetching, remote transcodes, or unmoderated feeds.
 */
export type MediaKind="image"|"video";
export type MediaReference={url:string;kind:MediaKind};
const EXTENSIONS:Record<MediaKind,RegExp>={
 image:/\.(?:png|jpg|jpeg|webp|gif)$/i,
 video:/\.(?:mp4|webm)$/i,
};
export function trustedMediaHosts(input:string|undefined):string[]{
  return (input??"").split(",").map(h=>h.trim().toLowerCase()).filter(h=>
    /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(h)&&
    !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(h)&&
    !h.endsWith(".localhost")&&!h.endsWith(".internal")&&
    !/^\d+\.\d+\.\d+\.\d+$/.test(h)
  );
}
export function validatePublishedMedia(media:MediaReference|null,allowedHosts:string[]):MediaReference|null{
  if(media===null)return null;
  if(!allowedHosts.length)throw new Error("Media hosting is not configured. No media will be published.");
  if(media.url.length>800)throw new Error("Media URL is too long.");
  let u:URL;
  try{u=new URL(media.url);}catch{throw new Error("Invalid media URL.");}
  if(u.protocol!=="https:"||u.username||u.password||u.port||u.search||u.hash||
    !allowedHosts.includes(u.hostname.toLowerCase()))
    throw new Error("Media must use a trusted HTTPS hosting domain without credentials, query or fragments.");
  if(!EXTENSIONS[media.kind]?.test(u.pathname))
    throw new Error("Media URL extension does not match the selected image or video type.");
  return {url:u.href,kind:media.kind};
}
export function visibleApprovedMedia(row:{media_url:string|null;media_kind:string|null;media_status:string}):
  MediaReference|null{
  if(row.media_status!=="approved"||!row.media_url||
    (row.media_kind!=="image"&&row.media_kind!=="video"))return null;
  try{
    const u=new URL(row.media_url);
    if(u.protocol!=="https:"||u.username||u.password||u.port||u.search||u.hash||
      !EXTENSIONS[row.media_kind].test(u.pathname))return null;
    return {url:u.href,kind:row.media_kind};
  }catch{return null;}
}
