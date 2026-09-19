import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

const themes = ["light", "dark", "system"];

export default function ThemeSelector({ theme, setTheme }) {
  return (
    <View>
      <Text style={styles.label}>Theme</Text>

      <View style={styles.row}>
        {themes.map((item) => {
          const active = theme === item;

          return (
            <Pressable
              key={item}
              onPress={() => setTheme(item)}
              style={[styles.option, active && styles.activeOption]}
            >
              <Text style={[styles.optionText, active && styles.activeText]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    gap: 8,
  },

  option: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
  },

  activeOption: {
    backgroundColor: "#111",
    borderColor: "#111",
  },

  optionText: {
    color: "#555",
    fontSize: 14,
    fontWeight: "500",
  },

  activeText: {
    color: "#fff",
  },
});
