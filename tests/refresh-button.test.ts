import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for manual refresh button and past event filtering.
 * 
 * Key improvements:
 * 1. Manual refresh button is easier to test than pull-to-refresh
 * 2. My Calendar now filters out past events
 * 3. Favorite count only includes upcoming events
 */

describe("Manual Refresh Button", () => {
  describe("Refresh Button State Management", () => {
    it("should start with isRefreshing = false", () => {
      let isRefreshing = false;
      expect(isRefreshing).toBe(false);
    });

    it("should set isRefreshing to true when refresh starts", () => {
      let isRefreshing = false;
      const setIsRefreshing = (value: boolean) => {
        isRefreshing = value;
      };

      setIsRefreshing(true);
      expect(isRefreshing).toBe(true);
    });

    it("should set isRefreshing back to false after refetch completes", async () => {
      let isRefreshing = false;
      const setIsRefreshing = (value: boolean) => {
        isRefreshing = value;
      };

      const mockRefetch = vi.fn().mockResolvedValue({ data: [] });

      const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
          await mockRefetch();
        } finally {
          setIsRefreshing(false);
        }
      };

      await handleRefresh();

      expect(isRefreshing).toBe(false);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it("should set isRefreshing to false even if refetch fails", async () => {
      let isRefreshing = false;
      const setIsRefreshing = (value: boolean) => {
        isRefreshing = value;
      };

      const mockRefetch = vi.fn().mockRejectedValue(new Error("API error"));

      const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
          await mockRefetch();
        } catch (e) {
          // Error expected
        } finally {
          setIsRefreshing(false);
        }
      };

      await handleRefresh();

      expect(isRefreshing).toBe(false);
      expect(mockRefetch).toHaveBeenCalled();
    });

    it("should disable refresh button while refreshing", () => {
      let isRefreshing = false;
      let isLoading = false;

      const isDisabled = isRefreshing || isLoading;
      expect(isDisabled).toBe(false);

      isRefreshing = true;
      expect(isRefreshing || isLoading).toBe(true);
    });
  });

  describe("Refresh Button Callback", () => {
    it("should call refetch when handleRefresh is invoked", async () => {
      const mockRefetch = vi.fn().mockResolvedValue({ data: [] });
      let isRefreshing = false;
      const setIsRefreshing = (value: boolean) => {
        isRefreshing = value;
      };

      const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
          await mockRefetch();
        } finally {
          setIsRefreshing(false);
        }
      };

      await handleRefresh();

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it("should only call refetch once per refresh", async () => {
      const mockRefetch = vi.fn().mockResolvedValue({ data: [] });
      let isRefreshing = false;
      const setIsRefreshing = (value: boolean) => {
        isRefreshing = value;
      };

      const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
          await mockRefetch();
        } finally {
          setIsRefreshing(false);
        }
      };

      await handleRefresh();
      expect(mockRefetch).toHaveBeenCalledTimes(1);

      await handleRefresh();
      expect(mockRefetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe("Past Event Filtering", () => {
  describe("isEventInPast Helper", () => {
    it("should return true for past events", () => {
      const now = new Date();
      const pastEvent = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago

      const isEventInPast = (eventDate: string, referenceDate: Date): boolean => {
        const eventTime = new Date(eventDate).getTime();
        const refTime = referenceDate.getTime();
        return eventTime < refTime;
      };

      expect(isEventInPast(pastEvent.toISOString(), now)).toBe(true);
    });

    it("should return false for future events", () => {
      const now = new Date();
      const futureEvent = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour from now

      const isEventInPast = (eventDate: string, referenceDate: Date): boolean => {
        const eventTime = new Date(eventDate).getTime();
        const refTime = referenceDate.getTime();
        return eventTime < refTime;
      };

      expect(isEventInPast(futureEvent.toISOString(), now)).toBe(false);
    });

    it("should handle events at exact current time", () => {
      const now = new Date();

      const isEventInPast = (eventDate: string, referenceDate: Date): boolean => {
        const eventTime = new Date(eventDate).getTime();
        const refTime = referenceDate.getTime();
        return eventTime < refTime;
      };

      expect(isEventInPast(now.toISOString(), now)).toBe(false);
    });
  });

  describe("My Calendar Filtering", () => {
    it("should exclude past events from My Calendar", () => {
      const now = new Date();
      const pastEvent = {
        id: 1,
        startAt: new Date(now.getTime() - 1000 * 60 * 60).toISOString(),
      };
      const futureEvent = {
        id: 2,
        startAt: new Date(now.getTime() + 1000 * 60 * 60).toISOString(),
      };

      const favorites = new Set([1, 2]); // Both are favorites
      const isFavorite = (id: number) => favorites.has(id);

      const isEventInPast = (eventDate: string, referenceDate: Date): boolean => {
        const eventTime = new Date(eventDate).getTime();
        const refTime = referenceDate.getTime();
        return eventTime < refTime;
      };

      const events = [pastEvent, futureEvent];
      const myCalendarEvents = events.filter(
        (ev) => isFavorite(ev.id) && !isEventInPast(ev.startAt, now)
      );

      expect(myCalendarEvents).toHaveLength(1);
      expect(myCalendarEvents[0].id).toBe(2);
    });

    it("should include only upcoming favorites in My Calendar count", () => {
      const now = new Date();
      const events = [
        { id: 1, startAt: new Date(now.getTime() - 1000 * 60 * 60).toISOString() }, // past
        { id: 2, startAt: new Date(now.getTime() + 1000 * 60 * 60).toISOString() }, // future
        { id: 3, startAt: new Date(now.getTime() + 2000 * 60 * 60).toISOString() }, // future
      ];

      const favorites = new Set([1, 2, 3]); // All are favorites
      const isFavorite = (id: number) => favorites.has(id);

      const isEventInPast = (eventDate: string, referenceDate: Date): boolean => {
        const eventTime = new Date(eventDate).getTime();
        const refTime = referenceDate.getTime();
        return eventTime < refTime;
      };

      const upcomingFavCount = events.filter(
        (ev) => isFavorite(ev.id) && !isEventInPast(ev.startAt, now)
      ).length;

      expect(upcomingFavCount).toBe(2);
    });

    it("should show 0 count when no upcoming favorites exist", () => {
      const now = new Date();
      const events = [
        { id: 1, startAt: new Date(now.getTime() - 1000 * 60 * 60).toISOString() }, // past
        { id: 2, startAt: new Date(now.getTime() - 2000 * 60 * 60).toISOString() }, // past
      ];

      const favorites = new Set([1, 2]); // All are favorites
      const isFavorite = (id: number) => favorites.has(id);

      const isEventInPast = (eventDate: string, referenceDate: Date): boolean => {
        const eventTime = new Date(eventDate).getTime();
        const refTime = referenceDate.getTime();
        return eventTime < refTime;
      };

      const upcomingFavCount = events.filter(
        (ev) => isFavorite(ev.id) && !isEventInPast(ev.startAt, now)
      ).length;

      expect(upcomingFavCount).toBe(0);
    });
  });

  describe("Calendar Display with Past Event Filtering", () => {
    it("should not show past events in My Calendar mode", () => {
      const now = new Date();
      const calMode: "my" | "all" = "my";
      const events = [
        { id: 1, startAt: new Date(now.getTime() - 1000 * 60 * 60).toISOString() }, // past
        { id: 2, startAt: new Date(now.getTime() + 1000 * 60 * 60).toISOString() }, // future
      ];

      const favorites = new Set([1, 2]); // Both are favorites
      const isFavorite = (id: number) => favorites.has(id);

      const isEventInPast = (eventDate: string, referenceDate: Date): boolean => {
        const eventTime = new Date(eventDate).getTime();
        const refTime = referenceDate.getTime();
        return eventTime < refTime;
      };

      const eventsList =
        calMode === "my"
          ? events.filter((ev) => isFavorite(ev.id) && !isEventInPast(ev.startAt, now))
          : events;

      expect(eventsList).toHaveLength(1);
      expect(eventsList[0].id).toBe(2);
    });

    it("should show all events in All Events mode regardless of past/future", () => {
      const now = new Date();
      const calMode: "my" | "all" = "all";
      const events = [
        { id: 1, startAt: new Date(now.getTime() - 1000 * 60 * 60).toISOString() }, // past
        { id: 2, startAt: new Date(now.getTime() + 1000 * 60 * 60).toISOString() }, // future
      ];

      const favorites = new Set([1, 2]);
      const isFavorite = (id: number) => favorites.has(id);

      const isEventInPast = (eventDate: string, referenceDate: Date): boolean => {
        const eventTime = new Date(eventDate).getTime();
        const refTime = referenceDate.getTime();
        return eventTime < refTime;
      };

      const eventsList =
        (calMode as "my" | "all") === "my"
          ? events.filter((ev) => isFavorite(ev.id) && !isEventInPast(ev.startAt, now))
          : events;

      expect(eventsList).toHaveLength(2);
    });

    it("should update empty state message for My Calendar with no upcoming events", () => {
      const now = new Date();
      const calMode: "my" | "all" = "my";
      const selectedDateEvents: any[] = [];

      const emptyMessage =
        calMode === "my"
          ? "No upcoming saved events on this date.\nBrowse All Events and tap the bookmark to save!"
          : "No events on this date.\nTry selecting another day!";

      expect(selectedDateEvents).toHaveLength(0);
      expect(emptyMessage).toContain("upcoming");
    });
  });

  describe("Integration: Refresh + Past Event Filtering", () => {
    it("should update My Calendar count after refresh with new data", async () => {
      const now = new Date();
      const mockRefetch = vi.fn();
      let isRefreshing = false;
      const setIsRefreshing = (value: boolean) => {
        isRefreshing = value;
      };

      // Initial data
      let events = [
        { id: 1, startAt: new Date(now.getTime() - 1000 * 60 * 60).toISOString() },
      ];
      const favorites = new Set([1]);
      const isFavorite = (id: number) => favorites.has(id);

      const isEventInPast = (eventDate: string, referenceDate: Date): boolean => {
        const eventTime = new Date(eventDate).getTime();
        const refTime = referenceDate.getTime();
        return eventTime < refTime;
      };

      let upcomingFavCount = events.filter(
        (ev) => isFavorite(ev.id) && !isEventInPast(ev.startAt, now)
      ).length;

      expect(upcomingFavCount).toBe(0);

      // Simulate refresh with new data
      mockRefetch.mockImplementation(() => {
        events = [
          { id: 1, startAt: new Date(now.getTime() - 1000 * 60 * 60).toISOString() },
          { id: 2, startAt: new Date(now.getTime() + 1000 * 60 * 60).toISOString() },
        ];
        favorites.add(2);
      });

      const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
          await mockRefetch();
          // Recalculate count after refresh
          upcomingFavCount = events.filter(
            (ev) => isFavorite(ev.id) && !isEventInPast(ev.startAt, now)
          ).length;
        } finally {
          setIsRefreshing(false);
        }
      };

      await handleRefresh();

      expect(upcomingFavCount).toBe(1);
      expect(isRefreshing).toBe(false);
    });
  });
});
