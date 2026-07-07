import { z } from "zod";
import { logger } from "firebase-functions";
import { DANCE_STYLES, EVENT_TYPES } from "./constants";
import type { ScrapedEvent } from "./types";

// ─── HTML → events via Gemini Flash ─────────────────────────────────────────
// Ported from the old server/_core/event-extractor.ts, with the LLM transport
// swapped from the Forge OpenAI-compatible proxy to the Gemini REST API
// (plain fetch, no SDK dependency). The extraction prompt and the output
// contract are ported as-is; the JSON response schema is expressed in
// Gemini's OpenAPI-subset form (`nullable: true` instead of
// `type: ["string", "null"]`).
//
// If GEMINI_API_KEY is unset the extractor logs and returns [] — a graceful
// skip, same policy as the old Facebook/Instagram token stubs.

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/" +
  `${GEMINI_MODEL}:generateContent`;

// ─── Output schema ──────────────────────────────────────────────────────────
//
// What we ask the LLM to produce. Kept narrow on purpose — every field that
// makes it through the validator goes straight into Firestore. Anything the
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

// Gemini `responseSchema` (OpenAPI 3.0 subset). Mirrors the Zod shape.
// Field descriptions carry the same guidance as the old json_schema version.
const responseJsonSchema = {
  type: "object",
  required: ["events"],
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "startAt"],
        properties: {
          title: { type: "string", description: "Event name as printed on the page." },
          startAt: {
            type: "string",
            description:
              "Start datetime in ISO-8601 with the JST offset, e.g. 2026-05-10T19:00:00+09:00. Resolve relative dates ('this Saturday') against the current date provided in the prompt.",
          },
          endAt: {
            type: "string",
            nullable: true,
            description: "End datetime, same format. Null if not stated.",
          },
          danceStyle: {
            type: "string",
            nullable: true,
            enum: [...DANCE_STYLES],
            description:
              "Primary dance style. Use 'mixed' for events featuring multiple Latin styles. Use 'other' if not Latin/social-partner. Null if unclear.",
          },
          eventType: {
            type: "string",
            nullable: true,
            enum: [...EVENT_TYPES],
          },
          venueName: { type: "string", nullable: true },
          venueAddress: { type: "string", nullable: true },
          city: {
            type: "string",
            nullable: true,
            description: "City in English (e.g. 'Tokyo', 'Osaka', 'Fukuoka').",
          },
          prefecture: { type: "string", nullable: true },
          nearestStation: { type: "string", nullable: true },
          price: {
            type: "string",
            nullable: true,
            description: "Verbatim price string, including currency. Null if not stated.",
          },
          organizer: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          sourceUrl: {
            type: "string",
            nullable: true,
            description: "Link to the event-detail page if visible, otherwise null.",
          },
          externalId: {
            type: "string",
            nullable: true,
            description:
              "Stable per-source identifier (event slug, ID in URL). Null if none visible.",
          },
        },
      },
    },
  },
} as const;

const SYSTEM_INSTRUCTION =
  "You return strict JSON matching the provided schema. " +
  "You never invent data not present in the user-provided HTML.";

// ─── Extraction ─────────────────────────────────────────────────────────────

export interface ExtractInput {
  html: string;
  sourceUrl: string;
  sourceName: string;
  now: Date;
}

export function buildPrompt({ html, sourceUrl, sourceName, now }: ExtractInput): string {
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

export function parseLlmResponse(raw: string): unknown {
  // Gemini returns JSON in the candidate text when responseMimeType is
  // application/json. Be tolerant of stray whitespace or fences.
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    const stripped = trimmed.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    return JSON.parse(stripped);
  }
  return JSON.parse(trimmed);
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

async function invokeGemini(prompt: string, apiKey: string): Promise<string | null> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseJsonSchema,
        temperature: 0,
        maxOutputTokens: 32768,
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `Gemini invoke failed: ${res.status} ${res.statusText} – ${errorText.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as GeminiResponse;
  const parts = json.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((p) => p.text ?? "").join("");
  return text.length > 0 ? text : null;
}

export async function extractEventsFromHtml(input: ExtractInput): Promise<ScrapedEvent[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Graceful skip — same policy as the old FB/IG adapter stubs.
    logger.info("[Extractor] No GEMINI_API_KEY configured, skipping HTML extraction");
    return [];
  }

  const messageContent = await invokeGemini(buildPrompt(input), apiKey);
  if (typeof messageContent !== "string" || messageContent.length === 0) {
    logger.warn("[Extractor] LLM returned no content");
    return [];
  }

  let parsed: unknown;
  try {
    parsed = parseLlmResponse(messageContent);
  } catch (err) {
    logger.warn(
      `[Extractor] LLM JSON parse failed: ${(err as Error).message}. ` +
        `First 200 chars: ${messageContent.slice(0, 200)}`,
    );
    return [];
  }

  const validation = llmOutputSchema.safeParse(parsed);
  if (!validation.success) {
    logger.warn(`[Extractor] LLM output failed validation: ${validation.error.message}`);
    return [];
  }

  return filterAndNormalizeLlmEvents(validation.data.events, input.now);
}

// Split out so the post-LLM logic is testable without a network call.
export function filterAndNormalizeLlmEvents(
  events: z.infer<typeof llmEventSchema>[],
  now: Date,
): ScrapedEvent[] {
  // Re-filter to upcoming events as a backstop against the LLM ignoring its
  // own instructions.
  const cutoff = now.getTime();
  const upcoming = events.filter((ev) => {
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

// Exported for tests.
export const __testing = { llmOutputSchema, llmEventSchema, responseJsonSchema };
