import type { Metadata } from "next";
import "./global.css";

export const metadata: Metadata = {
  title: "Velro - AI-Powered Video Sequence Creation",
  description:
    "Transform scripts into consistent, styled video productions using multiple AI models.",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-background">{children}</main>
      </body>
    </html>
  );
};

export default RootLayout;
