import { StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function RecipesScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">食譜建議</ThemedText>
      <ThemedText style={styles.text}>即將推出</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    lineHeight: 22,
  },
});
