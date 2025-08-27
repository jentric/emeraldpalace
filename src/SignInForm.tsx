"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-md mx-auto space-y-8">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-semibold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="text-sm text-slate-500">
          {mode === "signin" ? "Sign in to continue your journey." : "Join to start saving your memories."}
        </p>
      </div>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (submitting) return;
          setSubmitting(true);
          const form = e.target as HTMLFormElement;
          const formData = new FormData(form);
          formData.set("flow", mode === "signin" ? "signIn" : "signUp");
          void signIn("password", formData)
            .then(() => { setSubmitting(false); })
            .catch(() => {
              toast.error(mode === "signin" ? "Sign in failed" : "Sign up failed");
              setSubmitting(false);
            });
        }}
      >
        <div className="space-y-4">
          <div className="group relative">
            <input
              id="auth-email"
              className="modern-input peer"
              type="email"
              name="email"
              placeholder=" "
              required
              autoComplete="email"
            />
            <label htmlFor="auth-email" className="floating-label">Email</label>
          </div>
          <div className="group relative">
            <input
              id="auth-password"
              className="modern-input peer pr-12"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder=" "
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
            />
            <label htmlFor="auth-password" className="floating-label">Password</label>
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute top-1/2 -translate-y-1/2 right-2 text-xs text-slate-500 hover:text-slate-700"
              tabIndex={-1}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <button
          className="modern-primary-btn w-full"
          type="submit"
          disabled={submitting}
        >
          {submitting ? (mode === "signin" ? "Signing in…" : "Creating…") : (mode === "signin" ? "Sign in" : "Sign up")}
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          <span>Or</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </div>
        <div className="text-center text-sm text-slate-600">
          {mode === "signin" ? "No account yet?" : "Already registered?"}{" "}
          <button
            type="button"
            onClick={() => setMode(m => m === "signin" ? "signup" : "signin")}
            className="font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
