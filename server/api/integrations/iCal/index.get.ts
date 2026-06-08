import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

import { ICalServerService } from "../../../integrations/iCal/client";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const integrationId = getQuery(event).integrationId as string;
  const baseUrl = getQuery(event).baseUrl as string;

  if (!integrationId || typeof integrationId !== "string") {
    throw createError({
      statusCode: 400,
      message: "integrationId is required",
    });
  }

  let integration;
  let icalUrl: string;

  if (integrationId === "temp" || integrationId.startsWith("temp-")) {
    if (!baseUrl || typeof baseUrl !== "string") {
      throw createError({
        statusCode: 400,
        message: "baseUrl is required for temporary integration testing",
      });
    }
    icalUrl = baseUrl;
  }
  else {
    integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        type: "calendar",
        service: "iCal",
        enabled: true,
      },
    });

    if (!integration || !integration.baseUrl) {
      throw createError({
        statusCode: 404,
        message: "iCal integration not found or not configured",
      });
    }

    if (integration.type !== "calendar" || integration.service !== "iCal") {
      throw createError({
        statusCode: 400,
        message: "Invalid integration type for iCal API",
      });
    }

    icalUrl = integration.baseUrl;
  }

  const service = new ICalServerService(integrationId, icalUrl);
  try {
    const events = await service.fetchEventsFromUrl(icalUrl);
    return { events };
  }
  catch (error) {
    consola.error("Integrations iCal Index: Failed to fetch iCal events:", error);
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : "Failed to fetch iCal events",
    });
  }
});
