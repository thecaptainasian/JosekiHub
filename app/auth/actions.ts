"use server";

import { redirect } from "next/navigation";
import type { AuthActionState } from "./form-state";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthCallbackUrl,
  hasSupabaseEnv,
} from "@/lib/supabase/env";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MISSING_ENV_MESSAGE =
  "Supabase is not configured yet. Copy .env.example to .env.local and add your project values.";

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!hasSupabaseEnv()) {
    return {
      message: MISSING_ENV_MESSAGE,
      status: "error",
    };
  }

  const credentials = readCredentials(formData);

  if ("status" in credentials) {
    return credentials;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return {
      message: error.message,
      status: "error",
    };
  }

  redirect("/");
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!hasSupabaseEnv()) {
    return {
      message: MISSING_ENV_MESSAGE,
      status: "error",
    };
  }

  const credentials = readCredentials(formData);

  if ("status" in credentials) {
    return credentials;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    options: {
      emailRedirectTo: getAuthCallbackUrl("/"),
    },
  });

  if (error) {
    return {
      message: error.message,
      status: "error",
    };
  }

  if (data.session) {
    redirect("/");
  }

  return {
    message: "Check your email for the confirmation link, then come back and sign in.",
    status: "success",
  };
}

export async function signOutAction() {
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/auth");
}

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fieldErrors: NonNullable<AuthActionState["fieldErrors"]> = {};

  if (!email) {
    fieldErrors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (!password) {
    fieldErrors.password = "Password is required.";
  } else if (password.length < 6) {
    fieldErrors.password = "Password must be at least 6 characters.";
  }

  if (fieldErrors.email || fieldErrors.password) {
    return {
      fieldErrors,
      message: "Please fix the highlighted fields.",
      status: "error",
    } satisfies AuthActionState;
  }

  return {
    email,
    password,
  };
}
