import type { Metadata } from 'next';
import './globals.css';
import React from 'react';
import { ReactQueryProvider } from '@/app/components/ReactQueryProvider';

export const metadata: Metadata = {
  title: 'GATE CSE Question Bank',
  description: 'Practice GATE CSE PYQs with advanced filters & mocks',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50">
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </body>
    </html>
  );
}
