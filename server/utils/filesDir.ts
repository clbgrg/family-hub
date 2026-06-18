import { resolve } from "node:path";

/**
 * Where family documents live. In Docker this is the ./files bind mount;
 * FILES_DIR overrides it (e.g. a USB drive path on the Pi).
 */
export function filesDir(): string {
  // eslint-disable-next-line node/no-process-env -- deploy-time path switch; read here (not via useRuntimeConfig) so the util stays trivially testable
  return process.env.FILES_DIR || resolve(process.cwd(), "files");
}
