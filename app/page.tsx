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
            Local PostgreSQL, credentials authentication, and tests are wired up. Sign in as the seeded reviewer or owner account to see its role page.
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
