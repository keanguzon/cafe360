import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";

export default function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return AuthenticatedLayout({ children, requireCircle: false });
}
