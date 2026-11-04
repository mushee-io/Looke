import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Looke | Create on Ultra",
  description: "Looke is building an Ultra-native home for creator coins, Uniq NFTs and communities.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
