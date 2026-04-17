import { Pressable, ScrollView, Text } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterChipsProps {
  options: readonly FilterOption[];
  selected: string;
  onSelect: (value: string) => void;
}

export function FilterChips({ options, selected, onSelect }: FilterChipsProps) {
  const colors = useColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
    >
      {options.map((option) => {
        const isActive = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              {
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 18,
                backgroundColor: isActive ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: isActive ? colors.primary : colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: isActive ? "#FFFFFF" : colors.muted,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
