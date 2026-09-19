import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/providers';
import Navbar from '@/components/navbar';

export const metadata: Metadata = {
  title: 'ApplyFeed — Multi-Email Job Email Aggregator',
  description: 'Aggregate and filter job-related emails from multiple Gmail and Microsoft Outlook accounts in one inbox.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-blue-600 selection:text-white">
        <Providers>
          <Navbar />
          <main className="flex-1 w-full">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
