import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/wallet/WalletProvider";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chit — Trustless Group Savings",
  description: "Save together. Win together. A trustless group savings pool built on Stellar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
