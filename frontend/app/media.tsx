import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, FlatList } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { resolveUrl } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";

const TYPES = ["All", "image", "video", "brochure", "certificate", "datasheet", "pdf"];

export default function Media() {
  const router = useRouter();
  const [type, setType] = useState("All");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.media({ media_type: type })) as any[]); } catch (e) { console.log(e); }
    setLoading(false);
  }, [type]);
  useEffect(() => { load(); }, [load]);
  // Always show the latest admin-saved data when the page regains focus.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <Text style={s.topTitle}>MEDIA LIBRARY</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={s.chipRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" }}>
          {TYPES.map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={[s.chip, type === t && s.chipOn]} testID={`media-type-${t}`}>
              <Text style={[s.chipTxt, type === t && s.chipTxtOn]}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={type === "image" ? 3 : type === "video" ? 2 : 1}
          key={type}
          contentContainerStyle={{ padding: 2, paddingBottom: 40 }}
          columnWrapperStyle={type !== "All" && type !== "brochure" && type !== "certificate" && type !== "datasheet" && type !== "pdf" ? { gap: 2 } : undefined}
          renderItem={({ item }) => {
            if (item.media_type === "image") {
              return (
                <View style={s.imgTile}>
                  <Image source={{ uri: resolveUrl(item.url) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                </View>
              );
            }
            if (item.media_type === "video") {
              const thumb = resolveUrl(item.thumbnail_url);
              return (
                <Pressable onPress={() => router.push(`/video/${item.id}`)} style={s.videoTile} testID={`m-video-${item.id}`}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={{ width: "100%", height: "100%", position: "absolute" }} contentFit="cover" />
                  ) : (
                    <View style={{ ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="videocam-outline" size={36} color="rgba(255,255,255,0.35)" />
                    </View>
                  )}
                  <View style={s.playIcon}><Ionicons name="play" size={22} color="#fff" /></View>
                  <View style={s.videoLabel}><Text numberOfLines={2} style={s.videoTxt}>{item.title}</Text></View>
                </Pressable>
              );
            }
            return (
              <Pressable onPress={() => { const u = resolveUrl(item.url); if (u) Linking.openURL(u); }} style={s.docRow} testID={`m-doc-${item.id}`}>
                <View style={s.docIcon}><Ionicons name={item.media_type === "certificate" ? "ribbon" : "document"} size={20} color={colors.brand} /></View>
                <View style={{ flex: 1, marginHorizontal: spacing.md }}>
                  <Text numberOfLines={2} style={s.docTitle}>{item.title}</Text>
                  <Text style={s.docSub}>{item.media_type.toUpperCase()} · {item.category}</Text>
                </View>
                <Ionicons name="download-outline" size={20} color={colors.onSurface3} />
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.4, color: colors.brand },
  chipRow: { height: 56, borderBottomWidth: 1, borderBottomColor: colors.borderStrong, backgroundColor: colors.surface2, justifyContent: "center" },
  chip: { height: 36, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2, flexShrink: 0 },
  chipOn: { backgroundColor: colors.onSurface, borderColor: colors.brand },
  chipTxt: { fontSize: fs.xs, fontWeight: "700", letterSpacing: 1.1, color: colors.onSurface3 },
  chipTxtOn: { color: colors.brand },
  imgTile: { flex: 1, aspectRatio: 1, backgroundColor: colors.surface3, margin: 1 },
  videoTile: { flex: 1, aspectRatio: 16 / 10, backgroundColor: "#000", margin: 1, position: "relative" },
  playIcon: { position: "absolute", top: "40%", left: "45%", width: 40, height: 40, backgroundColor: "rgba(230,92,0,0.9)", alignItems: "center", justifyContent: "center" },
  videoLabel: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.sm, backgroundColor: "rgba(0,0,0,0.7)" },
  videoTxt: { color: "#fff", fontSize: fs.xs, fontWeight: "700", letterSpacing: 0.5 },
  docRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong, marginHorizontal: spacing.lg, marginTop: spacing.sm },
  docIcon: { width: 40, height: 40, borderWidth: 1, borderColor: colors.brand, alignItems: "center", justifyContent: "center" },
  docTitle: { fontSize: fs.base, fontWeight: "700", color: colors.onSurface },
  docSub: { fontSize: fs.xs, color: colors.muted, letterSpacing: 0.8, marginTop: 2 },
});
