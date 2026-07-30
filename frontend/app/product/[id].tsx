import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { api } from "@/src/api";
import { resolveUrl } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try { setP(await api.product(id)); } catch (e) { console.log(e); } setLoading(false);
  })(); }, [id]);

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.brand} /></View>;
  if (!p) return <View style={s.center}><Text>Not found</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <Text style={s.topTitle}>{p.ref_no}</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
        <View style={s.imgWrap}>
          {p.image_url ? (
            <Image source={{ uri: resolveUrl(p.image_url) }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={s.imgFallback}><Ionicons name="cube-outline" size={80} color={colors.muted} /></View>
          )}
        </View>

        <View style={s.body}>
          <Text style={s.cat}>{p.category}</Text>
          <Text style={s.name}>{p.name}</Text>
          {p.description && <Text style={s.desc}>{p.description}</Text>}
        </View>

        {p.specs && Object.keys(p.specs).length > 0 && (
          <Section title="SPECIFICATIONS">
            <View style={s.specTable}>
              {Object.entries(p.specs).map(([k, v]) => (
                <View key={k} style={s.specRow}>
                  <Text style={s.specKey}>{k.replace(/_/g, " ").toUpperCase()}</Text>
                  <Text style={s.specVal}>{String(v)}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {(() => {
          // Only these buyer-facing fields appear under TECHNICAL DATA
          const rows: { label: string; value?: string | null }[] = [
            { label: "MATERIAL / GRADE", value: p.materials || p.grade },
            { label: "SIZE RANGE", value: p.size },
            { label: "WEIGHT RANGE", value: p.weight },
            { label: "PRESSURE CLASS", value: p.pressure_class },
            { label: "STANDARDS", value: p.standards },
            { label: "CASTING PROCESS", value: p.casting_process },
            { label: "MACHINING AVAILABILITY", value: p.machining_details },
            { label: "INSPECTION / TESTING AVAILABILITY", value: p.inspection_details },
          ].filter((r) => typeof r.value === "string" && r.value.trim().length > 0);

          if (rows.length === 0) return null;
          return (
            <Section title="TECHNICAL DATA">
              <View style={s.techBox}>
                {rows.map((r, i) => (
                  <TechRow key={r.label} label={r.label} value={r.value as string} last={i === rows.length - 1} />
                ))}
              </View>
            </Section>
          );
        })()}

        {p.media && p.media.length > 0 && (
          <Section title="ASSOCIATED MEDIA">
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              {p.media.map((m: any) => (
                <Pressable key={m.id} style={s.docRow} onPress={() => { const u = resolveUrl(m.url); if (u) Linking.openURL(u); }}>
                  <Ionicons name="document-outline" size={20} color={colors.brand} />
                  <Text style={{ flex: 1, fontWeight: "700" }}>{m.title}</Text>
                  <Ionicons name="download-outline" size={18} color={colors.onSurface3} />
                </Pressable>
              ))}
            </View>
          </Section>
        )}
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={s.ctaBar}>
        <Pressable onPress={() => router.push({ pathname: "/rfq", params: { product_id: p.id, product_name: p.name } })} style={s.cta} testID="btn-rfq-cta">
          <Ionicons name="document-text" size={20} color="#fff" />
          <Text style={s.ctaTxt}>ADD TO INQUIRY</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function Section({ title, children }: any) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <View style={s.secHead}>
        <View style={s.secBar} />
        <Text style={s.secTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}
function TechRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.techRow, last && { borderBottomWidth: 0 }]}>
      <Text style={s.techLbl}>{label}</Text>
      <Text style={s.techVal}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.4, color: colors.brand },
  imgWrap: { width: "100%", aspectRatio: 4 / 3, backgroundColor: colors.surface3, borderBottomWidth: 1, borderBottomColor: colors.borderStrong, position: "relative" },
  imgFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: spacing.lg, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  cat: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "800", color: colors.brand, textTransform: "uppercase" },
  name: { fontSize: fs.xxl, fontWeight: "900", color: colors.onSurface, marginTop: 4, letterSpacing: -0.5 },
  desc: { marginTop: spacing.md, fontSize: fs.base, color: colors.onSurface2, lineHeight: 22 },

  secHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  secBar: { width: 4, height: 18, backgroundColor: colors.brand },
  secTitle: { fontSize: fs.base, fontWeight: "900", letterSpacing: 1.4, color: colors.onSurface },

  specTable: { marginHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2 },
  specRow: { flexDirection: "row", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  specKey: { flex: 1, fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "800", color: colors.onSurface3 },
  specVal: { flex: 1, fontSize: fs.base, fontWeight: "700", color: colors.onSurface, textAlign: "right" },

  techBox: { marginHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, paddingHorizontal: spacing.md },
  techRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  techLbl: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "800", color: colors.brand },
  techVal: { fontSize: fs.base, color: colors.onSurface, marginTop: 4, lineHeight: 20, flexShrink: 1, flexWrap: "wrap" },

  docRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2 },

  ctaBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.surface2, borderTopWidth: 1, borderTopColor: colors.borderStrong, padding: spacing.md },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, paddingVertical: spacing.lg },
  ctaTxt: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: fs.base },
});
