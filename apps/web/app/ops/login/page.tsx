import { redirect } from "next/navigation";

export default function LegacyOperatorLoginPage() {
  redirect("/login?next=/ops");
}
