import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

import { ICalServerService } from "../../../integrations/iCal/client";
import { normalizeWebcalUrl } from "../../../utils/icalUrl";
import { fetchPublicText } from "../../../utils/publicUrl";

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

  const service = new ICalServerService(integrationId, icalUrl);
  try {
    // SSRF guard: the temp mode takes a caller-supplied URL. fetchPublicText
    // validates every hop (including redirects) against private addresses,
    // for stored URLs too as defense in depth.
    const icalData = await fetchPublicText(icalUrl);
    const events = service.parseEvents(icalData);
    return { events };
  }
  catch (error) {
    consola.error("Integrations iCal Index: Failed to fetch iCal events:", error);
    // Our own guard errors (private address, too many redirects) carry a
    // statusCode and a safe message — pass those through. Everything else
    // (network/parse failures) is genericized: raw messages describe the
    // upstream host's response and would turn this endpoint into a probe.
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 400,
      message: "Failed to fetch iCal events from the URL",
    });
  }
});
