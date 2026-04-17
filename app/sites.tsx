import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import {
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_ICONS,
  SOURCE_TYPE_OPTIONS,
  MAX_URL_LENGTH,
  MAX_SOURCE_NAME_LENGTH,
} from "@/shared/types";
import type { SourceType } from "@/shared/types";

export default function SitesScreen() {
  const colors = useColors();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: sources, isLoading } = trpc.sources.list.useQuery();
  const addMutation = trpc.sources.add.useMutation({
    onSuccess: () => {
      utils.sources.list.invalidate();
      setShowAdd(false);
      setNewName("");
      setNewUrl("");
      setNewType("html");
    },
  });
  const toggleMutation = trpc.sources.toggle.useMutation({
    onSuccess: () => utils.sources.list.invalidate(),
  });
  const deleteMutation = trpc.sources.delete.useMutation({
    onSuccess: () => utils.sources.list.invalidate(),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newType, setNewType] = useState<SourceType>("html");

  const handleAdd = () => {
    const trimmedName = newName.trim();
    const trimmedUrl = newUrl.trim();
    if (!trimmedName || !trimmedUrl) {
      Alert.alert("Missing Fields", "Please enter both a name and URL.");
      return;
    }
    if (trimmedName.length > MAX_SOURCE_NAME_LENGTH) {
      Alert.alert("Name Too Long", `Max ${MAX_SOURCE_NAME_LENGTH} characters.`);
      return;
    }
    if (trimmedUrl.length > MAX_URL_LENGTH) {
      Alert.alert("URL Too Long", `Max ${MAX_URL_LENGTH} characters.`);
      return;
    }
    try {
      const parsed = new URL(trimmedUrl);
      if (!["https:", "http:"].includes(parsed.protocol)) {
        Alert.alert("Invalid URL", "URL must start with https:// or http://");
        return;
      }
    } catch {
      Alert.alert("Invalid URL", "Please enter a valid URL.");
      return;
    }
    addMutation.mutate({ name: trimmedName, url: trimmedUrl, sourceType: newType });
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert("Delete Source", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate({ id }) },
    ]);
  };

  const sourcesList = (sources ?? []) as any[];

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <FlatList
        data={sourcesList}
        keyExtractor={(item: any) => item.id.toString()}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
              <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
                <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
              </Pressable>
              <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>Event Sources</Text>
              <Pressable onPress={() => setShowAdd(!showAdd)} style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}>
                <IconSymbol name={showAdd ? "xmark" : "plus"} size={22} color={colors.primary} />
              </Pressable>
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
                Add your dance school website, Facebook page, or Instagram account. The app will automatically check these sources for new events every hour.
              </Text>
            </View>

            {/* Add form */}
            {showAdd && (
              <View style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
                <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", marginBottom: 12 }}>Add New Source</Text>

                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 4 }}>Source Name</Text>
                <TextInput
                  style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10, fontSize: 14, color: colors.foreground, marginBottom: 10 }}
                  placeholder="e.g. Tokyo Salsa Club"
                  placeholderTextColor={colors.muted}
                  value={newName}
                  onChangeText={setNewName}
                  maxLength={MAX_SOURCE_NAME_LENGTH}
                  returnKeyType="next"
                />

                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 4 }}>URL</Text>
                <TextInput
                  style={{ backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10, fontSize: 14, color: colors.foreground, marginBottom: 10 }}
                  placeholder="https://..."
                  placeholderTextColor={colors.muted}
                  value={newUrl}
                  onChangeText={setNewUrl}
                  maxLength={MAX_URL_LENGTH}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                />

                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Source Type</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {SOURCE_TYPE_OPTIONS.map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setNewType(type)}
                      style={({ pressed }) => [{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 14,
                        backgroundColor: newType === type ? colors.primary : colors.background,
                        borderWidth: 1,
                        borderColor: newType === type ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                      }]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "600", color: newType === type ? "#FFFFFF" : colors.muted }}>
                        {SOURCE_TYPE_ICONS[type]} {SOURCE_TYPE_LABELS[type]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  onPress={handleAdd}
                  style={({ pressed }) => [{
                    backgroundColor: colors.primary,
                    borderRadius: 12,
                    padding: 12,
                    alignItems: "center",
                    opacity: pressed || addMutation.isPending ? 0.7 : 1,
                  }]}
                  disabled={addMutation.isPending}
                >
                  {addMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>Add Source</Text>
                  )}
                </Pressable>
              </View>
            )}

            {/* Section label */}
            <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {sourcesList.length} source{sourcesList.length !== 1 ? "s" : ""} registered
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }: { item: any }) => (
          <View style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>
                {SOURCE_TYPE_ICONS[item.sourceType as SourceType] ?? "🌐"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                  {item.url}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 10, backgroundColor: colors.background, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                    {SOURCE_TYPE_LABELS[item.sourceType as SourceType] ?? item.sourceType}
                  </Text>
                  {item.isUserAdded && (
                    <Text style={{ color: colors.primary, fontSize: 10 }}>User Added</Text>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Switch
                  value={item.isActive}
                  onValueChange={(v: boolean) => toggleMutation.mutate({ id: item.id, isActive: v })}
                  trackColor={{ false: colors.border, true: colors.primary + "80" }}
                  thumbColor={item.isActive ? colors.primary : colors.muted}
                />
                {item.isUserAdded && (
                  <Pressable
                    onPress={() => handleDelete(item.id, item.name)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}
                  >
                    <IconSymbol name="trash" size={16} color={colors.error} />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            {isLoading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🌐</Text>
                <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
                  No sources registered yet.{"\n"}Tap + to add one!
                </Text>
              </View>
            )}
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </ScreenContainer>
  );
}
