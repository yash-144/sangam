import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { WalletProvider } from "@/components/wallet/WalletProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "chitfund. — Trustless Rotating Savings",
  description: "A smart contract holds the money. Not a person. Trustless chit funds on Stellar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={inter.variable}
      suppressHydrationWarning
    >
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
