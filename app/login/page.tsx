import { LoginForm } from "../../features/auth/LoginForm.tsx";

export default function LoginPage() {
  return (
    <main className="flex-1 bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <LoginForm />
    </main>
  );
}
