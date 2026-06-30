"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useWallet } from "@/components/wallet/WalletProvider";

function shortenAddress(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

interface NavbarProps {
  showLinks?: boolean;
}

export default function Navbar({ showLinks = false }: NavbarProps) {
  const { isConnected, isConnecting, address, connect, disconnect, connectionError, supabaseUser, signInWithGoogle, signOutGoogle } = useWallet();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const navLinks = [
    { label: "How it works", id: "how-it-works" },
    { label: "Safety", id: "trust" },
    { label: "Roadmap", id: "roadmap" },
    { label: "FAQ", id: "faq" },
  ];

  return (
    <nav className={`navbar${scrolled ? " scrolled" : ""}`}>
      <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        
        {/* Left Section: Logo & Hamburger */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {showLinks && isMobile && (
            <button
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              style={{ background: "none", border: "none", color: "var(--muted-fg)", padding: "0.25rem", marginLeft: "-0.25rem", cursor: "pointer", display: "flex" }}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {mobileMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </>
                ) : (
                  <>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                  </>
                )}
              </svg>
            </button>
          )}

          <Link href="/" style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "var(--text-base)",
            fontWeight: 700,
            letterSpacing: "-0.05em",
          }}>
            <Image src="/brand/favicon.svg" alt="sangam logo" width={28} height={28} />
            sangam.
          </Link>
        </div>

        {/* Center Section: Desktop Nav Links */}
        {showLinks && !isMobile && (
          <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                style={{
                  background: "none", border: "none",
                  fontSize: "var(--text-sm)",
                  color: "var(--muted-fg)", cursor: "pointer", padding: 0,
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fg)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted-fg)")}
              >
                {link.label}
              </button>
            ))}
          </div>
        )}

        {/* Right Section: Wallet */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {isConnected && address ? (
            <>
              {!supabaseUser ? (
                <button
                  onClick={() => signInWithGoogle()}
                  className="btn btn-primary"
                  style={{ fontSize: "var(--text-sm)", padding: "0.375rem 0.875rem" }}
                >
                  Link Google
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {supabaseUser.user_metadata?.avatar_url && (
                    <img
                      src={supabaseUser.user_metadata.avatar_url}
                      alt="avatar"
                      style={{ width: 28, height: 28, borderRadius: "50%" }}
                    />
                  )}
                  {!isMobile && (
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--fg)", fontWeight: 600 }}>
                      {supabaseUser.user_metadata?.full_name?.split(" ")[0] || "User"}
                    </span>
                  )}
                </div>
              )}
              
              {!isMobile && (
                <span style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--muted-fg)",
                  fontFamily: "var(--font-mono)",
                  marginLeft: "0.5rem"
                }}>
                  {shortenAddress(address)}
                </span>
              )}
              <button
                onClick={() => { disconnect(); signOutGoogle(); }}
                className="btn btn-outline"
                style={{ fontSize: "var(--text-sm)", padding: "0.375rem 0.875rem" }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={() => connect()}
              disabled={isConnecting}
              className="btn btn-primary"
              style={{ fontSize: "var(--text-sm)", padding: "0.375rem 0.875rem" }}
            >
              {isConnecting ? "Opening wallet…" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {showLinks && isMobile && mobileMenuOpen && (
        <div 
          style={{ 
            position: "absolute", 
            top: "60px", 
            left: 0, 
            right: 0, 
            padding: "1rem", 
            display: "flex",
            flexDirection: "column", 
            gap: "1rem", 
            background: "var(--bg)", 
            borderBottom: "1px solid var(--border)",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
          }}
        >
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => {
                setMobileMenuOpen(false);
                scrollTo(link.id);
              }}
              style={{ 
                textAlign: "left", 
                fontSize: "var(--text-sm)", 
                padding: "0.5rem 0",
                color: "var(--muted-fg)", 
                background: "none", 
                border: "none", 
                width: "100%",
                cursor: "pointer",
                display: "block"
              }}
            >
              {link.label}
            </button>
          ))}
        </div>
      )}

      {connectionError && connectionError !== dismissedError && (
        <div style={{
          position: "absolute",
          top: "60px",
          left: 0,
          right: 0,
          background: "#fef2f2",
          borderBottom: "1px solid #fecaca",
          padding: "0.75rem 1.5rem",
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          fontSize: "var(--text-sm)",
          color: "#dc2626",
          zIndex: 49,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: "1px" }}>
            <circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5"/>
            <path d="M8 5v3M8 10.5v.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ flex: 1, lineHeight: "var(--leading-normal)" }}>{connectionError}</span>
          <button
            aria-label="Dismiss error"
            onClick={() => setDismissedError(connectionError)}
            style={{ background: "none", border: "none", color: "#dc2626", padding: 0, cursor: "pointer", flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}
    </nav>
  );
}
