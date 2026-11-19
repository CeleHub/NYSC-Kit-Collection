import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0c1a13",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "NYSC Camp Kit Collection & Verification Portal",
  description: "Official National Youth Service Corps Camp Kit Collection, Document Verification & Exeat Management System",
  icons: {
    icon: "/assets/NYSC_LOGO.svg",
    apple: "/assets/NYSC_LOGO.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-[#0c1a13] text-slate-100">
        {children}
      </body>
    </html>
  );
}
