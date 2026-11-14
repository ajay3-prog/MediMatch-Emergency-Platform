import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MEDIMATCH – Intelligent Emergency Coordination Platform",
  description: "Real-World Emergency Command & Control and Dynamic Resource Allocation Platform (Hyderabad 108 Services)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-[#F4F7FB] text-[#0F172A] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
