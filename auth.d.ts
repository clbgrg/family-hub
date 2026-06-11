// Augment nuxt-auth-utils session types with our user shape.
// Single-tenant: one family per deployment, so no familyId — just role.
// NOTE: these MUST stay `interface` — module augmentation merges interfaces;
// `type` aliases shadow instead of merge and break every #auth-utils consumer.
/* eslint-disable ts/consistent-type-definitions */
declare module "#auth-utils" {
  interface User {
    id: string;
    name: string;
    role: "ADMIN" | "MEMBER";
  }

  interface UserSession {
    // Epoch ms until which this session may perform admin mutations without
    // re-entering a PIN ("parent unlock"). Absent/past = not elevated.
    elevatedUntil?: number;
  }

  interface SecureSessionData {
    // no server-only secrets stored in the session for now
  }
}

export {};
