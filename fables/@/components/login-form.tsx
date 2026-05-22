import { type ComponentProps, useState } from "react";
import { cn } from "@/lib/utils";

import { supabase } from "../../src/supabase";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LoginFormProps = ComponentProps<"div">;

async function signInWithDiscord() {
  const redirectTo = `${window.location.origin}/dashboard`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo,
    },
  });

  if (error) {
    console.error("Discord sign-in error:", error);
    throw new Error(error.message);
  }

  return data;
}

export function LoginForm({ className, ...props }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleDiscordSignIn() {
    try {
      setError(null);
      setIsLoading(true);

      await signInWithDiscord();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to sign in with Discord"
      );

      setIsLoading(false);
    }
  }

  return (
    <div
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <Card className="mt-10 w-full bg-taupe-200">
        <CardHeader>
          <CardTitle className="text-xl font-bold">
            Login to your account
          </CardTitle>

          <CardDescription className="text-black">
          I proudly only set up one way to log into this app. If you want more, submit a formal request.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Button
            type="button"
            onClick={handleDiscordSignIn}
            disabled={isLoading}
            className="w-full bg-red-600 text-white hover:bg-red-700"
          >
            {isLoading ? "Signing in..." : "Log in with Discord"}
          </Button>

          {error && (
            <div className="mt-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}