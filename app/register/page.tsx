import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession, POST_SIGNIN_URL } from "@/lib/auth/server";

import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  if (await getSession()) redirect(POST_SIGNIN_URL);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Choose a role to get started. You cannot change it later.</CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </main>
  );
}
