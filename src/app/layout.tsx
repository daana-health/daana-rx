import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import './globals.css';
import { ColorSchemeScript } from '@mantine/core';
import { Providers } from '../components/Providers';

export const metadata = {
  title: 'DaanaRX - Medication Tracking System',
  description: 'HIPAA-compliant medication tracking for non-profit clinics',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
