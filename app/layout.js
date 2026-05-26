import './globals.css';

export const metadata = {
  title: 'CRM - Inquiry Handling System',
  description: 'A premium dashboard to manage corporate inquiries, quotation records, and client follow-ups.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
