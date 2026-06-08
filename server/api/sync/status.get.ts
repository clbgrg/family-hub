import { consola } from "consola";
import { createError, defineEventHandler } from "h3";

import { syncManager } from "../../plugins/02.syncManager";

export default defineEventHandler(async () => {
  try {
    const status = {
      connectedClients: syncManager.getConnectedClientsCount(),
      activeSyncIntervals: syncManager.getActiveSyncIntervals(),
      timestamp: new Date(),
    };

    return status;
  }
  catch (error) {
    consola.error("Sync Status: Error getting sync status:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to get sync status",
    });
  }
});
