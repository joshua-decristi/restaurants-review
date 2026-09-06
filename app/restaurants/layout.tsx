import Link from "next/link";

import { logoutAction } from "@/app/login/login-action";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/server";

/** Restaurant-scoped chrome: role-aware nav + logout; pages supply the body. */
export default async function RestaurantsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const role = session?.user.role;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link href="/restaurants" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
            Restaurants
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {!session ? (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Register</Link>
                </Button>
              </>
            ) : null}

            {role === "reviewer" ? (
              <>
                <span className="text-sm text-muted-foreground">{session?.user.name ?? "Reviewer"}</span>
                <form action={logoutAction}>
                  <Button type="submit" variant="outline" size="sm">
                    Logout
                  </Button>
                </form>
              </>
            ) : null}

            {role === "owner" ? (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href="/owner/restaurants">Owner dashboard</Link>
                </Button>
                <form action={logoutAction}>
                  <Button type="submit" variant="outline" size="sm">
                    Logout
                  </Button>
                </form>
              </>
            ) : null}
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}
