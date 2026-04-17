import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { DANCE_STYLE_OPTIONS, DANCE_STYLE_COLORS, JAPAN_CITIES, API_EVENT_LOOKAHEAD_DAYS, formatEventDate, formatEventTime } from "@/shared/types";

export default function MapScreen() {
  const colors = useColors();
  const router = useRouter();
  const [danceFilter, setDanceFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("");

  const now = useMemo(() => new Date(), []);
  const lookaheadEnd = useMemo(() => new Date(now.getTime() + API_EVENT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000), [now]);

  const { data: events, isLoading } = trpc.events.list.useQuery({
    danceStyle: danceFilter === "all" ? undefined : danceFilter,
    city: cityFilter || undefined,
    startDate: now.toISOString(),
    endDate: lookaheadEnd.toISOString(),
    limit: 100,
  });

  const eventsWithLocation = useMemo(() => {
    if (!events) return [];
    return (events as any[]).filter((e: any) => e.latitude && e.longitude);
  }, [events]);

  // Group events by city
  const eventsByCity = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const ev of eventsWithLocation) {
      const city = ev.city ?? "Other";
      if (!map[city]) map[city] = [];
      map[city].push(ev);
    }
    return map;
  }, [eventsWithLocation]);

  const cities = Object.keys(eventsByCity).sort();

  const formatTime = (dateStr: string) =>
    `${formatEventDate(dateStr)} · ${formatEventTime(dateStr)}`;

  return (
    <ScreenContainer>
      <View className="px-5 pt-2 pb-3">
        <Text className="text-foreground text-2xl font-bold">Map</Text>
      </View>

      {/* Filters */}
      <View className="mb-2">
        <FilterChips options={DANCE_STYLE_OPTIONS} selected={danceFilter} onSelect={setDanceFilter} />
      </View>
      <View className="mb-3">
        <FilterChips options={JAPAN_CITIES} selected={cityFilter} onSelect={setCityFilter} />
      </View>

      {/* Info banner */}
      <View className="mx-4 mb-3 bg-surface rounded-xl border border-border p-3 flex-row items-center">
        <IconSymbol name="map.fill" size={20} color={colors.primary} />
        <View className="ml-3 flex-1">
          <Text className="text-foreground text-xs font-semibold">
            {eventsWithLocation.length} events with locations
          </Text>
          <Text className="text-muted text-xs">
            Tap an event for details and directions via Google Maps
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="items-center py-16">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {cities.map((city) => (
            <View key={city} className="mb-4">
              <View className="flex-row items-center px-5 mb-2">
                <Text style={{ fontSize: 14 }}>📍</Text>
                <Text className="text-foreground text-sm font-bold ml-1.5">
                  {city}
                </Text>
                <Text className="text-muted text-xs ml-2">
                  {eventsByCity[city].length} event{eventsByCity[city].length !== 1 ? "s" : ""}
                </Text>
              </View>

              {eventsByCity[city].map((event: any) => (
                <Pressable
                  key={event.id}
                  onPress={() => router.push(`/event/${event.id}` as any)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <View className="flex-row items-center mx-4 mb-1.5 bg-surface rounded-xl border border-border px-3 py-3">
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: DANCE_STYLE_COLORS[event.danceStyle ?? "other"],
                        marginRight: 12,
                      }}
                    />
                    <View className="flex-1">
                      <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
                        {event.title}
                      </Text>
                      <Text className="text-muted text-xs mt-0.5">
                        {event.venueName ?? "TBA"} · {event.nearestStation ? `🚉 ${event.nearestStation}` : ""}
                      </Text>
                      <Text className="text-muted text-xs">{formatTime(event.startAt)}</Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </View>
                </Pressable>
              ))}
            </View>
          ))}

          {cities.length === 0 && (
            <View className="items-center py-12">
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🗺️</Text>
              <Text className="text-muted text-sm text-center">
                No events with location data found.{"\n"}Try changing the filters.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
