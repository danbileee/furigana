import type { Route } from "./+types/home";
import { useLoaderData } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { UserSchema } from "~/schema/user";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Web Starterkit" },
    { name: "description", content: "Production-grade monorepo starter kit" },
  ];
}

export function loader(_: Route.LoaderArgs): { apiStatus: string } {
  return { apiStatus: "ok" };
}

export default function Home() {
  const { apiStatus } = useLoaderData<typeof loader>();

  const exampleUser = UserSchema.safeParse({
    id: "00000000-0000-0000-0000-000000000000",
    email: "hello@example.com",
    name: "Example User",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Web Starterkit</h1>
      <p className="max-w-md text-center text-gray-600">
        NestJS + React Router + TypeScript + Tailwind CSS + shadcn/ui
      </p>

      <div className="flex flex-wrap justify-center gap-4">
        <Card className="w-64">
          <CardHeader>
            <CardTitle>API Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`font-mono font-semibold ${apiStatus === "ok" ? "text-green-600" : "text-red-600"}`}
            >
              {apiStatus}
            </p>
          </CardContent>
        </Card>

        <Card className="w-64">
          <CardHeader>
            <CardTitle>Interface Schema</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm text-gray-600">
              {exampleUser.success ? "✓ Valid" : "✗ Invalid"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Button variant="outline">shadcn/ui Button</Button>
    </main>
  );
}
