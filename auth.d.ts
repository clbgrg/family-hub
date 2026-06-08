// Augment nuxt-auth-utils session types with our user shape.
// Single-tenant: one family per deployment, so no familyId — just role.
declare module "#auth-utils" {
  interface User {
    id: string;
    name: string;
    role: "ADMIN" | "MEMBER";
  }

  interface UserSession {
    // default fields only; everything we need lives on `user`
  }

  interface SecureSessionData {
    // no server-only secrets stored in the session for now
  }
}

export {};
