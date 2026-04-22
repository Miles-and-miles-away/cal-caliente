import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { EventCard } from "@/components/event-card";
import { FilterChips } from "@/components/filter-chips";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import {
  DANCE_STYLE_OPTIONS,
  JAPAN_CITIES,
  DATE_RANGE_OPTIONS,
  API_EVENT_LOOKBACK_DAYS,
} from "@/shared/constants";

export default function DiscoverScreen() {
  const colors = useColors();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [danceFilter, setDanceFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("upcoming");
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  let startDate: string | undefined;
  let endDate: string | undefined;

  if (dateRange === "upcoming") {
    startDate = now.toISOString();
  } else if (dateRange === "week") {
    startDate = now.toISOString();
    endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (dateRange === "month") {
    startDate = now.toISOString();
    endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (dateRange === "past_month") {
    startDate = new Date(now.getTime() - API_EVENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    endDate = now.toISOString();
  }
  // "all" → no date filters

  const { data: events, isLoading, refetch } = trpc.events.list.useQuery({
    danceStyle: danceFilter === "all" ? undefined : danceFilter,
    city: cityFilter || undefined,
    startDate,
    endDate,
    search: search.trim() || undefined,
    limit: 100,
  });

  const eventsList = (events ?? []) as any[];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const renderEvent = useCallback(
    ({ item }: { item: any }) => (
      <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
        <EventCard event={item} />
      </View>
    ),
    []
  );

  return (
    <ScreenContainer>
      <FlatList
        data={eventsList}
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={renderEvent}
        ListHeaderComponent={
          <View>
            <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
              <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "800" }}>Discover</Text>
            </View>

            {/* Search bar */}
            <View
              style={{
                marginHorizontal: 16,
                marginBottom: 12,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 12,
              }}
            >
              <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  fontSize: 15,
                  color: colors.foreground,
                }}
                placeholder="Search events, venues, organizers..."
                placeholderTextColor={colors.muted}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                  <IconSymbol name="xmark" size={16} color={colors.muted} />
                </Pressable>
              )}
            </View>

            {/* Filters */}
            <View style={{ marginBottom: 8 }}>
              <FilterChips options={DANCE_STYLE_OPTIONS} selected={danceFilter} onSelect={setDanceFilter} />
            </View>
            <View style={{ marginBottom: 8 }}>
              <FilterChips options={JAPAN_CITIES} selected={cityFilter} onSelect={setCityFilter} />
            </View>
            <View style={{ marginBottom: 12 }}>
              <FilterChips options={DATE_RANGE_OPTIONS} selected={dateRange} onSelect={setDateRange} />
            </View>

            {/* Manage Sources link */}
            <Pressable
              onPress={() => router.push("/sites" as any)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View
                style={{
                  marginHorizontal: 16,
                  marginBottom: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                }}
              >
                <Text style={{ fontSize: 16, marginRight: 8 }}>🌐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
                    Manage Event Sources
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Add your dance school website or social media
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </View>
            </Pressable>

            {/* Results count */}
            <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {eventsList.length} event{eventsList.length !== 1 ? "s" : ""} found
                {dateRange === "past_month" ? " (past month)" : ""}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            {isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🔍</Text>
                <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
                  No events found.{"\n"}Try different filters or search terms.
                </Text>
              </View>
            )}
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </ScreenContainer>
  );
}
