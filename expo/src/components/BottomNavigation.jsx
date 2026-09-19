import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

import { usePathname, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BottomNavigation() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const goTo = (route) => {
    if (pathname !== route) {
      router.replace(route);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      <Pressable
        style={[styles.item, pathname === "/" && styles.activeItem]}
        onPress={() => goTo("/")}
      >
        <Text style={[styles.text, pathname === "/" && styles.activeText]}>
          Home
        </Text>
      </Pressable>

      <Pressable
        style={[styles.item, pathname === "/audio" && styles.activeItem]}
        onPress={() => goTo("/audio")}
      >
        <Text style={[styles.text, pathname === "/audio" && styles.activeText]}>
          Audio
        </Text>
      </Pressable>

      <Pressable
        style={[styles.item, pathname === "/settings" && styles.activeItem]}
        onPress={() => goTo("/settings")}
      >
        <Text
          style={[styles.text, pathname === "/settings" && styles.activeText]}
        >
          Settings
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 10,
    paddingHorizontal: 10,
  },

  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
  },

  activeItem: {
    backgroundColor: "#111",
  },

  text: {
    fontSize: 15,
    color: "#555",
  },

  activeText: {
    color: "#fff",
    fontWeight: "600",
  },
});
