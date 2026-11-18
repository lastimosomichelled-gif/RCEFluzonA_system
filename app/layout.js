import './globals.css';
import RouteTransition from '@/components/RouteTransition';

export const metadata = { title: 'RCEF Monitoring' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><RouteTransition>{children}</RouteTransition></body>
    </html>
  );
}
