import { redirect } from "next/navigation";

import { getSession } from "@/domains/users/server";

/** Disposable proof page: shows only the session user's email and role. */
export default async function ReviewerPage() {
  const session = await getSession();

  // Logged out users redirect to login
  if (!session) redirect("/login");

  // Non-reviewers are redirected to home page
  if (session.user.role !== "reviewer") redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <section className="w-full max-w-sm space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Reviewer</h1>
        <p className="text-sm text-muted-foreground">Signed in as {session.user.email}</p>
        <p className="text-sm text-muted-foreground">Role: {session.user.role}</p>
      </section>
    </main>
  );
}
