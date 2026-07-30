import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { resolveUrl } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";

export default function Catalogue() {
  const router = useRouter();
  const [cats, setCats] = useState<string[]>([]);
  const [active, setActive] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try {
      const cats: any = await api.categories();
      const names = cats.map((c: any) => c.name);
      setCats(["All", ...names]);
    } catch {}
  })(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r: any = await api.products({
        category: active === "All" ? undefined : active,
        search: search.trim() || undefined,
      });
      setItems(r);
    } catch (e) { console.log(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [active]);

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      {/* HEADER */}
      <View style={s.header}>
        <View>
          <Text style={s.mono}>ENTERPRISE B2B CATALOGUE</Text>
          <Text style={s.h1}>Products</Text>
        </View>
      </View>

      {/* SEARCH */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          placeholder="SEARCH PRODUCTS, SKU, MATERIALS…"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={load}
          style={s.searchInput}
          testID="catalogue-search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => { setSearch(""); setTimeout(load, 0); }}>
            <Ionicons name="close" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {/* CHIPS ROW - single line, horizontal only */}
      <View style={s.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" }}
        >
          <Pressable onPress={() => router.push("/materials")} style={[s.chip, { backgroundColor: colors.brandLight, borderColor: colors.brand }]} testID="chip-materials">
            <Ionicons name="flask-outline" size={14} color={colors.brand} />
            <Text style={[s.chipTxt, { color: colors.brand, marginLeft: 4 }]}>BY MATERIAL</Text>
          </Pressable>
          {cats.map((c) => {
            const on = c === active;
            return (
              <Pressable
                key={c}
                onPress={() => setActive(c)}
                style={[s.chip, on && s.chipOn]}
                testID={`chip-${c}`}
              >
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{c.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.brand} /></View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <Text style={s.empty}>NO PRODUCTS FOUND</Text>
          <Pressable onPress={() => { setSearch(""); setActive("All"); }} style={s.resetBtn}>
            <Text style={s.resetTxt}>RESET FILTERS</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}
          columnWrapperStyle={{ gap: spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/product/${item.id}`)}
              style={s.card}
              testID={`product-${item.ref_no}`}
            >
              <View style={s.cardImgWrap}>
                {item.image_url ? (
                  <Image source={{ uri: resolveUrl(item.image_url) }} style={s.cardImg} contentFit="cover" />
                ) : (
                  <View style={s.cardImgFallback}>
                    <Ionicons name="cube-outline" size={40} color={colors.muted} />
                  </View>
                )}
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardRef}>{item.ref_no}</Text>
                <Text numberOfLines={2} style={s.cardName}>{item.name}</Text>
                <Text numberOfLines={1} style={s.cardCat}>{item.category}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  mono: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "700", color: colors.brand },
  h1: { fontSize: fs.xxl, fontWeight: "900", color: colors.onSurface, marginTop: 4 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderStrong, paddingHorizontal: spacing.lg, backgroundColor: colors.surface2, height: 48 },
  searchInput: { flex: 1, fontSize: fs.base, color: colors.onSurface, letterSpacing: 0.5 },
  chipRow: { height: 56, borderBottomWidth: 1, borderBottomColor: colors.borderStrong, backgroundColor: colors.surface2, justifyContent: "center" },
  chip: { height: 36, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2, flexShrink: 0 },
  chipOn: { borderColor: colors.brand, backgroundColor: colors.onSurface },
  chipTxt: { fontSize: fs.xs, fontWeight: "700", letterSpacing: 1.1, color: colors.onSurface3 },
  chipTxtOn: { color: colors.brand },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.lg },
  empty: { fontSize: fs.base, fontWeight: "700", letterSpacing: 1, color: colors.muted },
  resetBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.onSurface, borderWidth: 1, borderColor: colors.borderStrong },
  resetTxt: { color: colors.brand, fontWeight: "800", letterSpacing: 1 },
  card: { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong },
  cardImgWrap: { width: "100%", aspectRatio: 1.15, backgroundColor: colors.surface3 },
  cardImg: { width: "100%", height: "100%" },
  cardImgFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardBody: { padding: spacing.md, gap: 4, borderTopWidth: 1, borderTopColor: colors.border },
  cardRef: { fontSize: fs.xs, color: colors.brand, fontWeight: "700", letterSpacing: 1.2 },
  cardName: { fontSize: fs.base, fontWeight: "700", color: colors.onSurface, minHeight: 40 },
  cardCat: { fontSize: fs.xs, color: colors.muted, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "600" },
});
