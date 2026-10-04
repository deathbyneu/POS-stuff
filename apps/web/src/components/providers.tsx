"use client";
import { MantineProvider, createTheme } from "@mantine/core";
const theme = createTheme({
  primaryColor: "blue",
  fontFamily: "Arial, Helvetica, sans-serif",
  defaultRadius: "md",
});
export function Providers({ children }: { children: React.ReactNode }) {
  return <MantineProvider theme={theme}>{children}</MantineProvider>;
}
