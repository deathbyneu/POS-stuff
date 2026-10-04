import type { Metadata } from 'next';
import '@mantine/core/styles.css';
import './globals.css';
import { Providers } from '@/components/providers';
export const metadata: Metadata = {
  title: "EasyRetail · Quản lý bán hàng và tồn kho",
  description: "Hệ thống quản lý bán hàng, nhập hàng và tồn kho cho cửa hàng.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="vi"><body><Providers>{children}</Providers></body></html>; }
