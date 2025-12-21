import './globals.css';

export const metadata = {
  title: 'Zadoox',
  description: 'AI-powered documentation platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

