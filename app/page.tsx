import { NavbarVariantSwitcher } from "@/components/NavbarVariantSwitcher";

export const metadata = {
  title: "App Router",
};

export default function Page() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-[#22070B]">App Router</h1>
      <NavbarVariantSwitcher />
    </div>
  );
}
