import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { FilterChips } from "@/components/filter-chips";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import {
  DANCE_STYLE_OPTIONS,
  DANCE_STYLE_COLORS,
  JAPAN_CITIES,
  MAP_DATE_RANGE_OPTIONS,
  API_EVENT_LOOKAHEAD_DAYS,
  DEFAULT_MAP_REGION,
  CITY_COORDINATES,
} from "@/shared/constants";
import { formatEventDate, formatEventTime } from "@/shared/types";
import { buildMapHtml } from "@/lib/map-html";

export default function MapScreen() {
  const colors = useColors();
  const router = useRouter();
  const [danceFilter, setDanceFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("upcoming");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const now = useMemo(() => new Date(), []);
  const { startDate, endDate } = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    // Local-midnight boundaries so "Today"/"Tomorrow" match the user's clock.
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (dateRange) {
      case "today":
        return { startDate: now, endDate: new Date(startOfToday.getTime() + DAY) };
      case "tomorrow":
        return {
          startDate: new Date(startOfToday.getTime() + DAY),
          endDate: new Date(startOfToday.getTime() + 2 * DAY),
        };
      case "week":
        return { startDate: now, endDate: new Date(now.getTime() + 7 * DAY) };
      case "month":
        return { startDate: now, endDate: new Date(now.getTime() + 30 * DAY) };
      default: // "upcoming" — original lookahead window
        return { startDate: now, endDate: new Date(now.getTime() + API_EVENT_LOOKAHEAD_DAYS * DAY) };
    }
  }, [now, dateRange]);

  const { data: events, isLoading, refetch } = trpc.events.list.useQuery({
    danceStyle: danceFilter === "all" ? undefined : danceFilter,
    city: cityFilter || undefined,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    limit: 100,
  });

  // Events enriched with map coordinates. Sources like iCal feeds carry no
  // lat/lng, so events without real coordinates fall back to an approximate
  // pin near their city center (marked `approx`); events with neither
  // coordinates nor a known city stay in the list but get no pin.
  const enrichedEvents = useMemo(() => {
    if (!events) return [];
    return (events as any[]).map((e: any) => {
      // Drizzle returns decimal columns as strings, so `"0.0000000"` is truthy
      // and a naive truthy-check would render literal 0,0 events at the
      // null island. Parse and verify both coordinates are real, finite, and
      // non-zero (any event placed exactly at 0,0 is almost certainly a stub).
      const lat = Number(e.latitude);
      const lng = Number(e.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
        return { ...e, approx: false };
      }
      const center = e.city ? CITY_COORDINATES[e.city] : undefined;
      if (!center) return { ...e, latitude: null, longitude: null, approx: false };
      // Deterministic jitter (golden-angle spiral keyed by event id) so
      // same-city pins neither stack nor jump between renders.
      const angle = ((e.id * 137.508) % 360) * (Math.PI / 180);
      const radius = 0.006 + (e.id % 5) * 0.003;
      return {
        ...e,
        latitude: center.latitude + radius * Math.sin(angle),
        longitude: center.longitude + radius * Math.cos(angle),
        approx: true,
      };
    });
  }, [events]);

  const pinnedEvents = useMemo(
    () =>
      enrichedEvents.filter((e: any) => {
        const lat = Number(e.latitude);
        const lng = Number(e.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
      }),
    [enrichedEvents],
  );

  const approxCount = useMemo(
    () => pinnedEvents.filter((e: any) => e.approx).length,
    [pinnedEvents],
  );

  const eventsByCity = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const ev of enrichedEvents) {
      const city = ev.city ?? "Other";
      if (!map[city]) map[city] = [];
      map[city].push(ev);
    }
    return map;
  }, [enrichedEvents]);

  const cities = Object.keys(eventsByCity).sort();

  const mapHtml = useMemo(
    () => buildMapHtml(pinnedEvents, DEFAULT_MAP_REGION),
    [pinnedEvents],
  );

  const openEventInMaps = (ev: any) => {
    // Exact coordinates → pin search; approximate/no pin → search by venue
    // name + city so Google Maps finds the real place rather than a
    // city-center fallback point.
    let url: string;
    if (ev?.latitude && ev?.longitude && !ev.approx) {
      url = `https://www.google.com/maps/search/?api=1&query=${ev.latitude},${ev.longitude}`;
    } else {
      const query = [ev?.venueName, ev?.city].filter(Boolean).join(" ");
      if (!query) return;
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url);
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

  return (
    <ScreenContainer>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
        <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "800" }}>Map</Text>
      </View>

      {/* Filters */}
      <View style={{ marginBottom: 6 }}>
        <FilterChips options={DANCE_STYLE_OPTIONS} selected={danceFilter} onSelect={setDanceFilter} />
      </View>
      <View style={{ marginBottom: 6 }}>
        <FilterChips options={JAPAN_CITIES} selected={cityFilter} onSelect={setCityFilter} />
      </View>
      <View style={{ marginBottom: 8 }}>
        <FilterChips options={MAP_DATE_RANGE_OPTIONS} selected={dateRange} onSelect={setDateRange} />
      </View>

      {isLoading ? (
        <View style={{ alignItems: "center", paddingVertical: 64 }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {/* In-app Map */}
          {Platform.OS === "web" ? (
            <View style={{ marginHorizontal: 16, marginBottom: 12, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
              <iframe
                srcDoc={mapHtml}
                style={{ width: "100%", height: 280, border: "none" }}
                title="Event Map"
              />
            </View>
          ) : (
            <View style={{ marginHorizontal: 16, marginBottom: 12, borderRadius: 16, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, height: 200, alignItems: "center", justifyContent: "center" }}>
              <IconSymbol name="map.fill" size={32} color={colors.primary} />
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8, textAlign: "center" }}>
                Interactive map available in Expo Go.{"\n"}Tap events below for Google Maps directions.
              </Text>
            </View>
          )}

          {/* Stats banner */}
          <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: "row", alignItems: "center" }}>
            <IconSymbol name="mappin.and.ellipse" size={18} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", marginLeft: 8 }}>
              {enrichedEvents.length} event{enrichedEvents.length !== 1 ? "s" : ""} across {cities.length} cit{cities.length !== 1 ? "ies" : "y"}
              {approxCount > 0 ? ` · ${approxCount} pin${approxCount !== 1 ? "s" : ""} approximate` : ""}
            </Text>
          </View>

          {/* Events grouped by city */}
          {cities.map((city) => (
            <View key={city} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 8 }}>
                <Text style={{ fontSize: 14 }}>📍</Text>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "700", marginLeft: 6 }}>
                  {city}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 8 }}>
                  {eventsByCity[city].length} event{eventsByCity[city].length !== 1 ? "s" : ""}
                </Text>
              </View>

              {eventsByCity[city].map((event: any) => (
                <Pressable
                  key={event.id}
                  onPress={() => router.push(`/event/${event.id}` as any)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginHorizontal: 16,
                    marginBottom: 6,
                    backgroundColor: selectedEventId === event.id ? colors.primary + "10" : colors.surface,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selectedEventId === event.id ? colors.primary + "40" : colors.border,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: DANCE_STYLE_COLORS[event.danceStyle ?? "other"] ?? colors.muted, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                        {event.venueName ?? "TBA"}{event.nearestStation ? ` · 🚉 ${event.nearestStation}` : ""}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        {formatEventDate(event.startAt)} · {formatEventTime(event.startAt)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => openEventInMaps(event)}
                      hitSlop={10}
                      style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}
                    >
                      <IconSymbol name="location.fill" size={18} color={colors.primary} />
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}

          {cities.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🗺️</Text>
              <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
                No events found.{"\n"}Try changing the filters.
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
      )}
    </ScreenContainer>
  );
}
