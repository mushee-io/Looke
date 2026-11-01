import type { Metadata } from "next";
import { CreatorPublicProfile } from "@/components/CreatorPublicProfile";
import { canonicalCreatorHandle } from "@/lib/creator-profile.mjs";
import { notFound } from "next/navigation";
import "./creator-page.css";

export const metadata: Metadata = {
  title: "Creators | Looke on Ultra",
  description: "Discover real creator profiles and public social posts on Looke, built for Ultra.",
};
export default async function CreatorPage({params}:{params:Promise<{handle:string}>}) {
  const handle=canonicalCreatorHandle((await params).handle);
  if(!handle)notFound();
  return <CreatorPublicProfile handle={handle}/>;
}
