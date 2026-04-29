import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in — Career Autopilot' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            We will email you a magic link.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
