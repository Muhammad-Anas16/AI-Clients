import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Button, Alert } from "react-native";
import { saveServerIP, getServerIP, deleteServerIP } from "../utils/ipStorage";

const SettingsScreen = () => {
  const [ip, setIp] = useState("");

  useEffect(() => {
    loadIP();
  }, []);

  const loadIP = async () => {
    const savedIP = await getServerIP();

    if (savedIP) {
      setIp(savedIP);
    }
  };

  const handleSave = async () => {
    if (!ip.trim()) {
      Alert.alert("Error", "IP enter karo");
      return;
    }

    const saved = await saveServerIP(ip.trim());

    if (saved) {
      Alert.alert("Success", "IP save ho gayi");
    }
  };

  const handleDelete = async () => {
    await deleteServerIP();
    setIp("");
    Alert.alert("Success", "IP delete ho gayi");
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Server IP</Text>

      <TextInput
        value={ip}
        onChangeText={setIp}
        placeholder="192.168.1.100"
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          padding: 12,
          marginVertical: 10,
          borderRadius: 8,
        }}
      />

      <Button title="Save IP" onPress={handleSave} />

      <View style={{ marginTop: 10 }}>
        <Button title="Delete IP" onPress={handleDelete} />
      </View>
    </View>
  );
};

export default SettingsScreen;
