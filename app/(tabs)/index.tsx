import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { EventCard } from "@/components/event-card";
import { FilterChips } from "@/components/filter-chips";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useFavorites } from "@/lib/favorites-context";
import { DANCE_STYLE_OPTIONS, DANCE_STYLE_COLORS } from "@/shared/constants";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type CalendarMode = "all" | "my";

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isEventInPast(eventDate: string, now: Date): boolean {
  const eventTime = new Date(eventDate).getTime();
  const nowTime = now.getTime();
  return eventTime < nowTime;
}

export default function CalendarScreen() {
  const colors = useColors();
  const { isFavorite, count: favCount } = useFavorites();
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [danceFilter, setDanceFilter] = useState<string>("all");
  const [calMode, setCalMode] = useState<CalendarMode>("all");

  const monthStart = useMemo(() => new Date(currentYear, currentMonth, 1), [currentYear, currentMonth]);
  const monthEnd = useMemo(() => new Date(currentYear, currentMonth + 1, 0, 23, 59, 59), [currentYear, currentMonth]);

  // Memoize query parameters to prevent unnecessary refetches
  const queryParams = useMemo(
    () => ({
      danceStyle: danceFilter === "all" ? undefined : danceFilter,
      startDate: monthStart.toISOString(),
      endDate: monthEnd.toISOString(),
      limit: 200,
    }),
    [danceFilter, monthStart, monthEnd]
  );

  const { data: events, isLoading, refetch } = trpc.events.list.useQuery(queryParams);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const eventsList = useMemo(() => {
    const raw = (events ?? []) as any[];
    if (calMode === "my") {
      // Filter to only show upcoming favorites (not past events)
      return raw.filter((ev: any) => isFavorite(ev.id) && !isEventInPast(ev.startAt, today));
    }
    return raw;
  }, [events, calMode, isFavorite, today]);

  // Count only upcoming favorites for the badge
  const upcomingFavCount = useMemo(() => {
    const raw = (events ?? []) as any[];
    return raw.filter((ev: any) => isFavorite(ev.id) && !isEventInPast(ev.startAt, today)).length;
  }, [events, isFavorite, today]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const ev of eventsList) {
      const d = new Date(ev.startAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [eventsList]);

  const selectedDateEvents = useMemo(() => {
    const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
    return eventsByDate[key] ?? [];
  }, [selectedDate, eventsByDate]);

  const days = useMemo(() => getDaysInMonth(currentYear, currentMonth), [currentYear, currentMonth]);
  const firstDayOffset = days[0]?.getDay() ?? 0;

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else setCurrentMonth(currentMonth - 1);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else setCurrentMonth(currentMonth + 1);
  };

  const handleModeToggle = (mode: CalendarMode) => {
    setCalMode(mode);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "800" }}>Calendar</Text>
        </View>

        {/* All / My Cal Toggle */}
        <View style={{ flexDirection: "row", marginHorizontal: 16, marginTop: 8, marginBottom: 4, borderRadius: 10, backgroundColor: colors.surface, padding: 3 }}>
          {(["all", "my"] as CalendarMode[]).map((mode) => {
            const active = calMode === mode;
            const label = mode === "all" ? "All Events" : `My Calendar${upcomingFavCount > 0 ? ` (${upcomingFavCount})` : ""}`;
            return (
              <Pressable
                key={mode}
                onPress={() => handleModeToggle(mode)}
                style={({ pressed }) => [{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 8,
                  alignItems: "center",
                  backgroundColor: active ? colors.primary : "transparent",
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Text style={{ color: active ? "#FFFFFF" : colors.muted, fontSize: 13, fontWeight: "600" }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Month navigation */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
          <Pressable onPress={goToPrevMonth} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 8 }]}>
            <Text style={{ color: colors.primary, fontSize: 20, fontWeight: "600" }}>‹</Text>
          </Pressable>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>{monthLabel}</Text>
          <Pressable onPress={goToNextMonth} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 8 }]}>
            <Text style={{ color: colors.primary, fontSize: 20, fontWeight: "600" }}>›</Text>
          </Pressable>
        </View>

        {/* Weekday headers */}
        <View style={{ flexDirection: "row", paddingHorizontal: 8 }}>
          {WEEKDAYS.map((day) => (
            <View key={day} style={{ flex: 1, alignItems: "center", paddingBottom: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, marginBottom: 12 }}>
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <View key={`empty-${i}`} style={{ width: "14.28%", height: 44 }} />
          ))}
          {days.map((day) => {
            const dateKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const dayEvents = eventsByDate[dateKey] ?? [];
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, today);
            const hasEvents = dayEvents.length > 0;
            const styles = [...new Set(dayEvents.map((e: any) => e.danceStyle ?? "other"))];

            return (
              <Pressable
                key={day.toISOString()}
                onPress={() => setSelectedDate(day)}
                style={({ pressed }) => [{
                  width: "14.28%",
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.7 : 1,
                }]}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isSelected ? colors.primary : "transparent",
                    borderWidth: isToday && !isSelected ? 1.5 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: isSelected || isToday ? "700" : "400",
                      color: isSelected ? "#FFFFFF" : isToday ? colors.primary : colors.foreground,
                    }}
                  >
                    {day.getDate()}
                  </Text>
                </View>
                {hasEvents && (
                  <View style={{ flexDirection: "row", gap: 2, marginTop: 1, position: "absolute", bottom: 2 }}>
                    {styles.slice(0, 3).map((s: string, i: number) => (
                      <View
                        key={i}
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: isSelected ? "#FFFFFF" : DANCE_STYLE_COLORS[s] ?? colors.muted,
                        }}
                      />
                    ))}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Dance style filter */}
        <View style={{ marginBottom: 12 }}>
          <FilterChips options={DANCE_STYLE_OPTIONS} selected={danceFilter} onSelect={setDanceFilter} />
        </View>

        {/* Selected date label */}
        <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
            {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? "s" : ""}
            {calMode === "my" ? " saved" : ""}
          </Text>
        </View>

        {/* Events list */}
        {isLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : selectedDateEvents.length > 0 ? (
          <View>
            {selectedDateEvents.map((event: any) => (
              <View key={event.id} style={{ marginHorizontal: 16, marginBottom: 10 }}>
                <EventCard event={event} compact />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>
              {calMode === "my" ? "🔖" : "💃"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
              {calMode === "my"
                ? "No upcoming saved events on this date.\nBrowse All Events and tap the bookmark to save!"
                : "No events on this date.\nTry selecting another day!"}
            </Text>
          </View>
        )}

        {/* Refresh button */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, marginBottom: 20 }}>
          <Pressable
            onPress={handleRefresh}
            disabled={isRefreshing || isLoading}
            style={({ pressed }) => [
              {
                backgroundColor: isRefreshing || isLoading ? "#D81B60" : "#E91E63",
                borderRadius: 8,
                paddingVertical: 12,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
                Refresh
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
