import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/lib/favorites-context";
import { startOAuthLogin } from "@/constants/oauth";
import {
  JAPAN_CITIES,
  DISTANCE_OPTIONS_KM,
  STORAGE_KEYS,
  DANCE_STYLE_LABELS,
  DANCE_STYLE_COLORS,
  DANCE_STYLES,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  DEFAULT_PREFERENCES,
} from "@/shared/constants";

interface UserPreferences {
  city: string;
  maxDistanceKm: number;
  nearestStation: string;
  danceStyles: string[];
  eventTypes: string[];
  notificationsEnabled: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  city: DEFAULT_PREFERENCES.city,
  maxDistanceKm: DEFAULT_PREFERENCES.maxDistanceKm,
  nearestStation: DEFAULT_PREFERENCES.nearestStation,
  danceStyles: [...DEFAULT_PREFERENCES.danceStyles],
  eventTypes: [...DEFAULT_PREFERENCES.eventTypes],
  notificationsEnabled: DEFAULT_PREFERENCES.notificationsEnabled,
};

export default function PreferencesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { count: favCount } = useFavorites();
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  const handleSignIn = async () => {
    try {
      // On web this redirects; on native it opens the system browser and the
      // OAuth callback deep-links back into app/oauth/callback.tsx.
      await startOAuthLogin();
    } catch (err) {
      console.warn("Sign-in failed to start:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (err) {
      console.warn("Sign-out failed:", err);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPrefs({ ...DEFAULT_PREFS, ...parsed });
      }
    } catch (err) {
      console.warn("Failed to load preferences:", err);
    }
  };

  const savePreferences = async (updated: UserPreferences) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updated));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.warn("Failed to save preferences:", err);
    }
  };

  const updatePref = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    savePreferences(updated);
  };

  const toggleArrayItem = (key: "danceStyles" | "eventTypes", value: string) => {
    const current = prefs[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updatePref(key, updated);
  };

  const selectAllDanceStyles = () => {
    updatePref("danceStyles", DANCE_STYLES.filter((s) => s !== "other").map(String));
  };

  const clearAllDanceStyles = () => {
    updatePref("danceStyles", []);
  };

  const SectionHeader = ({ title, rightAction }: { title: string; rightAction?: React.ReactNode }) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 8, paddingHorizontal: 4 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {title}
      </Text>
      {rightAction}
    </View>
  );

  const SettingRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500", flex: 1 }}>
        {label}
      </Text>
      {children}
    </View>
  );

  return (
    <ScreenContainer className="px-4">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ paddingTop: 8, paddingBottom: 12 }}>
          <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "800" }}>Settings</Text>
          {saved && (
            <Text style={{ color: colors.success, fontSize: 12, marginTop: 4 }}>
              Settings saved automatically
            </Text>
          )}
        </View>

        {/* Account */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
          {authLoading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ color: colors.muted, fontSize: 14 }}>Checking sign-in…</Text>
            </View>
          ) : isAuthenticated ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <IconSymbol name="person.fill" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>
                    {user?.name || user?.email || "Signed in"}
                  </Text>
                  {user?.email ? (
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{user.email}</Text>
                  ) : null}
                </View>
              </View>
              <Pressable
                onPress={handleSignOut}
                accessibilityRole="button"
                style={({ pressed }) => [{
                  alignItems: "center",
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  opacity: pressed ? 0.7 : 1,
                }]}
              >
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>Sign Out</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <IconSymbol name="person.fill" size={20} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>Not signed in</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    Sign in to add and manage event sources
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleSignIn}
                accessibilityRole="button"
                style={({ pressed }) => [{
                  alignItems: "center",
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                }]}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>Sign In</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* My Calendar stats */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <IconSymbol name="bookmark.fill" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>My Calendar</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                {favCount} saved event{favCount !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Location */}
        <SectionHeader title="Location" />

        <SettingRow label="City">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 200 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {JAPAN_CITIES.filter((c) => c.value !== "").map((city) => (
                <Pressable
                  key={city.value}
                  onPress={() => updatePref("city", city.value)}
                  style={({ pressed }) => [{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: prefs.city === city.value ? colors.primary : colors.background,
                    borderWidth: 1,
                    borderColor: prefs.city === city.value ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: prefs.city === city.value ? "#FFFFFF" : colors.muted }}>
                    {city.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SettingRow>

        <SettingRow label="Max Distance">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 200 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {DISTANCE_OPTIONS_KM.map((km: number) => (
                <Pressable
                  key={km}
                  onPress={() => updatePref("maxDistanceKm", km)}
                  style={({ pressed }) => [{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    backgroundColor: prefs.maxDistanceKm === km ? colors.primary : colors.background,
                    borderWidth: 1,
                    borderColor: prefs.maxDistanceKm === km ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: prefs.maxDistanceKm === km ? "#FFFFFF" : colors.muted }}>
                    {km} km
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SettingRow>

        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500", marginBottom: 8 }}>
            Nearest Station
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.background,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              fontSize: 14,
              color: colors.foreground,
            }}
            placeholder="e.g. Shibuya, Shinjuku, Roppongi"
            placeholderTextColor={colors.muted}
            value={prefs.nearestStation}
            onChangeText={(text) => updatePref("nearestStation", text)}
            returnKeyType="done"
          />
        </View>

        {/* Dance Styles — all 14+ */}
        <SectionHeader
          title={`Dance Styles (${prefs.danceStyles.length})`}
          rightAction={
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable onPress={selectAllDanceStyles} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>All</Text>
              </Pressable>
              <Pressable onPress={clearAllDanceStyles} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>None</Text>
              </Pressable>
            </View>
          }
        />
        {DANCE_STYLES.filter((s) => s !== "other").map((style) => {
          const active = prefs.danceStyles.includes(style);
          const dotColor = DANCE_STYLE_COLORS[style] ?? colors.muted;
          return (
            <SettingRow key={style} label={DANCE_STYLE_LABELS[style] ?? style}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor }} />
                <Switch
                  value={active}
                  onValueChange={() => toggleArrayItem("danceStyles", style)}
                  trackColor={{ false: colors.border, true: dotColor + "80" }}
                  thumbColor={active ? dotColor : colors.muted}
                />
              </View>
            </SettingRow>
          );
        })}

        {/* Event Types */}
        <SectionHeader title="Event Types" />
        {EVENT_TYPES.filter((t) => t !== "other").map((type) => (
          <SettingRow key={type} label={EVENT_TYPE_LABELS[type] ?? type}>
            <Switch
              value={prefs.eventTypes.includes(type)}
              onValueChange={() => toggleArrayItem("eventTypes", type)}
              trackColor={{ false: colors.border, true: colors.primary + "80" }}
              thumbColor={prefs.eventTypes.includes(type) ? colors.primary : colors.muted}
            />
          </SettingRow>
        ))}

        {/* Notifications — push isn't wired yet (no token registration / send
            path), so this is a placeholder rather than a toggle that does
            nothing. Restore the Switch + POST_NOTIFICATIONS permission together. */}
        <SectionHeader title="Notifications" />
        <SettingRow label="New Event Alerts">
          <View style={{ backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>Coming soon</Text>
          </View>
        </SettingRow>

        {/* Manage Sources */}
        <SectionHeader title="Event Sources" />
        <Pressable
          onPress={() => router.push("/sites" as any)}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <IconSymbol name="link" size={18} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500", flex: 1, marginLeft: 10 }}>
              Manage Event Sources
            </Text>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </View>
        </Pressable>

        {/* Submit an event */}
        <View style={{ height: 8 }} />
        <Pressable
          onPress={() => router.push("/submit" as any)}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <IconSymbol name="plus" size={18} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500", flex: 1, marginLeft: 10 }}>
              Submit an Event
            </Text>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </View>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
