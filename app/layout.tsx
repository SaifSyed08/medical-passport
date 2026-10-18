import type { Metadata } from "next";
import "./passport.css";

export const metadata: Metadata = {
  title: "Tessera",
  description: "Your essential health information, beautifully together. An interactive demo.",
  icons: {
    icon: "/passport.svg",
    shortcut: "/passport.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
