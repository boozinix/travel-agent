import type { Metadata } from "next";
import "./globals.css";
import Link from 'next/link';

export const metadata: Metadata = {
  title: "Flight SMS Assistant",
  description: "Automated agent for booking flights via SMS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <nav style={{ borderBottom: '1px solid var(--card-border)', padding: '16px 24px', background: 'rgba(15, 17, 21, 0.9)' }}>
          <div className="container flex justify-between items-center" style={{ padding: 0 }}>
            <div>
              <Link href="/" style={{ color: 'white', fontWeight: 700, fontSize: '1.25rem' }}>
                ✈️ Flight-SMS
              </Link>
            </div>
            <div className="flex gap-4">
              <Link href="/schedules">Schedules</Link>
              <Link href="/preferences">Preferences</Link>
              <Link href="/conversations">Conversations</Link>
              <Link href="/chat" style={{ color: 'var(--brand-primary)', fontWeight: 'bold' }}>AI Agent</Link>
            </div>
          </div>
        </nav>
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
