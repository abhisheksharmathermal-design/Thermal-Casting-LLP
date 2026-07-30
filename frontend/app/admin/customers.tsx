import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminEmpty } from "@/src/admin-ui";

export default function AdminCustomers() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.adminCustomers(q || undefined)) as any[]); } catch {}
    setLoading(false);
  }, [q]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleStatus = async (c: any) => {
    const next = c.status === "disabled" ? "active" : "disabled";
    try { await api.adminUpdateCustomer(c.id, { status: next }); await load(); } catch (e) { console.log(e); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title="CUSTOMERS" />
      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} onSubmitEditing={load} placeholder="Search email, name, company…" placeholderTextColor={colors.muted} style={s.searchInput} testID="search-customers" />
        {q.length > 0 && <Pressable onPress={() => { setQ(""); setTimeout(load, 0); }}><Ionicons name="close" size={18} color={colors.muted} /></Pressable>}
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          {items.length === 0 ? <AdminEmpty title="NO CUSTOMERS" icon="people-outline" /> : items.map((c) => (
            <View key={c.id} style={[s.row, c.status === "disabled" && { opacity: 0.5 }]}>
              <View style={s.avatar}><Text style={s.avatarTxt}>{(c.full_name || c.email || "?").charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{c.full_name}</Text>
                <Text style={s.sub}>{c.email}</Text>
                {c.company && <Text style={s.sub}>{c.company}</Text>}
                <Text style={s.meta}>{c.rfq_count} RFQ(S){c.status === "disabled" ? "  ·  DISABLED" : ""}</Text>
              </View>
              <Pressable onPress={() => toggleStatus(c)} style={s.iconBtn}><Ionicons name={c.status === "disabled" ? "lock-closed" : "lock-open-outline"} size={18} color={c.status === "disabled" ? colors.error : colors.onSurface3} /></Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface2, paddingHorizontal: spacing.md, height: 48, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  searchInput: { flex: 1, fontSize: fs.base, color: colors.onSurface },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, marginBottom: spacing.sm },
  avatar: { width: 44, height: 44, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "900", fontSize: fs.lg },
  name: { fontSize: fs.base, fontWeight: "800", color: colors.onSurface },
  sub: { fontSize: fs.xs, color: colors.onSurface3, marginTop: 2 },
  meta: { fontSize: fs.xs, color: colors.brand, marginTop: 4, letterSpacing: 1, fontWeight: "700" },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
});
