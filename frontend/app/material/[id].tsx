import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { api, resolveUrl } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";

export default function MaterialDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [m, setM] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try { setM(await api.material(id)); } catch {} setLoading(false);
  })(); }, [id]);

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.brand} /></View>;
  if (!m) return <View style={s.center}><Text>Material not found</Text></View>;

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <Text style={s.topTitle}>{m.name}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={s.hero}>
          <Text style={s.code}>{m.name}</Text>
          {m.grade_code ? <Text style={s.gradeCode}>{m.grade_code}</Text> : null}
          {m.category ? <Text style={s.cat}>{m.category.toUpperCase()}</Text> : null}
          {m.standards ? <Text style={s.std}>STANDARDS: {m.standards}</Text> : null}
        </View>
        {m.description ? (
          <View style={s.section}>
            <Text style={s.secTitle}>DESCRIPTION</Text>
            <Text style={s.body}>{m.description}</Text>
          </View>
        ) : null}
        {m.typical_use ? (
          <View style={s.section}>
            <Text style={s.secTitle}>TYPICAL USE</Text>
            <Text style={s.body}>{m.typical_use}</Text>
          </View>
        ) : null}
        <View style={s.section}>
          <Text style={s.secTitle}>PRODUCTS IN THIS GRADE ({(m.products || []).length})</Text>
          {(m.products || []).length === 0 ? (
            <Text style={s.empty}>NO PRODUCTS ASSOCIATED YET</Text>
          ) : (m.products || []).map((p: any) => (
            <Pressable key={p.id} style={s.prodRow} onPress={() => router.push(`/product/${p.id}`)}>
              {p.image_url ? <Image source={{ uri: resolveUrl(p.image_url) }} style={s.thumb} contentFit="cover" /> : <View style={s.thumb}><Ionicons name="cube-outline" size={22} color={colors.muted} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={s.prodRef}>{p.ref_no}</Text>
                <Text style={s.prodName}>{p.name}</Text>
                <Text style={s.prodCat}>{p.category}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.4, color: colors.brand },
  hero: { padding: spacing.xl, backgroundColor: colors.inverse, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  code: { fontSize: 36, fontWeight: "900", color: "#fff", letterSpacing: 2 },
  gradeCode: { fontSize: fs.base, color: "rgba(255,255,255,0.7)", marginTop: 4, letterSpacing: 1.4 },
  cat: { fontSize: fs.xs, color: "rgba(255,255,255,0.7)", marginTop: spacing.md, letterSpacing: 1.4 },
  std: { fontSize: fs.xs, color: "#C9A227", marginTop: 4, letterSpacing: 1.4, fontWeight: "700" },
  section: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong, marginHorizontal: spacing.md },
  secTitle: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "900", color: colors.brand, marginBottom: spacing.sm },
  body: { fontSize: fs.base, color: colors.onSurface, lineHeight: 22 },
  empty: { fontSize: fs.sm, color: colors.muted, letterSpacing: 1, fontStyle: "italic" },
  prodRow: { flexDirection: "row", alignItems: "center", padding: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.sm },
  thumb: { width: 56, height: 56, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  prodRef: { fontSize: fs.xs, color: colors.brand, fontWeight: "800", letterSpacing: 1.2 },
  prodName: { fontSize: fs.base, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  prodCat: { fontSize: fs.xs, color: colors.muted, marginTop: 2 },
});
