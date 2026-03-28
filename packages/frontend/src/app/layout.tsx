import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Daily Race',
  description: 'Gamificacion de la daily standup con tematica F1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
