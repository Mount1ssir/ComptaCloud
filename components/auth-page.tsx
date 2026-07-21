"use client";

import { AppleIcon } from "@/components/apple-icon";
import { GithubIcon } from "@/components/github-icon";
import { GoogleIcon } from "@/components/google-icon";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { AuthDivider } from "@/components/auth-divider";
import { FloatingPaths } from "@/components/floating-paths";
import { AtSignIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AuthPage() {
	const supabase = createClient();

	const handleGoogleLogin = async () => {
		await supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo: `${location.origin}/auth/callback`,
				queryParams: {
					prompt: 'select_account',
				},
			},
		});
	};

	return (
		<main className="flex min-h-screen w-full flex-col md:flex-row m-0 p-0">
			<div className="relative hidden md:flex w-full md:w-1/2 flex-col border-e bg-secondary p-10 dark:bg-secondary/20">
				<div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background" />

				<div className="z-10 mt-auto">
					<blockquote className="space-y-2">
						<p className="text-xl">
							&ldquo;Empowering accounting firms to transition from manual data entry to high-value strategic advisory.&rdquo;
						</p>

					</blockquote>
				</div>
				<div className="absolute inset-0">
					<FloatingPaths position={1} />
					<FloatingPaths position={-1} />
				</div>
			</div>
			<div className="relative flex min-h-screen w-full md:w-1/2 flex-col justify-center px-8">
				{/* Top Shades */}
				<div
					aria-hidden
					className="absolute inset-0 isolate -z-10 opacity-60 contain-strict"
				>
					<div className="absolute top-0 end-0 h-320 w-140 -translate-y-87.5 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)]" />
					<div className="absolute top-0 end-0 h-320 w-60 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] [translate:5%_-50%]" />
					<div className="absolute top-0 end-0 h-320 w-60 -translate-y-87.5 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)]" />
				</div>

				<div className="mx-auto space-y-4 sm:w-sm">
					<Logo className="h-4.5 lg:hidden" />
					<div className="flex flex-col space-y-1">
						<h1 className="font-bold text-2xl tracking-wide">
							Sign In or Join Now!
						</h1>
						<p className="text-base text-muted-foreground">
							Login to access the accounting document management and client portal.
						</p>
					</div>
					<div className="space-y-2">
						<Button className="w-full" onClick={handleGoogleLogin}>
							<GoogleIcon data-icon="inline-start" />
							Continue with Google
						</Button>
						<Button className="w-full">
							<AppleIcon data-icon="inline-start" />
							Continue with Apple
						</Button>
						<Button className="w-full">
							<GithubIcon data-icon="inline-start" />
							Continue with GitHub
						</Button>
					</div>

					<AuthDivider>OR</AuthDivider>

					<form className="space-y-2">
						<p className="text-start text-muted-foreground text-xs">
							Enter your email address to sign in or create an account
						</p>
						<InputGroup>
							<InputGroupInput
								placeholder="your.email@example.com"
								type="email"
							/>
							<InputGroupAddon align="inline-start">
								<AtSignIcon
								/>
							</InputGroupAddon>
						</InputGroup>

						<Button className="w-full" type="button">
							Continue With Email
						</Button>
					</form>
					<p className="mt-8 text-muted-foreground text-sm">
						By clicking continue, you agree to our{" "}
						<a
							className="underline underline-offset-4 hover:text-primary"
							href="#"
						>
							Terms of Service
						</a>{" "}
						and{" "}
						<a
							className="underline underline-offset-4 hover:text-primary"
							href="#"
						>
							Privacy Policy
						</a>
						.
					</p>
				</div>
			</div>
		</main>
	);
}
