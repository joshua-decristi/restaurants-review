import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/domains/users/server";

import { LogoutButton } from "./logout-button";

export default async function ProtectedPage() {
  const user = await requireUser();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Protected</CardTitle>
          <CardDescription>Only signed-in users can see this page.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
        </CardContent>
        <CardFooter className="justify-end">
          <LogoutButton />
        </CardFooter>
      </Card>
    </main>
  );
}
