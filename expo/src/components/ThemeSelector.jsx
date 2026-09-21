import { View, Text, Pressable, StyleSheet } from "react-native";

import { useTheme } from "../context/ThemeContext";

export default function ThemeSelector({ theme, setTheme }) {
  const { colors } = useTheme();

  return (
    <View>
      <Text
        style={[
          styles.title,
          {
            color: colors.text,
          },
        ]}
      >
        Appearance
      </Text>

      <Text
        style={[
          styles.subtitle,
          {
            color: colors.muted,
          },
        ]}
      >
        Choose your preferred theme.
      </Text>

      <View style={styles.row}>
        <ThemeOption
          title="Light"
          subtitle="Clean & bright"
          active={theme === "light"}
          onPress={() => setTheme("light")}
          colors={colors}
        />

        <ThemeOption
          title="Dark"
          subtitle="Deep & focused"
          active={theme === "dark"}
          onPress={() => setTheme("dark")}
          colors={colors}
        />
      </View>
    </View>
  );
}

function ThemeOption({ title, subtitle, active, onPress, colors }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.option,
        {
          backgroundColor: active ? colors.accent : colors.elevated,
          borderColor: active ? colors.accent : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.optionTitle,
          {
            color: active ? colors.accentText : colors.text,
          },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.optionSubtitle,
          {
            color: active ? colors.accentText : colors.muted,
          },
        ]}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: "700",
  },

  subtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  option: {
    flex: 1,
    minHeight: 78,
    borderWidth: 1,
    borderRadius: 15,
    padding: 14,
    justifyContent: "center",
  },

  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },

  optionSubtitle: {
    fontSize: 11,
    marginTop: 5,
  },
});
