import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";

export default function MaterialsBrowse() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.materials()) as any[]); } catch {}
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Group by category
  const groups: Record<string, any[]> = {};
  for (const m of items) {
    const k = m.category || "Other";
    groups[k] = groups[k] || [];
    groups[k].push(m);
  }

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <Text style={s.topTitle}>MATERIALS & GRADES</Text>
        <View style={{ width: 44 }} />
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          <Text style={s.intro}>BROWSE PRODUCTS BY METALLURGICAL GRADE. TAP A MATERIAL TO SEE EVERY PRODUCT AVAILABLE IN THAT GRADE.</Text>
          {Object.entries(groups).map(([cat, arr]) => (
            <View key={cat} style={{ marginBottom: spacing.lg }}>
              <View style={s.groupHead}>
                <View style={s.groupBar} />
                <Text style={s.groupTitle}>{cat.toUpperCase()}</Text>
              </View>
              <View style={s.grid}>
                {arr.map((m) => (
                  <Pressable key={m.id} onPress={() => router.push(`/material/${m.id}`)} style={s.card} testID={`mat-${m.name}`}>
                    <Text style={s.code}>{m.name}</Text>
                    {m.standards ? <Text style={s.std}>{m.standards}</Text> : null}
                    {m.description ? <Text numberOfLines={2} style={s.desc}>{m.description}</Text> : null}
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.4, color: colors.brand },
  intro: { fontSize: fs.xs, letterSpacing: 1, color: colors.onSurface3, marginBottom: spacing.lg, lineHeight: 18 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  groupBar: { width: 4, height: 18, backgroundColor: colors.brand },
  groupTitle: { fontSize: fs.base, fontWeight: "900", letterSpacing: 1.4, color: colors.onSurface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  card: { width: "31%", padding: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, minHeight: 88 },
  code: { fontSize: fs.base, fontWeight: "900", color: colors.brand, letterSpacing: 1 },
  std: { fontSize: 10, color: colors.muted, marginTop: 2, letterSpacing: 0.5 },
  desc: { fontSize: fs.xs, color: colors.onSurface3, marginTop: 4, lineHeight: 14 },
});
