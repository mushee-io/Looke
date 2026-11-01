import type { Metadata } from "next";
import "./globals.css";
import "./m2-accessibility.css";

export const metadata: Metadata = {
  title: "Looke — Create. Collect. Trade. On Ultra.",
  description: "Looke is an Ultra-native social trading and Uniq NFT experience. Early product preview; no live trading.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
