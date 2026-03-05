import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Intervu | AI Technical Interview Simulator',
  description: 'Master your next technical round with a stone-faced AI mentor. High-fidelity voice agent and detailed assessment reports.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body suppressHydrationWarning={true} className="...">
        {children}
      </body>
    </html>
  );
}