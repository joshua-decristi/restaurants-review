import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Boilerplate ready</CardTitle>
          <CardDescription>The application shell is running on shadcn/ui primitives.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Local PostgreSQL, credentials authentication, and tests are wired up. Sign in as the seeded development user to see the protected page.
          </p>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/protected">Protected page</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
