import { resolve } from "node:path";

/**
 * Where screensaver photos live. In Docker this is the ./photos bind mount;
 * PHOTOS_DIR overrides it (e.g. a USB drive path on the Pi).
 */
export function photosDir(): string {
  // eslint-disable-next-line node/no-process-env -- deploy-time path switch; read here (not via useRuntimeConfig) so the util stays trivially testable
  return process.env.PHOTOS_DIR || resolve(process.cwd(), "photos");
}
