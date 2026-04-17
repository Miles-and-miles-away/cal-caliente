import { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
import {
  JAPAN_CITIES,
  DISTANCE_OPTIONS_KM,
  STORAGE_KEYS,
} from "@/shared/types";

interface UserPreferences {
  city: string;
  maxDistanceKm: number;
  nearestStation: string;
  danceStyles: string[];
  eventTypes: string[];
  notificationsEnabled: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  city: "Tokyo",
  maxDistanceKm: 10,
  nearestStation: "",
  danceStyles: ["salsa", "bachata", "both"],
  eventTypes: ["social", "workshop", "festival", "class", "performance"],
  notificationsEnabled: true,
};

const DANCE_STYLE_TOGGLES = [
  { label: "Salsa", value: "salsa" },
  { label: "Bachata", value: "bachata" },
  { label: "Both / Mixed", value: "both" },
  { label: "Other Latin", value: "other" },
];

const EVENT_TYPE_TOGGLES = [
  { label: "Social Dance", value: "social" },
  { label: "Workshop", value: "workshop" },
  { label: "Festival", value: "festival" },
  { label: "Class", value: "class" },
  { label: "Performance", value: "performance" },
];

export default function PreferencesScreen() {
  const colors = useColors();
  const router = useRouter();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

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

  const SectionHeader = ({ title }: { title: string }) => (
    <Text
      style={{
        color: colors.muted,
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginTop: 24,
        marginBottom: 8,
        paddingHorizontal: 4,
      }}
    >
      {title}
    </Text>
  );

  const SettingRow = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
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
          <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "800" }}>Preferences</Text>
          {saved && (
            <Text style={{ color: colors.success, fontSize: 12, marginTop: 4 }}>
              Settings saved automatically
            </Text>
          )}
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
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 12,
                      backgroundColor: prefs.city === city.value ? colors.primary : colors.background,
                      borderWidth: 1,
                      borderColor: prefs.city === city.value ? colors.primary : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: prefs.city === city.value ? "#FFFFFF" : colors.muted,
                    }}
                  >
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
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 12,
                      backgroundColor: prefs.maxDistanceKm === km ? colors.primary : colors.background,
                      borderWidth: 1,
                      borderColor: prefs.maxDistanceKm === km ? colors.primary : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: prefs.maxDistanceKm === km ? "#FFFFFF" : colors.muted,
                    }}
                  >
                    {km} km
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SettingRow>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 14,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
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

        {/* Dance Styles */}
        <SectionHeader title="Dance Styles" />
        {DANCE_STYLE_TOGGLES.map((item) => (
          <SettingRow key={item.value} label={item.label}>
            <Switch
              value={prefs.danceStyles.includes(item.value)}
              onValueChange={() => toggleArrayItem("danceStyles", item.value)}
              trackColor={{ false: colors.border, true: colors.primary + "80" }}
              thumbColor={prefs.danceStyles.includes(item.value) ? colors.primary : colors.muted}
            />
          </SettingRow>
        ))}

        {/* Event Types */}
        <SectionHeader title="Event Types" />
        {EVENT_TYPE_TOGGLES.map((item) => (
          <SettingRow key={item.value} label={item.label}>
            <Switch
              value={prefs.eventTypes.includes(item.value)}
              onValueChange={() => toggleArrayItem("eventTypes", item.value)}
              trackColor={{ false: colors.border, true: colors.primary + "80" }}
              thumbColor={prefs.eventTypes.includes(item.value) ? colors.primary : colors.muted}
            />
          </SettingRow>
        ))}

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <SettingRow label="New Event Alerts">
          <Switch
            value={prefs.notificationsEnabled}
            onValueChange={(v) => updatePref("notificationsEnabled", v)}
            trackColor={{ false: colors.border, true: colors.primary + "80" }}
            thumbColor={prefs.notificationsEnabled ? colors.primary : colors.muted}
          />
        </SettingRow>

        {/* Manage Sources */}
        <SectionHeader title="Event Sources" />
        <Pressable
          onPress={() => router.push("/sites" as any)}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <IconSymbol name="link" size={18} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500", flex: 1, marginLeft: 10 }}>
              Manage Event Sources
            </Text>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </View>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
