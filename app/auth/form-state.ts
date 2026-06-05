export type AuthActionState = {
  fieldErrors?: {
    email?: string;
    password?: string;
  };
  message?: string;
  status?: "error" | "success";
};

export const initialAuthActionState: AuthActionState = {};
