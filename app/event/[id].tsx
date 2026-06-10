import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { startOAuthLogin } from "@/constants/oauth";
import { useFavorites } from "@/lib/favorites-context";
import { trpc } from "@/lib/trpc";
import { isSafeExternalUrl } from "@/lib/utils";
import {
  DANCE_STYLE_COLORS,
  DANCE_STYLE_LABELS,
} from "@/shared/constants";
import {
  formatFullDate,
  formatEventTime,
  capitalizeFirst,
} from "@/shared/types";

export default function EventDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Strict integer parse — `parseInt("123abc")` returns 123 and would query
  // the wrong event. Require the whole string to be digits.
  const eventId = id && /^\d+$/.test(id) ? Number(id) : 0;
  const { isFavorite, toggleFavorite } = useFavorites();
  const saved = isFavorite(eventId);
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: event, isLoading } = trpc.events.get.useQuery(
    { id: eventId },
    { enabled: eventId > 0 }
  );

  // Public RSVP counts + the caller's own status (null when signed out).
  const { data: attendance } = trpc.events.attendance.useQuery(
    { eventId },
    { enabled: eventId > 0 }
  );
  const setAttendance = trpc.events.setAttendance.useMutation({
    onSuccess: () => {
      utils.events.attendance.invalidate({ eventId });
      // Refresh the browse-time card badges so the user's own RSVP shows there too.
      utils.events.attendanceCounts.invalidate();
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      Alert.alert(/login|unauthor/i.test(msg) ? "Sign in required" : "Couldn't update RSVP", msg);
    },
  });

  const handleRsvp = (status: "interested" | "going") => {
    if (!isAuthenticated) {
      Alert.alert("Sign in required", "Please sign in to RSVP to this event.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign In", onPress: () => startOAuthLogin().catch(() => {}) },
      ]);
      return;
    }
    // Tapping the current status again clears it; otherwise switch to it.
    const next = attendance?.myStatus === status ? null : status;
    setAttendance.mutate({ eventId, status: next });
  };

  const ev = event as any;

  const handleSave = () => {
    toggleFavorite(eventId);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(
        saved
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      );
    }
  };

  const openMaps = () => {
    if (!ev?.latitude || !ev?.longitude) return;
    const lat = ev.latitude;
    const lng = ev.longitude;
    const label = encodeURIComponent(ev.venueName ?? "Event");

    if (Platform.OS === "web") {
      // Always use Google Maps on web
      window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, "_blank");
      return;
    }

    const url =
      Platform.OS === "ios"
        ? `maps:0,0?q=${label}@${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  };

  const shareEvent = () => {
    if (!ev) return;
    const text = `${ev.title}\n${formatFullDate(ev.startAt)} at ${formatEventTime(ev.startAt)}\n${ev.venueName ?? ""}, ${ev.city ?? ""}`;
    if (Platform.OS === "web") {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!ev) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 16 }}>Event not found</Text>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ marginTop: 16, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>Go Back</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const styleColor = DANCE_STYLE_COLORS[ev.danceStyle ?? "other"] ?? DANCE_STYLE_COLORS.other;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header with back, save, share */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
            <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
          </Pressable>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <Pressable onPress={handleSave} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
              <IconSymbol
                name={saved ? "bookmark.fill" : "bookmark"}
                size={22}
                color={saved ? styleColor : colors.foreground}
              />
            </Pressable>
            <Pressable onPress={shareEvent} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
              <IconSymbol name="square.and.arrow.up" size={22} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        {/* Save banner when saved */}
        {saved && (
          <View style={{ backgroundColor: styleColor + "15", marginHorizontal: 16, borderRadius: 10, padding: 10, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <IconSymbol name="bookmark.fill" size={14} color={styleColor} />
            <Text style={{ color: styleColor, fontSize: 12, fontWeight: "600" }}>Saved to My Calendar</Text>
          </View>
        )}

        <View style={{ height: 4, backgroundColor: styleColor, marginHorizontal: 16, borderRadius: 2 }} />

        {/* Hero image (user-submitted flyers, or any event with an imageUrl) */}
        {ev.imageUrl ? (
          <Image
            source={{ uri: ev.imageUrl }}
            style={{ width: "100%", height: 200, marginTop: 12, backgroundColor: colors.surface }}
            contentFit="cover"
            transition={150}
          />
        ) : null}

        <View style={{ padding: 20 }}>
          {/* Badges */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <View style={{ backgroundColor: styleColor + "20", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14 }}>
              <Text style={{ color: styleColor, fontSize: 12, fontWeight: "700" }}>
                {DANCE_STYLE_LABELS[ev.danceStyle ?? "other"] ?? "Dance"}
              </Text>
            </View>
            {ev.eventType && (
              <View style={{ backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{capitalizeFirst(ev.eventType)}</Text>
              </View>
            )}
            {ev.isVerified ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <IconSymbol name="checkmark.circle.fill" size={14} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 11, fontWeight: "600" }}>Verified</Text>
              </View>
            ) : ev.submittedByUserId ? (
              // Distinguish user submissions specifically — scraped events are
              // also isVerified=false, so key off submittedByUserId, not !isVerified.
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <IconSymbol name="person.fill" size={12} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>Community submission</Text>
              </View>
            ) : null}
          </View>

          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "800", marginBottom: 16, lineHeight: 30 }}>
            {ev.title}
          </Text>

          <View style={{ gap: 10, marginBottom: 20 }}>
            {/* Date */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
              <IconSymbol name="calendar" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{formatFullDate(ev.startAt)}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                  {formatEventTime(ev.startAt)}{ev.endAt ? ` — ${formatEventTime(ev.endAt)}` : ""}
                </Text>
              </View>
            </View>

            {/* Venue */}
            {ev.venueName && (
              <Pressable onPress={openMaps} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                  <IconSymbol name="mappin.and.ellipse" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{ev.venueName}</Text>
                    {ev.venueAddress && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{ev.venueAddress}</Text>}
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600", marginTop: 4 }}>
                      {Platform.OS === "web" ? "Open in Google Maps" : "Open in Maps"} →
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}

            {/* Station & City */}
            {(ev.nearestStation || ev.city) && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                {ev.nearestStation && (
                  <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", marginBottom: 4 }}>STATION</Text>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>🚉 {ev.nearestStation}</Text>
                  </View>
                )}
                {ev.city && (
                  <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", marginBottom: 4 }}>CITY</Text>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{ev.city}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Price */}
            {ev.price && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", marginBottom: 4 }}>PRICE</Text>
                <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>{ev.price}</Text>
              </View>
            )}

            {/* Organizer */}
            {ev.organizer && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                <IconSymbol name="person.fill" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>ORGANIZER</Text>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>{ev.organizer}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Description */}
          {ev.description && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginBottom: 8 }}>About</Text>
              <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>{ev.description}</Text>
            </View>
          )}

          {/* Large Save Button */}
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [{
              backgroundColor: saved ? styleColor + "15" : styleColor,
              borderRadius: 14,
              padding: 16,
              alignItems: "center",
              marginBottom: 12,
              borderWidth: saved ? 1.5 : 0,
              borderColor: styleColor,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <IconSymbol
                name={saved ? "bookmark.fill" : "bookmark"}
                size={18}
                color={saved ? styleColor : "#FFFFFF"}
              />
              <Text style={{ color: saved ? styleColor : "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
                {saved ? "Saved to My Calendar" : "Save to My Calendar"}
              </Text>
            </View>
          </Pressable>

          {/* Interested / Going — public RSVP. Counts are visible to everyone
              (social proof); this is separate from the personal Save above. */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            {(["interested", "going"] as const).map((status) => {
              const active = attendance?.myStatus === status;
              const count =
                status === "going" ? attendance?.going ?? 0 : attendance?.interested ?? 0;
              return (
                <Pressable
                  key={status}
                  onPress={() => handleRsvp(status)}
                  disabled={setAttendance.isPending}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.surface,
                    opacity: pressed ? 0.8 : 1,
                  }]}
                >
                  <IconSymbol
                    name={status === "going" ? "checkmark.circle.fill" : "star.fill"}
                    size={16}
                    color={active ? "#FFFFFF" : colors.muted}
                  />
                  <Text style={{ color: active ? "#FFFFFF" : colors.foreground, fontSize: 14, fontWeight: "700" }}>
                    {status === "going" ? "Going" : "Interested"}
                  </Text>
                  <Text style={{ color: active ? "#FFFFFF" : colors.muted, fontSize: 13, fontWeight: "600" }}>
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Source link — only render if scraped URL passes http(s) check */}
          {isSafeExternalUrl(ev.sourceUrl) && (
            <Pressable onPress={() => Linking.openURL(ev.sourceUrl)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
                <IconSymbol name="link" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600", flex: 1 }}>View Original Source</Text>
                <IconSymbol name="chevron.right" size={14} color={colors.muted} />
              </View>
            </Pressable>
          )}

          {/* Web search — verification path that works even when privacy
              extensions block Google domains. DuckDuckGo by design. */}
          <Pressable
            onPress={() => {
              const query = [ev.title, ev.venueName, ev.city].filter(Boolean).join(" ");
              Linking.openURL(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`);
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
              <IconSymbol name="magnifyingglass" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600", flex: 1 }}>Search the Web</Text>
              <IconSymbol name="chevron.right" size={14} color={colors.muted} />
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
