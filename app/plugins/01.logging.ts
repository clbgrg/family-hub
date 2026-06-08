import type { LogLevel } from "consola";

import { defineNuxtPlugin } from "#app";
import { consola } from "consola";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const logLevel = config.public?.logLevel;

  consola.level = logLevel as unknown as LogLevel;

  consola.start(`Client log level configured to: ${logLevel}`);
});
