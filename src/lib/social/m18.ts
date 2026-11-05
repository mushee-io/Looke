import {z} from "zod";
import {address,uuid} from "./validation";
import {HttpError} from "./auth";

/** Only explicitly enrolled moderator wallets may inspect unapproved content. */
export function assertModerator(actor:string) {
 const allowed=(process.env.LOOKE_SOCIAL_MODERATORS??"")
  .split(",").map(w=>w.trim().toLowerCase()).filter(Boolean);
 if(!allowed.includes(actor.toLowerCase()))throw new HttpError(403,"Moderator role required.");
}
export const preferences=z.object({
 follows:z.boolean(),comments:z.boolean(),likes:z.boolean(),reposts:z.boolean(),
}).strict();
export const controlWrite=z.discriminatedUnion("action",[
 z.object({action:z.literal("preferences"),preferences}),
 z.object({action:z.literal("mute"),target:address}),
 z.object({action:z.literal("unmute"),target:address}),
]);
export const reportDecision=z.object({
 action:z.literal("resolve_report"),
 reportId:uuid,
 decision:z.enum(["dismissed","actioned"]),
 explanation:z.string().trim().min(8).max(500),
}).strict();
export const discoverySort=z.enum(["recent","engaged"]);
