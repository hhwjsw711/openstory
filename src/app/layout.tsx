import type { Metadata } from "next";
import { AppLayout } from "@/components/layout";
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
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
};

export default RootLayout;
