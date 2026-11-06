import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Your Yoto Library",
  description: "Build and manage Yoto MYO card playlists",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
