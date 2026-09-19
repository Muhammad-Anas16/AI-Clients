import React, { useRef } from "react";

import { View, Text, TextInput, StyleSheet } from "react-native";

export default function IpAddressInput({ values, setValues }) {
  const refs = useRef([]);

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
            style={styles.box}
            textAlign="center"
            selectTextOnFocus
            autoCorrect={false}
          />

          {index < 3 && <Text style={styles.dot}>.</Text>}
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
    width: 62,
    height: 54,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    fontSize: 20,
    fontWeight: "600",
    backgroundColor: "#f9fafb",
    color: "#111",
    textAlign: "center",
  },

  dot: {
    fontSize: 24,
    fontWeight: "700",
    marginHorizontal: 5,
    color: "#111",
  },
});
