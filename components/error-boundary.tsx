import React, { ReactNode, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { cn } from "@/lib/utils";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }

      return (
        <View className="flex-1 bg-background p-4 justify-center items-center">
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
            <View className="items-center gap-4">
              <Text className="text-2xl font-bold text-error">Oops!</Text>
              <Text className="text-base text-foreground text-center">
                Something went wrong
              </Text>
              <Text className="text-sm text-muted text-center font-mono">
                {this.state.error.message}
              </Text>
              <Pressable
                onPress={this.retry}
                className={cn(
                  "bg-primary px-6 py-3 rounded-full",
                  "active:opacity-80"
                )}
              >
                <Text className="text-background font-semibold">Try Again</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}
