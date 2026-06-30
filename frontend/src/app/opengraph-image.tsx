import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'sangam. — Rotating Savings on Stellar';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ background: '#fafafa', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 180, fontWeight: 700, letterSpacing: '-0.06em', color: '#0f0f0f', lineHeight: 1 }}>sangam.</div>
        <div style={{ fontSize: 36, color: '#71717a', marginTop: 32, letterSpacing: '-0.02em' }}>Rotating savings on Stellar.</div>
        <div style={{ fontSize: 36, color: '#71717a', letterSpacing: '-0.02em' }}>A smart contract holds the pot, not a person.</div>
      </div>
    ),
    size
  );
}
