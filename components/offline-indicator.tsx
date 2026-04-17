import React from "react";
import { View, Text, Animated } from "react-native";
import { useNetwork } from "@/lib/network-context";

export function OfflineIndicator() {
  const { isOnline } = useNetwork();

  if (isOnline) {
    return null;
  }

  return (
    <View className="bg-warning px-4 py-2 items-center">
      <Text className="text-sm font-semibold text-background">
        📡 You're offline — some features are limited
      </Text>
    </View>
  );
}
