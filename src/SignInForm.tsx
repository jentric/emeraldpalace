"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{email?: string; password?: string; general?: string}>({});

  // Form validation
  const validateForm = (formData: FormData) => {
    const newErrors: {email?: string; password?: string; general?: string} = {};
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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

          const form = e.target as HTMLFormElement;
          const formData = new FormData(form);

          // Clear previous errors
          setErrors({});

          // Validate form
          if (!validateForm(formData)) {
            // Focus first error field
            const firstErrorField = form.querySelector('[aria-invalid="true"]') as HTMLElement;
            if (firstErrorField) {
              firstErrorField.focus();
            }
            return;
          }

          setSubmitting(true);
          formData.set("flow", mode === "signin" ? "signIn" : "signUp");

          void signIn("password", formData)
            .then(() => {
              setSubmitting(false);
              toast.success(mode === "signin" ? "Welcome back!" : "Account created successfully!");
            })
            .catch((error) => {
              setSubmitting(false);
              const errorMessage = error?.message || (mode === "signin" ? "Sign in failed" : "Sign up failed");
              setErrors({ general: errorMessage });
              toast.error(errorMessage);
            });
        }}
        noValidate
        aria-labelledby="auth-heading"
      >
        {/* General error message */}
        {errors.general && (
          <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200" role="alert" aria-live="assertive">
            <span className="text-sm text-red-600">{errors.general}</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="group relative">
            <input
              id="auth-email"
              className={`modern-input peer ${errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
              type="email"
              name="email"
              placeholder=" "
              required
              autoComplete="email"
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "email-error" : undefined}
              aria-label="Email address"
            />
            <label htmlFor="auth-email" className="floating-label">Email</label>
            {errors.email && (
              <div id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.email}
              </div>
            )}
          </div>

          <div className="group relative">
            <input
              id="auth-password"
              className={`modern-input peer pr-12 ${errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder=" "
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={errors.password ? "password-error" : "password-hint"}
              aria-label="Password"
            />
            <label htmlFor="auth-password" className="floating-label">Password</label>

            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute top-1/2 -translate-y-1/2 right-2 text-xs opacity-70 hover:opacity-100 transition-opacity p-1"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password text" : "Show password text"}
            >
              {showPassword ? "👁️‍🗨️" : "👁️"}
            </button>

            {errors.password && (
              <div id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.password}
              </div>
            )}

            {!errors.password && (
              <div id="password-hint" className="mt-1 text-xs opacity-60">
                Minimum 6 characters
              </div>
            )}
          </div>
        </div>
        <button
          className="modern-primary-btn w-full"
          type="submit"
          disabled={submitting}
          aria-describedby={submitting ? "submitting-status" : undefined}
        >
          {submitting ? (
            <>
              <span className="sr-only" id="submitting-status">
                {mode === "signin" ? "Signing you in, please wait" : "Creating your account, please wait"}
              </span>
              <span aria-hidden="true">
                {mode === "signin" ? "Signing in…" : "Creating…"}
              </span>
            </>
          ) : (
            mode === "signin" ? "Sign in" : "Sign up"
          )}
        </button>

        <div className="flex items-center gap-2 text-xs opacity-60" role="separator" aria-label="Alternative option divider">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-current to-transparent" aria-hidden="true" />
          <span>Or</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-current to-transparent" aria-hidden="true" />
        </div>

        <div className="text-center text-sm opacity-80">
          <span className="sr-only">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
          </span>
          <button
            type="button"
            onClick={() => {
              setMode(m => m === "signin" ? "signup" : "signin");
              setErrors({}); // Clear errors when switching modes
            }}
            className="font-medium underline hover:no-underline transition-all focus:outline-none focus:ring-2 focus:ring-white/30 rounded px-1"
            aria-label={mode === "signin" ? "Switch to sign up form" : "Switch to sign in form"}
          >
            {mode === "signin" ? "Create an account" : "Sign in instead"}
          </button>
        </div>
      </form>
    </div>
  );
}
