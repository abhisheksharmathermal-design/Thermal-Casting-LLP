import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminEmpty } from "@/src/admin-ui";
import { StatusPill } from "@/app/(tabs)/portal";

const STATUS_FILTERS = ["all", "submitted", "under_review", "engineering_review", "quoted", "closed"];

export default function AdminRFQs() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.allRFQs()) as any[]); } catch (e) { console.log(e); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title="RFQ MANAGEMENT" />
      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md, alignItems: "center" }}>
          {STATUS_FILTERS.map((st) => (
            <Pressable key={st} onPress={() => setFilter(st)} style={[s.chip, filter === st && s.chipOn]} testID={`filter-${st}`}>
              <Text style={[s.chipTxt, filter === st && s.chipTxtOn]}>{st.replace(/_/g, " ").toUpperCase()}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          {filtered.length === 0 ? <AdminEmpty title="NO RFQs" icon="document-text-outline" /> : filtered.map((r) => (
            <Pressable key={r.id} style={s.row} onPress={() => router.push(`/rfq-detail/${r.id}`)} testID={`admin-rfq-${r.ref_no}`}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={s.ref}>{r.ref_no}</Text>
                  <StatusPill status={r.status} />
                </View>
                <Text style={s.company}>{r.company_name}</Text>
                <Text style={s.contact}>{r.contact_person}  ·  {r.email}</Text>
                <Text style={s.meta}>
                  {r.items.length} ITEM(S)  ·  {new Date(r.created_at).toLocaleDateString()}
                  {r.priority ? "  ·  PRIORITY " + r.priority.toUpperCase() : ""}
                  {r.assigned_to ? "  ·  ASSIGNED" : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.onSurface3} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  filterBar: { height: 52, borderBottomWidth: 1, borderBottomColor: colors.borderStrong, backgroundColor: colors.surface2, justifyContent: "center" },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexShrink: 0 },
  chipOn: { borderColor: colors.brand, backgroundColor: colors.onSurface },
  chipTxt: { fontSize: fs.xs, fontWeight: "800", letterSpacing: 1, color: colors.onSurface3 },
  chipTxtOn: { color: colors.brand },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, marginBottom: spacing.sm },
  ref: { fontSize: fs.sm, fontWeight: "900", color: colors.brand, letterSpacing: 1 },
  company: { fontSize: fs.base, fontWeight: "700", color: colors.onSurface },
  contact: { fontSize: fs.xs, color: colors.onSurface3, marginTop: 2 },
  meta: { fontSize: fs.xs, color: colors.muted, marginTop: 4, letterSpacing: 0.5 },
});
