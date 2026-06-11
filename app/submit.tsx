import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { startOAuthLogin } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";
import {
  DANCE_STYLES,
  DANCE_STYLE_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  JAPAN_CITIES,
} from "@/shared/constants";
import type { DanceStyle, EventType } from "@/shared/constants";
import { formatEventDate } from "@/shared/types";

// Server caps the decoded image at 600KB (under the 1MB request limit). Reject
// client-side too so the user gets immediate feedback instead of a failed POST.
const MAX_IMAGE_BYTES = 600 * 1024;

const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
type ImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

const CITY_CHIPS = JAPAN_CITIES.filter((c) => c.value);

// Build a JST ISO-8601 string from a `YYYY-MM-DD` date and `HH:mm` time. Events
// in this app are stored with the +09:00 offset. Returns null if either part is
// malformed so the caller can show a validation message.
function buildJstIso(dateStr: string, timeStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const iso = `${dateStr}T${timeStr}:00+09:00`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

// Normalize an Expo Router param (string | string[] | undefined) to a single string.
const paramStr = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v) ?? "";

export default function SubmitScreen() {
  const colors = useColors();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Prefill from route params — populated by the share-to-app flow (a shared URL
  // / title / text), and usable directly via /submit?link=…&title=…. Read once at
  // mount via lazy initial state so the user's later edits aren't clobbered.
  const params = useLocalSearchParams<{ link?: string; title?: string; text?: string }>();

  const [title, setTitle] = useState(() => paramStr(params.title));
  const [description, setDescription] = useState(() => paramStr(params.text));
  const [danceStyle, setDanceStyle] = useState<DanceStyle | null>(null);
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [date, setDate] = useState(""); // YYYY-MM-DD
  const [time, setTime] = useState(""); // HH:mm (24h)
  const [endTime, setEndTime] = useState(""); // optional HH:mm
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [city, setCity] = useState("");
  const [nearestStation, setNearestStation] = useState("");
  const [price, setPrice] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [link, setLink] = useState(() => paramStr(params.link));
  const [image, setImage] = useState<{ base64: string; mimeType: ImageMime; uri: string } | null>(null);
  // True while the pre-submission duplicate check is in flight (the submit
  // button shows the same busy state as the mutation itself).
  const [checking, setChecking] = useState(false);

  // Tell the user their submission matches an existing listing, with a
  // deep-link to it. Used by the pre-check and by the CONFLICT fallback below.
  const showDuplicateAlert = (dup: {
    id: number;
    title: string;
    startAt: string | Date;
    matchedBy: "canonicalKey" | "venueDateKey";
  }) => {
    const startIso = typeof dup.startAt === "string" ? dup.startAt : dup.startAt.toISOString();
    const how =
      dup.matchedBy === "canonicalKey"
        ? "an event with the same name on the same day"
        : "an event at the same venue and start time";
    Alert.alert(
      "Already on the calendar?",
      `Your submission matches ${how}: "${dup.title}" (${formatEventDate(startIso)}).`,
      [
        { text: "Keep Editing", style: "cancel" },
        { text: "View Event", onPress: () => router.push(`/event/${dup.id}` as any) },
      ],
    );
  };

  const submitMutation = trpc.events.submit.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate();
      Alert.alert("Event submitted", "Thanks! Your event is now on the calendar.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (err, variables) => {
      if (err.data?.code === "CONFLICT") {
        // The insert raced past the pre-check (or the check itself failed).
        // Look the existing event up so the alert can still deep-link to it.
        utils.events.checkDuplicate
          .fetch({
            title: variables.title,
            startAt: variables.startAt,
            venueName: variables.venueName,
          })
          .then((dup) => {
            if (dup) showDuplicateAlert(dup);
            else Alert.alert("Already listed", err.message);
          })
          .catch(() => Alert.alert("Already listed", err.message));
        return;
      }
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      const needsAuth = /login|unauthor/i.test(msg);
      Alert.alert(
        needsAuth ? "Sign in required" : "Couldn't submit",
        needsAuth ? "Please sign in to submit an event." : msg,
      );
    },
  });

  const handleSignIn = async () => {
    try {
      await startOAuthLogin();
    } catch (err) {
      console.warn("Sign-in failed to start:", err);
    }
  };

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photo access needed", "Allow photo access to attach a flyer.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.5,
        allowsEditing: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) {
        Alert.alert("Image error", "Could not read that image. Try another.");
        return;
      }
      const approxBytes = Math.floor(asset.base64.length * 0.75);
      if (approxBytes > MAX_IMAGE_BYTES) {
        Alert.alert("Image too large", "Please choose a smaller image (under ~600KB).");
        return;
      }
      const mimeType: ImageMime =
        asset.mimeType && (ALLOWED_IMAGE_MIME as readonly string[]).includes(asset.mimeType)
          ? (asset.mimeType as ImageMime)
          : "image/jpeg";
      setImage({ base64: asset.base64, mimeType, uri: asset.uri });
    } catch (err) {
      console.warn("Image pick failed:", err);
      Alert.alert("Image error", "Could not open the photo library.");
    }
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert("Missing title", "Please enter an event title.");
      return;
    }
    const startAt = buildJstIso(date.trim(), time.trim());
    if (!startAt) {
      Alert.alert("Invalid date/time", "Enter the date as YYYY-MM-DD and start time as HH:mm (24-hour).");
      return;
    }
    let endAt: string | undefined;
    if (endTime.trim()) {
      const e = buildJstIso(date.trim(), endTime.trim());
      if (!e) {
        Alert.alert("Invalid end time", "Enter the end time as HH:mm (24-hour), or leave it blank.");
        return;
      }
      endAt = e;
    }
    const trimmedLink = link.trim();
    if (trimmedLink) {
      try {
        const parsed = new URL(trimmedLink);
        if (!["https:", "http:"].includes(parsed.protocol)) {
          Alert.alert("Invalid link", "Link must start with https:// or http://");
          return;
        }
      } catch {
        Alert.alert("Invalid link", "Please enter a valid URL, or leave it blank.");
        return;
      }
    }

    // Advisory duplicate pre-check: warn before submitting a doomed duplicate.
    // Errors fall through to a normal submit — the server's UNIQUE indexes are
    // the real guarantee, and a CONFLICT there is handled in onError.
    setChecking(true);
    try {
      const dup = await utils.events.checkDuplicate.fetch({
        title: trimmedTitle,
        startAt,
        venueName: venueName.trim() || undefined,
      });
      if (dup) {
        showDuplicateAlert(dup);
        return;
      }
    } catch {
      // Best-effort only; proceed with the submission.
    } finally {
      setChecking(false);
    }

    submitMutation.mutate({
      title: trimmedTitle,
      startAt,
      endAt,
      description: description.trim() || undefined,
      danceStyle: danceStyle ?? undefined,
      eventType: eventType ?? undefined,
      venueName: venueName.trim() || undefined,
      venueAddress: venueAddress.trim() || undefined,
      city: city.trim() || undefined,
      nearestStation: nearestStation.trim() || undefined,
      price: price.trim() || undefined,
      organizer: organizer.trim() || undefined,
      sourceUrl: trimmedLink || undefined,
      image: image ? { base64: image.base64, mimeType: image.mimeType } : undefined,
    });
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const inputStyle = {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    fontSize: 14,
    color: colors.foreground,
  } as const;
  const labelStyle = {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 12,
  } as const;

  const Header = (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
        <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
      </Pressable>
      <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>Submit an Event</Text>
    </View>
  );

  if (authLoading) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        {Header}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        {Header}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 }}>
          <IconSymbol name="person.fill" size={36} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", textAlign: "center" }}>
            Sign in to add an event to the community calendar.
          </Text>
          <Pressable
            onPress={handleSignIn}
            accessibilityRole="button"
            style={({ pressed }) => [{ paddingHorizontal: 28, paddingVertical: 11, borderRadius: 10, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>Sign In</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {Header}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginBottom: 4 }}>
            Add a Latin-dance event you know about. It appears on the calendar for everyone, marked as a
            community submission.
          </Text>

          {/* Title */}
          <Text style={labelStyle}>Event Title *</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Saturday Salsa Social"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
            maxLength={500}
          />

          {/* Description */}
          <Text style={labelStyle}>Description</Text>
          <TextInput
            style={[inputStyle, { minHeight: 88, textAlignVertical: "top" }]}
            placeholder="What's happening? Levels, DJs, dress code…"
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            maxLength={5000}
            multiline
          />

          {/* Dance style chips */}
          <Text style={labelStyle}>Dance Style</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {DANCE_STYLES.map((s) => {
              const selected = danceStyle === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setDanceStyle(selected ? null : s)}
                  style={({ pressed }) => [{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 14,
                    backgroundColor: selected ? colors.primary : colors.background,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: selected ? "#FFFFFF" : colors.muted }}>
                    {DANCE_STYLE_LABELS[s]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Event type chips */}
          <Text style={labelStyle}>Event Type</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {EVENT_TYPES.map((t) => {
              const selected = eventType === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setEventType(selected ? null : t)}
                  style={({ pressed }) => [{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 14,
                    backgroundColor: selected ? colors.primary : colors.background,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: selected ? "#FFFFFF" : colors.muted }}>
                    {EVENT_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Date + time */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1.4 }}>
              <Text style={labelStyle}>Date *</Text>
              <TextInput
                style={inputStyle}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                value={date}
                onChangeText={setDate}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={10}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>Start *</Text>
              <TextInput
                style={inputStyle}
                placeholder="HH:mm"
                placeholderTextColor={colors.muted}
                value={time}
                onChangeText={setTime}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={5}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={labelStyle}>End</Text>
              <TextInput
                style={inputStyle}
                placeholder="HH:mm"
                placeholderTextColor={colors.muted}
                value={endTime}
                onChangeText={setEndTime}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={5}
              />
            </View>
          </View>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
            Times are Japan Standard Time (JST).
          </Text>

          {/* Venue */}
          <Text style={labelStyle}>Venue Name</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Studio Bachata Tokyo"
            placeholderTextColor={colors.muted}
            value={venueName}
            onChangeText={setVenueName}
            maxLength={500}
          />

          <Text style={labelStyle}>Address</Text>
          <TextInput
            style={inputStyle}
            placeholder="Street address (helps place it on the map)"
            placeholderTextColor={colors.muted}
            value={venueAddress}
            onChangeText={setVenueAddress}
            maxLength={2000}
          />

          {/* City chips + free text */}
          <Text style={labelStyle}>City</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {CITY_CHIPS.map((c) => {
              const selected = city === c.value;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => setCity(selected ? "" : c.value)}
                  style={({ pressed }) => [{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: selected ? colors.primary : colors.background,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: selected ? "#FFFFFF" : colors.muted }}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            style={inputStyle}
            placeholder="Or type a city"
            placeholderTextColor={colors.muted}
            value={city}
            onChangeText={setCity}
            maxLength={100}
          />

          <Text style={labelStyle}>Nearest Station</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Shibuya"
            placeholderTextColor={colors.muted}
            value={nearestStation}
            onChangeText={setNearestStation}
            maxLength={200}
          />

          {/* Price + organizer */}
          <Text style={labelStyle}>Price</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. ¥2,000 (free for students)"
            placeholderTextColor={colors.muted}
            value={price}
            onChangeText={setPrice}
            maxLength={200}
          />

          <Text style={labelStyle}>Organizer</Text>
          <TextInput
            style={inputStyle}
            placeholder="Who's running it?"
            placeholderTextColor={colors.muted}
            value={organizer}
            onChangeText={setOrganizer}
            maxLength={300}
          />

          {/* Link */}
          <Text style={labelStyle}>Link</Text>
          <TextInput
            style={inputStyle}
            placeholder="https://… (event page, tickets, social post)"
            placeholderTextColor={colors.muted}
            value={link}
            onChangeText={setLink}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={2048}
          />

          {/* Image */}
          <Text style={labelStyle}>Flyer / Photo</Text>
          {image ? (
            <View style={{ gap: 8 }}>
              <Image
                source={{ uri: image.uri }}
                style={{ width: "100%", height: 180, borderRadius: 12, backgroundColor: colors.surface }}
                contentFit="cover"
              />
              <Pressable
                onPress={() => setImage(null)}
                style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", opacity: pressed ? 0.6 : 1, padding: 4 }]}
              >
                <IconSymbol name="trash" size={15} color={colors.error} />
                <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>Remove image</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={pickImage}
              style={({ pressed }) => [{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                borderStyle: "dashed",
                backgroundColor: colors.background,
                opacity: pressed ? 0.7 : 1,
              }]}
            >
              <IconSymbol name="photo" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>Add a flyer (optional)</Text>
            </Pressable>
          )}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={checking || submitMutation.isPending}
            style={({ pressed }) => [{
              marginTop: 24,
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 14,
              alignItems: "center",
              opacity: pressed || checking || submitMutation.isPending ? 0.7 : 1,
            }]}
          >
            {checking || submitMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>Submit Event</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
