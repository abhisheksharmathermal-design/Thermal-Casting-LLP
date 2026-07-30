import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { resolveUrl } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar } from "@/src/admin-ui";

export default function AdminProducts() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.products({ search: q || undefined })) as any[]); } catch (e) { console.log(e); }
    setLoading(false);
  }, [q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (id: string, field: string) => {
    try { await api.adminToggleProduct(id, field); await load(); } catch (e) { console.log(e); }
  };
  const duplicate = async (id: string) => {
    try { await api.adminDuplicateProduct(id); await load(); } catch (e) { console.log(e); }
  };
  const del = async (id: string) => {
    try { await api.adminDeleteProduct(id); await load(); } catch (e) { console.log(e); }
  };

  return (
    <View style={s.screen}>
      <AdminTopBar title="PRODUCTS" right={
        <Pressable onPress={() => router.push("/admin/product-edit/new")} style={s.addBtn} testID="add-product">
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      } />
      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} onSubmitEditing={load} placeholder="Search products…" placeholderTextColor={colors.muted} style={s.searchInput} testID="search-products" />
        {q.length > 0 && <Pressable onPress={() => { setQ(""); setTimeout(load, 0); }}><Ionicons name="close" size={18} color={colors.muted} /></Pressable>}
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 60 }}
          renderItem={({ item }) => (
            <View style={[s.row, !item.enabled && s.rowDisabled]}>
              <Pressable onPress={() => router.push(`/admin/product-edit/${item.id}`)} style={{ flexDirection: "row", flex: 1, gap: spacing.sm }} testID={`edit-${item.ref_no}`}>
                {item.image_url ? <Image source={{ uri: resolveUrl(item.image_url) }} style={s.thumb} contentFit="cover" /> : <View style={s.thumb}><Ionicons name="cube-outline" size={22} color={colors.muted} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={s.ref}>{item.ref_no}</Text>
                  <Text numberOfLines={2} style={s.name}>{item.name}</Text>
                  <Text style={s.cat}>{item.category}{item.featured ? "  ·  ★ FEATURED" : ""}{!item.enabled ? "  ·  DISABLED" : ""}</Text>
                </View>
              </Pressable>
              <View style={{ gap: 4 }}>
                <Pressable onPress={() => toggle(item.id, "featured")} style={s.iconBtn}><Ionicons name={item.featured ? "star" : "star-outline"} size={18} color={item.featured ? colors.brandAccent : colors.muted} /></Pressable>
                <Pressable onPress={() => toggle(item.id, "enabled")} style={s.iconBtn}><Ionicons name={item.enabled ? "eye-outline" : "eye-off-outline"} size={18} color={colors.onSurface3} /></Pressable>
                <Pressable onPress={() => duplicate(item.id)} style={s.iconBtn}><Ionicons name="copy-outline" size={18} color={colors.onSurface3} /></Pressable>
                <Pressable onPress={() => del(item.id)} style={s.iconBtn}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={s.empty}>NO PRODUCTS</Text>}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  addBtn: { width: 40, height: 40, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface2, paddingHorizontal: spacing.md, height: 48, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  searchInput: { flex: 1, fontSize: fs.base, color: colors.onSurface },
  row: { flexDirection: "row", padding: spacing.sm, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong, gap: spacing.sm, alignItems: "center" },
  rowDisabled: { opacity: 0.5 },
  thumb: { width: 60, height: 60, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  ref: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "800", color: colors.brand },
  name: { fontSize: fs.sm, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  cat: { fontSize: fs.xs, color: colors.muted, marginTop: 2, letterSpacing: 0.5 },
  iconBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  empty: { textAlign: "center", padding: spacing.xl, color: colors.muted, letterSpacing: 1.2, fontWeight: "700" },
});
