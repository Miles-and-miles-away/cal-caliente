import { Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useFavorites } from "@/lib/favorites-context";
import {
  DANCE_STYLE_COLORS,
  DANCE_STYLE_LABELS,
  formatEventDate,
  formatEventTime,
  capitalizeFirst,
} from "@/shared/types";

interface EventCardProps {
  event: {
    id: number;
    title: string;
    danceStyle?: string | null;
    eventType?: string | null;
    startAt: string | Date;
    isAllDay?: boolean | null;
    venueName?: string | null;
    city?: string | null;
    nearestStation?: string | null;
    price?: string | null;
    isVerified?: boolean;
  };
  compact?: boolean;
  /** Public RSVP counts for browse-time social proof. Absent ⇒ render nothing. */
  attendance?: { interested: number; going: number };
}

export function EventCard({ event, compact = false, attendance }: EventCardProps) {
  const colors = useColors();
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const saved = isFavorite(event.id);
  const styleColor = DANCE_STYLE_COLORS[event.danceStyle ?? "other"] ?? DANCE_STYLE_COLORS.other;
  const dateStr = typeof event.startAt === "string" ? event.startAt : event.startAt.toISOString();

  // Social-proof badge: prefer "going"; fall back to "interested". Hidden when
  // both are 0 so brand-new events aren't littered with "0 going".
  const goingN = attendance?.going ?? 0;
  const interestedN = attendance?.interested ?? 0;
  const rsvpLabel = goingN > 0 ? `${goingN} going` : interestedN > 0 ? `${interestedN} interested` : null;

  const handleSave = () => {
    toggleFavorite(event.id);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <Pressable
      onPress={() => router.push(`/event/${event.id}` as any)}
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: saved ? styleColor + "60" : colors.border,
          overflow: "hidden",
        }}
      >
        <View style={{ height: 3, backgroundColor: styleColor }} />
        <View style={{ padding: compact ? 12 : 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 6 }}>
            <View
              style={{
                backgroundColor: styleColor + "20",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: styleColor, fontSize: 11, fontWeight: "700" }}>
                {DANCE_STYLE_LABELS[event.danceStyle ?? "other"] ?? "Dance"}
              </Text>
            </View>
            {event.eventType && (
              <View
                style={{
                  backgroundColor: colors.background,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "500" }}>
                  {capitalizeFirst(event.eventType)}
                </Text>
              </View>
            )}
            {event.isVerified && (
              <IconSymbol name="checkmark.circle.fill" size={14} color={colors.success} />
            )}
            {rsvpLabel && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  backgroundColor: styleColor + "18",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                }}
              >
                <Text style={{ fontSize: 10 }}>🔥</Text>
                <Text style={{ color: styleColor, fontSize: 11, fontWeight: "700" }}>{rsvpLabel}</Text>
              </View>
            )}
            {/* Spacer */}
            <View style={{ flex: 1 }} />
            {/* Save / Bookmark button */}
            <Pressable
              onPress={handleSave}
              hitSlop={12}
              style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 2 }]}
            >
              <IconSymbol
                name={saved ? "bookmark.fill" : "bookmark"}
                size={18}
                color={saved ? styleColor : colors.muted}
              />
            </Pressable>
          </View>

          <Text
            style={{ color: colors.foreground, fontSize: compact ? 14 : 16, fontWeight: "700", marginBottom: 6 }}
            numberOfLines={2}
          >
            {event.title}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <IconSymbol name="calendar" size={13} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 6 }}>
              {formatEventDate(dateStr)} · {event.isAllDay ? "All day" : formatEventTime(dateStr)}
            </Text>
          </View>

          {event.venueName && (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <IconSymbol name="mappin.and.ellipse" size={13} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 6, flex: 1 }} numberOfLines={1}>
                {event.venueName}{event.city ? ` · ${event.city}` : ""}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {event.nearestStation && (
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                🚉 {event.nearestStation}
              </Text>
            )}
            {event.price && (
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>
                {event.price}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
