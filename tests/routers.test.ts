import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB module before the router imports it. Each test sets the mocks'
// return values to whatever it needs to verify. This is router-layer testing —
// we exercise input validation (Zod schemas) and the response/error contract,
// not the actual DB queries.
const mockListEvents = vi.fn();
const mockGetEvent = vi.fn();
const mockListSources = vi.fn();
const mockAddSource = vi.fn();
const mockToggleSource = vi.fn();
const mockDeleteSource = vi.fn();
const mockGetRecentScrapeLogs = vi.fn();
const mockGetUserPreferences = vi.fn();
const mockUpsertUserPreferences = vi.fn();
const mockInsertSubmittedEvent = vi.fn();
const mockStoragePut = vi.fn();
const mockGetEventAttendance = vi.fn();
const mockSetEventAttendance = vi.fn();
const mockGetEventAttendanceCounts = vi.fn();

vi.mock("../server/db", () => {
  // Real class so `err instanceof DuplicateEventError` works inside the resolver.
  class DuplicateEventError extends Error {
    constructor(message = "This event looks like it's already on the calendar.") {
      super(message);
      this.name = "DuplicateEventError";
    }
  }
  return {
    listEvents: mockListEvents,
    getEvent: mockGetEvent,
    listSources: mockListSources,
    addSource: mockAddSource,
    toggleSource: mockToggleSource,
    deleteSource: mockDeleteSource,
    getRecentScrapeLogs: mockGetRecentScrapeLogs,
    getUserPreferences: mockGetUserPreferences,
    upsertUserPreferences: mockUpsertUserPreferences,
    insertSubmittedEvent: mockInsertSubmittedEvent,
    DuplicateEventError,
    getEventAttendance: mockGetEventAttendance,
    setEventAttendance: mockSetEventAttendance,
    getEventAttendanceCounts: mockGetEventAttendanceCounts,
  };
});

vi.mock("../server/storage", () => ({
  storagePut: mockStoragePut,
}));

// systemRouter pulls in OAuth/session machinery we don't need here.
vi.mock("../server/_core/systemRouter", () => ({
  systemRouter: { _def: {} } as any,
}));

const { appRouter } = await import("../server/routers");
const { DuplicateEventError } = await import("../server/db");
import type { TrpcContext } from "../server/_core/context";

function makeCtx(): TrpcContext {
  return {
    user: null,
    req: { headers: {}, protocol: "https" } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

// Context for a signed-in caller. The gated procedures (`sources.*` mutations,
// `preferences.*`) require a non-null `ctx.user`; validation/forwarding tests run
// through this so they exercise the resolver rather than short-circuiting on auth.
function makeAuthedCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-open-id",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {}, protocol: "https" } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("events.list", () => {
  it("passes through validated input to listEvents and returns its result", async () => {
    mockListEvents.mockResolvedValue([{ id: 1, title: "Event A" }]);
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.events.list({
      danceStyle: "salsa",
      city: "Tokyo",
      startDate: "2026-05-03T00:00:00+09:00",
      endDate: "2026-06-03T00:00:00+09:00",
      limit: 50,
      offset: 0,
    });

    expect(result).toEqual([{ id: 1, title: "Event A" }]);
    expect(mockListEvents).toHaveBeenCalledTimes(1);
    expect(mockListEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        danceStyle: "salsa",
        city: "Tokyo",
        startDate: "2026-05-03T00:00:00+09:00",
        endDate: "2026-06-03T00:00:00+09:00",
        limit: 50,
        offset: 0,
      }),
    );
  });

  it("rejects an unparseable startDate with BAD_REQUEST", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.events.list({ startDate: "next saturday" }),
    ).rejects.toThrow(/Invalid ISO-8601 date|BAD_REQUEST|Invalid input/i);
    expect(mockListEvents).not.toHaveBeenCalled();
  });

  it("rejects limit > API_MAX_PAGE_SIZE", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.events.list({ limit: 10_000 }),
    ).rejects.toThrow(/limit|Invalid|BAD_REQUEST/i);
    expect(mockListEvents).not.toHaveBeenCalled();
  });

  it("rejects negative offset", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.events.list({ offset: -1 }),
    ).rejects.toThrow();
    expect(mockListEvents).not.toHaveBeenCalled();
  });

  it("treats search input as a string and forwards it to listEvents", async () => {
    mockListEvents.mockResolvedValue([]);
    const caller = appRouter.createCaller(makeCtx());
    await caller.events.list({ search: "100% bachata" });
    expect(mockListEvents).toHaveBeenCalledWith(
      expect.objectContaining({ search: "100% bachata" }),
    );
    // The router itself doesn't escape — that's escapeLikePattern's job inside
    // listEvents. This test confirms the search string survives validation
    // without being mangled (still has the % that escapeLikePattern will quote).
  });

  it("rejects search longer than 200 chars", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.events.list({ search: "x".repeat(300) }),
    ).rejects.toThrow();
  });

  it("works with no input at all (all fields optional)", async () => {
    mockListEvents.mockResolvedValue([]);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.events.list({});
    expect(result).toEqual([]);
    expect(mockListEvents).toHaveBeenCalledWith({});
  });
});

describe("events.get", () => {
  it("returns the event when listEvents found one", async () => {
    mockGetEvent.mockResolvedValue({ id: 42, title: "Found" });
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.events.get({ id: 42 });
    expect(result).toEqual({ id: 42, title: "Found" });
  });

  it("rejects id=0", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.events.get({ id: 0 })).rejects.toThrow();
    expect(mockGetEvent).not.toHaveBeenCalled();
  });

  it("rejects negative id", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.events.get({ id: -5 })).rejects.toThrow();
  });

  it("rejects non-integer id", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.events.get({ id: 1.5 })).rejects.toThrow();
  });
});

describe("events.submit", () => {
  const validInput = {
    title: "  Saturday Salsa Social  ",
    startAt: "2026-07-10T19:00:00+09:00",
  };

  it("inserts a submitted event attributed to the authed user and returns its id", async () => {
    mockInsertSubmittedEvent.mockResolvedValue({ id: 555 });
    const caller = appRouter.createCaller(makeAuthedCtx());

    const result = await caller.events.submit({
      ...validInput,
      danceStyle: "salsa",
      eventType: "social",
      city: "Tokyo",
      sourceUrl: "https://example.com/event",
    });

    expect(result).toEqual({ success: true, id: 555 });
    // Title is trimmed; second arg is the authenticated user's id (never client-supplied).
    expect(mockInsertSubmittedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Saturday Salsa Social",
        startAt: "2026-07-10T19:00:00+09:00",
        danceStyle: "salsa",
        eventType: "social",
        city: "Tokyo",
        sourceUrl: "https://example.com/event",
      }),
      1,
    );
  });

  it("rejects an unauthenticated caller before touching the db", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.events.submit(validInput)).rejects.toThrow(
      /Please login|UNAUTHORIZED/i,
    );
    expect(mockInsertSubmittedEvent).not.toHaveBeenCalled();
  });

  it("rejects an empty title (after trim)", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.events.submit({ title: "   ", startAt: validInput.startAt }),
    ).rejects.toThrow();
    expect(mockInsertSubmittedEvent).not.toHaveBeenCalled();
  });

  it("rejects an unparseable startAt", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.events.submit({ title: "Foo", startAt: "next saturday" }),
    ).rejects.toThrow();
    expect(mockInsertSubmittedEvent).not.toHaveBeenCalled();
  });

  it("rejects an invalid danceStyle enum value", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.events.submit({ ...validInput, danceStyle: "breakdance" as any }),
    ).rejects.toThrow();
    expect(mockInsertSubmittedEvent).not.toHaveBeenCalled();
  });

  it("rejects an invalid eventType enum value", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.events.submit({ ...validInput, eventType: "rave" as any }),
    ).rejects.toThrow();
    expect(mockInsertSubmittedEvent).not.toHaveBeenCalled();
  });

  it("rejects a non-http(s) link", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.events.submit({ ...validInput, sourceUrl: "javascript:alert(1)" }),
    ).rejects.toThrow();
    expect(mockInsertSubmittedEvent).not.toHaveBeenCalled();
  });

  it("rejects an unknown key (strict schema)", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.events.submit({ ...validInput, sourceId: 1, isVerified: true } as any),
    ).rejects.toThrow();
    expect(mockInsertSubmittedEvent).not.toHaveBeenCalled();
  });

  it("uploads a valid image to storage and forwards the resulting URL", async () => {
    mockStoragePut.mockResolvedValue({ key: "submissions/event_x.jpg", url: "https://cdn.example/x.jpg" });
    mockInsertSubmittedEvent.mockResolvedValue({ id: 7 });
    const caller = appRouter.createCaller(makeAuthedCtx());

    // ~12KB decoded — comfortably under the 600KB cap.
    const base64 = "A".repeat(16_000);
    const result = await caller.events.submit({
      ...validInput,
      image: { base64, mimeType: "image/jpeg" },
    });

    expect(result).toEqual({ success: true, id: 7 });
    expect(mockStoragePut).toHaveBeenCalledTimes(1);
    expect(mockInsertSubmittedEvent).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: "https://cdn.example/x.jpg" }),
      1,
    );
  });

  it("rejects an oversized image with BAD_REQUEST and never uploads or inserts", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    // 820k base64 chars → ~615KB decoded, over the 600KB cap.
    const base64 = "A".repeat(820_000);
    await expect(
      caller.events.submit({ ...validInput, image: { base64, mimeType: "image/jpeg" } }),
    ).rejects.toThrow(/too large|BAD_REQUEST/i);
    expect(mockStoragePut).not.toHaveBeenCalled();
    expect(mockInsertSubmittedEvent).not.toHaveBeenCalled();
  });

  it("maps a DuplicateEventError from the db to a CONFLICT", async () => {
    mockInsertSubmittedEvent.mockRejectedValue(new DuplicateEventError());
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(caller.events.submit(validInput)).rejects.toThrow(
      /already on the calendar|CONFLICT/i,
    );
  });
});

describe("events.attendance (public RSVP summary)", () => {
  it("returns the public counts and resolves myStatus for a signed-in caller", async () => {
    mockGetEventAttendance.mockResolvedValue({ interested: 4, going: 9, myStatus: "going" });
    const caller = appRouter.createCaller(makeAuthedCtx());
    const result = await caller.events.attendance({ eventId: 42 });
    expect(result).toEqual({ interested: 4, going: 9, myStatus: "going" });
    // Counts are keyed by event; myStatus by the authenticated user.
    expect(mockGetEventAttendance).toHaveBeenCalledWith(42, 1);
  });

  it("stays public — works unauthenticated with myStatus null (no user id passed)", async () => {
    mockGetEventAttendance.mockResolvedValue({ interested: 4, going: 9, myStatus: null });
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.events.attendance({ eventId: 42 });
    expect(result.myStatus).toBeNull();
    expect(mockGetEventAttendance).toHaveBeenCalledWith(42, undefined);
  });

  it("rejects a non-positive eventId", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.events.attendance({ eventId: 0 })).rejects.toThrow();
    expect(mockGetEventAttendance).not.toHaveBeenCalled();
  });
});

describe("events.setAttendance", () => {
  it("sets the caller's status under their own id and returns the fresh summary", async () => {
    mockSetEventAttendance.mockResolvedValue(undefined);
    mockGetEventAttendance.mockResolvedValue({ interested: 1, going: 3, myStatus: "going" });
    const caller = appRouter.createCaller(makeAuthedCtx());
    const result = await caller.events.setAttendance({ eventId: 7, status: "going" });
    expect(result).toEqual({ interested: 1, going: 3, myStatus: "going" });
    expect(mockSetEventAttendance).toHaveBeenCalledWith(1, 7, "going");
  });

  it("allows status null to clear the RSVP", async () => {
    mockSetEventAttendance.mockResolvedValue(undefined);
    mockGetEventAttendance.mockResolvedValue({ interested: 0, going: 2, myStatus: null });
    const caller = appRouter.createCaller(makeAuthedCtx());
    const result = await caller.events.setAttendance({ eventId: 7, status: null });
    expect(result.myStatus).toBeNull();
    expect(mockSetEventAttendance).toHaveBeenCalledWith(1, 7, null);
  });

  it("rejects an unauthenticated caller before touching the db", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.events.setAttendance({ eventId: 7, status: "going" }),
    ).rejects.toThrow(/Please login|UNAUTHORIZED/i);
    expect(mockSetEventAttendance).not.toHaveBeenCalled();
  });

  it("rejects an invalid status enum value", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.events.setAttendance({ eventId: 7, status: "maybe" as any }),
    ).rejects.toThrow();
    expect(mockSetEventAttendance).not.toHaveBeenCalled();
  });

  it("rejects a non-positive eventId", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.events.setAttendance({ eventId: -1, status: "going" }),
    ).rejects.toThrow();
    expect(mockSetEventAttendance).not.toHaveBeenCalled();
  });
});

describe("events.attendanceCounts (public batched counts)", () => {
  it("forwards the eventIds and returns the counts map", async () => {
    mockGetEventAttendanceCounts.mockResolvedValue({
      1: { interested: 2, going: 5 },
      2: { interested: 0, going: 1 },
    });
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.events.attendanceCounts({ eventIds: [1, 2] });
    expect(result).toEqual({ 1: { interested: 2, going: 5 }, 2: { interested: 0, going: 1 } });
    expect(mockGetEventAttendanceCounts).toHaveBeenCalledWith([1, 2]);
  });

  it("accepts an empty id list", async () => {
    mockGetEventAttendanceCounts.mockResolvedValue({});
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.events.attendanceCounts({ eventIds: [] });
    expect(result).toEqual({});
  });

  it("rejects more than one page of ids (URL-length guard)", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const tooMany = Array.from({ length: 501 }, (_, i) => i + 1);
    await expect(caller.events.attendanceCounts({ eventIds: tooMany })).rejects.toThrow();
    expect(mockGetEventAttendanceCounts).not.toHaveBeenCalled();
  });

  it("rejects a non-positive id in the list", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.events.attendanceCounts({ eventIds: [1, 0, 3] })).rejects.toThrow();
    expect(mockGetEventAttendanceCounts).not.toHaveBeenCalled();
  });
});

describe("sources.add", () => {
  it("trims the name and forwards user-added marker to addSource", async () => {
    mockAddSource.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(makeAuthedCtx());

    const result = await caller.sources.add({
      name: "  Tokyo Salsa  ",
      url: "https://example.com/events",
      sourceType: "html",
    });

    expect(result).toEqual({ success: true });
    expect(mockAddSource).toHaveBeenCalledWith({
      name: "Tokyo Salsa",
      url: "https://example.com/events",
      sourceType: "html",
      isUserAdded: true,
      isActive: true,
      addedByUserId: 1,
    });
  });

  it("rejects javascript: URL even though length and parse pass", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.sources.add({
        name: "Bad",
        url: "javascript:alert(1)",
        sourceType: "html",
      }),
    ).rejects.toThrow();
    expect(mockAddSource).not.toHaveBeenCalled();
  });

  it("rejects file:// URL", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.sources.add({
        name: "Bad",
        url: "file:///etc/passwd",
        sourceType: "html",
      }),
    ).rejects.toThrow();
  });

  it("rejects malformed URL", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.sources.add({
        name: "Bad",
        url: "not-a-url",
        sourceType: "html",
      }),
    ).rejects.toThrow();
  });

  it("rejects unknown sourceType not in the enum", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.sources.add({
        name: "Foo",
        url: "https://example.com",
        sourceType: "tiktok" as any,
      }),
    ).rejects.toThrow();
  });

  it("rejects empty name after trim", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.sources.add({
        name: "",
        url: "https://example.com",
        sourceType: "html",
      }),
    ).rejects.toThrow();
  });
});

describe("sources.toggle / sources.delete", () => {
  it("toggle forwards id, isActive, and the owner-scoped actor", async () => {
    mockToggleSource.mockResolvedValue("ok");
    const caller = appRouter.createCaller(makeAuthedCtx());
    await caller.sources.toggle({ id: 7, isActive: false });
    expect(mockToggleSource).toHaveBeenCalledWith(7, false, { userId: 1, isAdmin: false });
  });

  it("delete forwards id and the owner-scoped actor", async () => {
    mockDeleteSource.mockResolvedValue("ok");
    const caller = appRouter.createCaller(makeAuthedCtx());
    await caller.sources.delete({ id: 9 });
    expect(mockDeleteSource).toHaveBeenCalledWith(9, { userId: 1, isAdmin: false });
  });

  it("maps a forbidden source mutation to FORBIDDEN", async () => {
    mockToggleSource.mockResolvedValue("forbidden");
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(caller.sources.toggle({ id: 7, isActive: false })).rejects.toThrow(
      /can only manage sources you added/i,
    );
  });

  it("maps a missing source to NOT_FOUND", async () => {
    mockDeleteSource.mockResolvedValue("not_found");
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(caller.sources.delete({ id: 999 })).rejects.toThrow(/not found/i);
  });

  it("toggle rejects non-positive id", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.sources.toggle({ id: 0, isActive: true }),
    ).rejects.toThrow();
    await expect(
      caller.sources.toggle({ id: -1, isActive: true }),
    ).rejects.toThrow();
  });
});

describe("auth gating on mutations", () => {
  // Each mutation is given VALID input so the only possible failure is the auth
  // middleware. Confirms protectedProcedure rejects an unauthenticated caller
  // before the resolver runs (db helper never invoked).
  it("sources.add rejects an unauthenticated caller and never touches the db", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.sources.add({
        name: "Tokyo Salsa",
        url: "https://example.com/events",
        sourceType: "html",
      }),
    ).rejects.toThrow(/Please login|UNAUTHORIZED/i);
    expect(mockAddSource).not.toHaveBeenCalled();
  });

  it("sources.toggle rejects an unauthenticated caller", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.sources.toggle({ id: 7, isActive: false }),
    ).rejects.toThrow(/Please login|UNAUTHORIZED/i);
    expect(mockToggleSource).not.toHaveBeenCalled();
  });

  it("sources.delete rejects an unauthenticated caller", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.sources.delete({ id: 9 })).rejects.toThrow(
      /Please login|UNAUTHORIZED/i,
    );
    expect(mockDeleteSource).not.toHaveBeenCalled();
  });

  it("sources.list stays public (read-only) and works unauthenticated", async () => {
    mockListSources.mockResolvedValue([{ id: 1, name: "X" }]);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sources.list();
    expect(result).toEqual([{ id: 1, name: "X" }]);
  });
});

describe("preferences", () => {
  it("get returns the current user's preferences row, keyed by ctx.user.id", async () => {
    mockGetUserPreferences.mockResolvedValue({ userId: 1, city: "Tokyo" });
    const caller = appRouter.createCaller(makeAuthedCtx());
    const result = await caller.preferences.get();
    expect(result).toEqual({ userId: 1, city: "Tokyo" });
    // Keyed by the authenticated user's id — never a client-supplied value.
    expect(mockGetUserPreferences).toHaveBeenCalledWith(1);
  });

  it("get rejects an unauthenticated caller", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.preferences.get()).rejects.toThrow(
      /Please login|UNAUTHORIZED/i,
    );
    expect(mockGetUserPreferences).not.toHaveBeenCalled();
  });

  it("upsert forwards validated input under the authenticated user's id", async () => {
    mockUpsertUserPreferences.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(makeAuthedCtx());
    const result = await caller.preferences.upsert({
      city: "Osaka",
      maxDistanceKm: 20,
      notificationsEnabled: false,
    });
    expect(result).toEqual({ success: true });
    expect(mockUpsertUserPreferences).toHaveBeenCalledWith(1, {
      city: "Osaka",
      maxDistanceKm: 20,
      notificationsEnabled: false,
    });
  });

  it("upsert rejects an unauthenticated caller", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.preferences.upsert({ city: "Osaka" }),
    ).rejects.toThrow(/Please login|UNAUTHORIZED/i);
    expect(mockUpsertUserPreferences).not.toHaveBeenCalled();
  });

  it("upsert rejects an unknown key (strict) before reaching the db", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.preferences.upsert({ userId: 999, isAdmin: true } as any),
    ).rejects.toThrow();
    expect(mockUpsertUserPreferences).not.toHaveBeenCalled();
  });

  it("upsert rejects an out-of-range maxDistanceKm", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.preferences.upsert({ maxDistanceKm: 99999 }),
    ).rejects.toThrow();
    expect(mockUpsertUserPreferences).not.toHaveBeenCalled();
  });

  it("upsert rejects an invalid theme enum value", async () => {
    const caller = appRouter.createCaller(makeAuthedCtx());
    await expect(
      caller.preferences.upsert({ theme: "neon" as any }),
    ).rejects.toThrow();
    expect(mockUpsertUserPreferences).not.toHaveBeenCalled();
  });
});

describe("sources.list / scraper.logs", () => {
  it("sources.list returns whatever listSources gives", async () => {
    mockListSources.mockResolvedValue([{ id: 1, name: "X" }]);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.sources.list();
    expect(result).toEqual([{ id: 1, name: "X" }]);
  });

  it("scraper.logs returns at most 20 logs", async () => {
    mockGetRecentScrapeLogs.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({ id: i, status: "success" })),
    );
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.scraper.logs();
    expect(result).toHaveLength(20);
    // The router caps at 20; verify the helper was called with 20.
    expect(mockGetRecentScrapeLogs).toHaveBeenCalledWith(20);
  });
});
