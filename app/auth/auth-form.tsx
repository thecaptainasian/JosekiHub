"use client";

import { useActionState } from "react";
import {
  initialAuthActionState,
  type AuthActionState,
} from "./form-state";

type AuthFormAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

interface AuthFormProps {
  action: AuthFormAction;
  description?: string;
  helperText?: string;
  idPrefix: string;
  passwordAutoComplete: "current-password" | "new-password";
  submitLabel: string;
  title: string;
}

export default function AuthForm({
  action,
  description,
  helperText,
  idPrefix,
  passwordAutoComplete,
  submitLabel,
  title,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialAuthActionState,
  );
  const emailErrorId = `${idPrefix}-email-error`;
  const passwordErrorId = `${idPrefix}-password-error`;

  return (
    <section className="auth-form-card">
      <div className="auth-form-heading">
        <h2 className="auth-form-title">{title}</h2>
        {description ? <p className="auth-form-note">{description}</p> : null}
      </div>

      <form action={formAction} className="auth-form">
        <label className="field-group" htmlFor={`${idPrefix}-email`}>
          <span className="field-label">Email</span>
          <input
            id={`${idPrefix}-email`}
            name="email"
            type="email"
            autoComplete="email"
            className="auth-input"
            placeholder="you@example.com"
            aria-describedby={
              state?.fieldErrors?.email ? emailErrorId : undefined
            }
            aria-invalid={state?.fieldErrors?.email ? true : undefined}
            required
          />
        </label>
        {state?.fieldErrors?.email ? (
          <p id={emailErrorId} className="field-error">
            {state.fieldErrors.email}
          </p>
        ) : null}

        <label className="field-group" htmlFor={`${idPrefix}-password`}>
          <span className="field-label">Password</span>
          <input
            id={`${idPrefix}-password`}
            name="password"
            type="password"
            autoComplete={passwordAutoComplete}
            className="auth-input"
            placeholder="At least 6 characters"
            minLength={6}
            aria-describedby={
              state?.fieldErrors?.password ? passwordErrorId : undefined
            }
            aria-invalid={state?.fieldErrors?.password ? true : undefined}
            required
          />
        </label>
        {state?.fieldErrors?.password ? (
          <p id={passwordErrorId} className="field-error">
            {state.fieldErrors.password}
          </p>
        ) : null}

        {state?.message ? (
          <p
            className="auth-status"
            data-tone={state.status ?? "error"}
            aria-live="polite"
          >
            {state.message}
          </p>
        ) : null}

        {helperText ? <p className="auth-footnote">{helperText}</p> : null}

        <button
          type="submit"
          className="control-button primary auth-submit"
          disabled={pending}
        >
          {pending ? "Working..." : submitLabel}
        </button>
      </form>
    </section>
  );
}
