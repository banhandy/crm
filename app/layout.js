import './globals.css';
import { ThemeProvider } from '../components/theme-provider';

export const metadata = {
  title: 'CRM - Inquiry Handling System',
  description: 'A premium dashboard to manage corporate inquiries, quotation records, and client follow-ups.',
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
