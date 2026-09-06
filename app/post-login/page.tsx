import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/server";

export default async function PostLoginPage() {
  const session = await getSession();

  switch (session?.user.role) {
    case "reviewer":
      redirect("/reviewer");
    case "owner":
      redirect("/owner/restaurants");
  }

  redirect("/login");
}
