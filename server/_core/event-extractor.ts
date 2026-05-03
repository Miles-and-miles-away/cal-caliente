import { z } from "zod";
import { DANCE_STYLES, EVENT_TYPES } from "../../shared/constants";
import type { ScrapedEvent } from "../scraper";
import { invokeLLM } from "./llm";

// ─── Output schema ──────────────────────────────────────────────────────────
//
// What we ask the LLM to produce. Kept narrow on purpose — every field that
// makes it through the validator goes straight into our DB. Anything the
// model invents that isn't in this shape is dropped.

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "expected ISO-8601 date");

const llmEventSchema = z.object({
  title: z.string().min(1).max(500),
  startAt: isoDate,
  endAt: isoDate.nullable().optional(),
  danceStyle: z.enum(DANCE_STYLES).nullable().optional(),
  eventType: z.enum(EVENT_TYPES).nullable().optional(),
  venueName: z.string().max(500).nullable().optional(),
  venueAddress: z.string().max(2000).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  prefecture: z.string().max(100).nullable().optional(),
  nearestStation: z.string().max(200).nullable().optional(),
  price: z.string().max(200).nullable().optional(),
  organizer: z.string().max(300).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  sourceUrl: z.string().max(2048).nullable().optional(),
  externalId: z.string().max(255).nullable().optional(),
});

const llmOutputSchema = z.object({
  events: z.array(llmEventSchema),
});

// JSON-schema form for the LLM `response_format`. Mirrors the Zod shape but in
// the format the OpenAI-style structured-output API expects.
const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["events"],
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "startAt"],
        properties: {
          title: { type: "string", description: "Event name as printed on the page." },
          startAt: {
            type: "string",
            description:
              "Start datetime in ISO-8601 with the JST offset, e.g. 2026-05-10T19:00:00+09:00. Resolve relative dates ('this Saturday') against the current date provided in the prompt.",
          },
          endAt: { type: ["string", "null"], description: "End datetime, same format. Null if not stated." },
          danceStyle: {
            type: ["string", "null"],
            enum: [...DANCE_STYLES, null],
            description: "Primary dance style. Use 'mixed' for events featuring multiple Latin styles. Use 'other' if not Latin/social-partner. Null if unclear.",
          },
          eventType: {
            type: ["string", "null"],
            enum: [...EVENT_TYPES, null],
          },
          venueName: { type: ["string", "null"] },
          venueAddress: { type: ["string", "null"] },
          city: { type: ["string", "null"], description: "City in English (e.g. 'Tokyo', 'Osaka', 'Fukuoka')." },
          prefecture: { type: ["string", "null"] },
          nearestStation: { type: ["string", "null"] },
          price: { type: ["string", "null"], description: "Verbatim price string, including currency. Null if not stated." },
          organizer: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          sourceUrl: { type: ["string", "null"], description: "Link to the event-detail page if visible, otherwise null." },
          externalId: { type: ["string", "null"], description: "Stable per-source identifier (event slug, ID in URL). Null if none visible." },
        },
      },
    },
  },
} as const;

// ─── Extraction ─────────────────────────────────────────────────────────────

export interface ExtractInput {
  html: string;
  sourceUrl: string;
  sourceName: string;
  now: Date;
}

function buildPrompt({ html, sourceUrl, sourceName, now }: ExtractInput): string {
  const today = now.toISOString();
  return `You extract Latin-dance event listings from web pages for a Japan-focused calendar.

Source URL: ${sourceUrl}
Source name: ${sourceName}
Current date (JST): ${today}

Rules:
- Only return events that take place on or after the current date. Skip past events.
- Use the source HTML as the only source of truth. Do not invent events, venues, prices, or dates.
- For recurring listings ("every Saturday"), return the next single occurrence on or after the current date.
- Resolve relative dates ('this Saturday', '今週土曜日') against the current date above.
- All datetimes must be ISO-8601 with the JST offset (+09:00). If the page lists only a date with no time, use the venue's typical evening start (or 19:00:00) and document that approximation in the description field.
- If no upcoming events are visible, return {"events": []}. Do not pad.
- Trust the page. If a field isn't shown, return null — do not guess.

Page HTML (truncated):
---
${html}
---`;
}

function parseLlmResponse(raw: string): unknown {
  // The LLM returns JSON in the message content when response_format is
  // json_schema. Be tolerant of stray whitespace or fences.
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    const stripped = trimmed.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    return JSON.parse(stripped);
  }
  return JSON.parse(trimmed);
}

export async function extractEventsFromHtml(input: ExtractInput): Promise<ScrapedEvent[]> {
  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You return strict JSON matching the provided schema. You never invent data not present in the user-provided HTML.",
      },
      { role: "user", content: buildPrompt(input) },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: { name: "events", schema: responseJsonSchema, strict: true },
    },
  });

  const messageContent = result.choices?.[0]?.message?.content;
  if (typeof messageContent !== "string" || messageContent.length === 0) {
    console.warn("[Extractor] LLM returned no content");
    return [];
  }

  let parsed: unknown;
  try {
    parsed = parseLlmResponse(messageContent);
  } catch (err: any) {
    console.warn(`[Extractor] LLM JSON parse failed: ${err.message}. First 200 chars: ${messageContent.slice(0, 200)}`);
    return [];
  }

  const validation = llmOutputSchema.safeParse(parsed);
  if (!validation.success) {
    console.warn(`[Extractor] LLM output failed validation: ${validation.error.message}`);
    return [];
  }

  // Re-filter to upcoming events as a backstop against the LLM ignoring its
  // own instructions.
  const cutoff = input.now.getTime();
  const upcoming = validation.data.events.filter((ev) => {
    const start = new Date(ev.startAt).getTime();
    return Number.isFinite(start) && start >= cutoff;
  });

  return upcoming.map((ev) => ({
    ...ev,
    danceStyle: ev.danceStyle ?? undefined,
    eventType: ev.eventType ?? undefined,
    venueName: ev.venueName ?? undefined,
    venueAddress: ev.venueAddress ?? undefined,
    city: ev.city ?? undefined,
    prefecture: ev.prefecture ?? undefined,
    nearestStation: ev.nearestStation ?? undefined,
    price: ev.price ?? undefined,
    organizer: ev.organizer ?? undefined,
    description: ev.description ?? undefined,
    sourceUrl: ev.sourceUrl ?? undefined,
    externalId: ev.externalId ?? undefined,
    endAt: ev.endAt ?? undefined,
  }));
}

// ─── Detail-page enrichment ─────────────────────────────────────────────────
//
// Listing pages give us title, date, venue name. Detail pages add the fields
// that make the app actually useful: full street address, postal code,
// recurrence pattern, organizer contact, lat/lng (often parseable from a
// Google Maps link in the page).
//
// Output is a *partial* event — only the fields the detail page reliably
// surfaces. Caller merges this onto the listing-page result. We don't ask
// the LLM to repeat title/startAt because those are already trusted from the
// listing pass.

const enrichmentSchema = z.object({
  venueName: z.string().max(500).nullable().optional(),
  venueAddress: z.string().max(2000).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  prefecture: z.string().max(100).nullable().optional(),
  nearestStation: z.string().max(200).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  price: z.string().max(200).nullable().optional(),
  organizer: z.string().max(300).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  imageUrl: z.string().max(2048).nullable().optional(),
});

const enrichmentResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [],
  properties: {
    venueName: { type: ["string", "null"] },
    venueAddress: { type: ["string", "null"], description: "Full street address including postal code if visible." },
    city: { type: ["string", "null"] },
    prefecture: { type: ["string", "null"] },
    nearestStation: { type: ["string", "null"] },
    latitude: { type: ["number", "null"], description: "Decimal degrees. Extract from any Google Maps link or coordinate text in the page." },
    longitude: { type: ["number", "null"] },
    price: { type: ["string", "null"], description: "Verbatim price text, including currency and any conditions." },
    organizer: { type: ["string", "null"] },
    description: { type: ["string", "null"], description: "Plain-text description, ~2-5 sentences. Strip HTML." },
    imageUrl: { type: ["string", "null"], description: "Absolute URL to a representative event image if shown on the page." },
  },
} as const;

export interface EnrichInput {
  html: string;
  pageUrl: string;
  /** Existing event from listing-page extraction, used for context. */
  baseEvent: ScrapedEvent;
}

export type EventEnrichment = z.infer<typeof enrichmentSchema>;

function buildEnrichmentPrompt({ html, pageUrl, baseEvent }: EnrichInput): string {
  return `You extract Latin-dance event details from a single event's detail page.
Page URL: ${pageUrl}
Event title (from prior pass): ${baseEvent.title}
Event start (from prior pass): ${baseEvent.startAt}

Rules:
- Use the page HTML as the only source of truth.
- Return null for any field not visible. Do not invent values.
- For latitude/longitude, look for "@lat,lng" patterns in Google Maps URLs or explicit coordinate text. Return numeric decimal degrees, not strings.
- For description, strip HTML to plain text and trim to a few useful sentences.
- For imageUrl, return only absolute URLs (https://…). Skip data: URIs and relative paths.

Page HTML (truncated):
---
${html}
---`;
}

export async function extractEventDetailFromHtml(input: EnrichInput): Promise<EventEnrichment> {
  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You return strict JSON matching the provided schema. You never invent data not present in the user-provided HTML.",
      },
      { role: "user", content: buildEnrichmentPrompt(input) },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: { name: "event_enrichment", schema: enrichmentResponseJsonSchema, strict: true },
    },
  });

  const messageContent = result.choices?.[0]?.message?.content;
  if (typeof messageContent !== "string" || messageContent.length === 0) return {};

  let parsed: unknown;
  try {
    parsed = parseLlmResponse(messageContent);
  } catch {
    return {};
  }

  const validation = enrichmentSchema.safeParse(parsed);
  if (!validation.success) {
    console.warn(`[Extractor] Enrichment failed validation: ${validation.error.message}`);
    return {};
  }
  return validation.data;
}

// Exported for tests.
export const __testing = { llmOutputSchema, llmEventSchema, enrichmentSchema };
