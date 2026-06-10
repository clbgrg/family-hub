import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

import { ICalServerService } from "../../../integrations/iCal/client";
import { normalizeWebcalUrl } from "../../../utils/icalUrl";
import { assertPublicHttpUrl } from "../../../utils/publicUrl";

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
    icalUrl = normalizeWebcalUrl(baseUrl);
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

  // SSRF guard: the temp mode takes a caller-supplied URL, so refuse anything
  // private before fetching (and re-check stored URLs for defense in depth).
  await assertPublicHttpUrl(icalUrl);

  const service = new ICalServerService(integrationId, icalUrl);
  try {
    const events = await service.fetchEventsFromUrl(icalUrl);
    return { events };
  }
  catch (error) {
    consola.error("Integrations iCal Index: Failed to fetch iCal events:", error);
    // Don't echo raw error messages — they describe the upstream host's
    // response and would turn this endpoint into a network probe.
    throw createError({
      statusCode: 400,
      message: "Failed to fetch iCal events from the URL",
    });
  }
});
