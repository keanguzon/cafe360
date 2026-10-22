import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";

export default function MainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return AuthenticatedLayout({ children, requireCircle: true });
}
