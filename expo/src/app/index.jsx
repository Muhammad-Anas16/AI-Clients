import React from "react";
import { View, Text, StyleSheet, Button } from "react-native";
import { router } from "expo-router";
import BottomNavigation from "../components/BottomNavigation";

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Hello World</Text>

        <Text style={styles.subtitle}>AI Client App</Text>

        <Button
          title="Go to Settings"
          onPress={() => router.push("/settings")}
        />
      </View>

      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
  },

  subtitle: {
    fontSize: 16,
    color: "#666",
  },
});
