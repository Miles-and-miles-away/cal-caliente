import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
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
  DANCE_STYLE_LABELS,
  JAPAN_CITIES,
  API_EVENT_LOOKAHEAD_DAYS,
  DEFAULT_MAP_REGION,
  CITY_COORDINATES,
} from "@/shared/constants";
import { formatEventDate, formatEventTime } from "@/shared/types";

export default function MapScreen() {
  const colors = useColors();
  const router = useRouter();
  const [danceFilter, setDanceFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const now = useMemo(() => new Date(), []);
  const lookaheadEnd = useMemo(
    () => new Date(now.getTime() + API_EVENT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000),
    [now]
  );

  const { data: events, isLoading, refetch } = trpc.events.list.useQuery({
    danceStyle: danceFilter === "all" ? undefined : danceFilter,
    city: cityFilter || undefined,
    startDate: now.toISOString(),
    endDate: lookaheadEnd.toISOString(),
    limit: 100,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const eventsWithLocation = useMemo(() => {
    if (!events) return [];
    return (events as any[]).filter((e: any) => e.latitude && e.longitude);
  }, [events]);

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

  // Get map center based on selected city
  const mapCenter = useMemo(() => {
    if (cityFilter && cityFilter in CITY_COORDINATES) {
      const coords = CITY_COORDINATES[cityFilter as keyof typeof CITY_COORDINATES];
      return { lat: coords.lat, lng: coords.lng, zoom: 12 };
    }
    return { lat: DEFAULT_MAP_REGION.latitude, lng: DEFAULT_MAP_REGION.longitude, zoom: 10 };
  }, [cityFilter]);

  // Build an inline HTML map using Leaflet (no API key needed)
  const mapHtml = useMemo(() => {
    const markers = eventsWithLocation.map((ev: any) => {
      const color = DANCE_STYLE_COLORS[ev.danceStyle ?? "other"] ?? "#718096";
      const label = (ev.title ?? "").replace(/'/g, "").replace(/\n/g, " ");
      const style = DANCE_STYLE_LABELS[ev.danceStyle ?? "other"] ?? "Dance";
      return `L.circleMarker([${ev.latitude}, ${ev.longitude}], {radius: 8, fillColor: '${color}', color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9}).addTo(map).bindPopup('<b>${label}</b><br/><small>${style}</small>');`;
    });

    return `<!DOCTYPE html
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
</head><body>
<div id="map"></div>
<script>
var map = L.map('map').setView([${mapCenter.lat}, ${mapCenter.lng}], ${mapCenter.zoom});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
  maxZoom: 18
}).addTo(map);
${markers.join("\n")}
</script>
</body></html>`;
  }, [eventsWithLocation, mapCenter]);

  const openEventInMaps = (ev: any) => {
    if (!ev?.latitude || !ev?.longitude) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${ev.latitude},${ev.longitude}`;
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url);
    }
  };

  return (
    <ScreenContainer>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
        <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "800" }}>Map</Text>
      </View>

      {/* Filters */}
      <View style={{ marginBottom: 6 }}>
        <FilterChips options={DANCE_STYLE_OPTIONS} selected={danceFilter} onSelect={setDanceFilter} />
      </View>
      <View style={{ marginBottom: 8 }}>
        <FilterChips options={JAPAN_CITIES} selected={cityFilter} onSelect={setCityFilter} />
      </View>

      {isLoading ? (
        <View style={{ alignItems: "center", paddingVertical: 64 }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
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
              {eventsWithLocation.length} events with locations across {cities.length} cit{cities.length !== 1 ? "ies" : "y"}
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
                No events with location data found.{"\n"}Try changing the filters.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
