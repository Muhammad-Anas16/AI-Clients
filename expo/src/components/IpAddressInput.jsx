import { useRef } from "react";

import { View, Text, TextInput, StyleSheet } from "react-native";

import { useTheme } from "../context/ThemeContext";

export default function IpAddressInput({ values, setValues }) {
  const refs = useRef([]);

  const { colors } = useTheme();

  const handleChange = (text, index) => {
    const clean = text.replace(/[^0-9]/g, "").slice(0, 3);

    const updated = [...values];

    updated[index] = clean;

    setValues(updated);

    if (clean.length === 3 && index < 3) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (event, index) => {
    if (
      event.nativeEvent.key === "Backspace" &&
      values[index] === "" &&
      index > 0
    ) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {values.map((value, index) => (
        <View key={index} style={styles.part}>
          <TextInput
            ref={(ref) => {
              refs.current[index] = ref;
            }}
            value={value}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={(event) => handleKeyPress(event, index)}
            keyboardType="number-pad"
            maxLength={3}
            style={[
              styles.box,
              {
                color: colors.text,
                backgroundColor: colors.input,
                borderColor: colors.border,
              },
            ]}
            textAlign="center"
            selectTextOnFocus
            autoCorrect={false}
            autoCapitalize="none"
          />

          {index < 3 ? (
            <Text
              style={[
                styles.dot,
                {
                  color: colors.muted,
                },
              ]}
            >
              .
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  part: {
    flexDirection: "row",
    alignItems: "center",
  },

  box: {
    width: 58,
    height: 52,
    borderWidth: 1,
    borderRadius: 13,
    fontSize: 18,
    fontWeight: "700",
  },

  dot: {
    fontSize: 22,
    fontWeight: "700",
    marginHorizontal: 4,
  },
});
