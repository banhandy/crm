import './globals.css';
import { ThemeProvider } from '../components/theme-provider';

export const metadata = {
  title: 'ZAP CRM — Inquiry & Visit Management',
  description: 'Precision engineering CRM for managing inquiries, quotations, customer visits and meeting minutes.',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
