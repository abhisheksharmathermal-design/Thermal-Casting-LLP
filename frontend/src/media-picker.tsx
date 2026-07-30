import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput, FlatList, ActivityIndicator, Platform, KeyboardAvoidingView,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { api, resolveUrl } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";

type MediaKind = "image" | "video" | "brochure" | "certificate" | "pdf" | "datasheet" | "any";

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (item: MediaItem) => void;
  kind?: MediaKind;
  title?: string;
};

export type MediaItem = {
  id: string;
  title: string;
  media_type: string;
  url: string;
  thumbnail_url?: string | null;
  category?: string | null;
  featured?: boolean;
  tags?: string[];
};

const KIND_MATCH: Record<MediaKind, (m: MediaItem) => boolean> = {
  image: (m) => m.media_type === "image",
  video: (m) => m.media_type === "video",
  brochure: (m) => ["brochure", "pdf"].includes(m.media_type),
  certificate: (m) => ["certificate", "pdf", "image"].includes(m.media_type),
  pdf: (m) => ["pdf", "brochure", "certificate", "datasheet"].includes(m.media_type),
  datasheet: (m) => ["datasheet", "pdf"].includes(m.media_type),
  any: () => true,
};

export function MediaPicker({ visible, onClose, onPick, kind = "image", title = "PICK FROM MEDIA LIBRARY" }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = (await api.media()) as MediaItem[];
      setItems(all);
    } catch (e) {
      console.log("media load", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const filtered = items
    .filter(KIND_MATCH[kind])
    .filter((m) => !search
      || (m.title || "").toLowerCase().includes(search.toLowerCase())
      || (m.category || "").toLowerCase().includes(search.toLowerCase())
      || (m.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase())));

  const renderThumb = (m: MediaItem) => {
    if (m.media_type === "image") {
      return <Image source={{ uri: resolveUrl(m.thumbnail_url || m.url) }} style={s.thumb} contentFit="cover" />;
    }
    if (m.media_type === "video") {
      return (
        <View style={[s.thumb, s.thumbVideo]}>
          {m.thumbnail_url ? <Image source={{ uri: resolveUrl(m.thumbnail_url) }} style={StyleSheet.absoluteFill as any} contentFit="cover" /> : null}
          <View style={s.playBadge}><Ionicons name="play" size={16} color="#fff" /></View>
        </View>
      );
    }
    return (
      <View style={[s.thumb, s.thumbDoc]}>
        <Ionicons name="document-text-outline" size={26} color={colors.brand} />
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.wrap}>
        <View style={s.card}>
          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            <Pressable onPress={onClose} style={s.closeBtn} hitSlop={8} testID="mp-close">
              <Ionicons name="close" size={22} color={colors.onSurface} />
            </Pressable>
          </View>

          <View style={s.searchWrap}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search title, category, tags…"
              placeholderTextColor={colors.muted}
              style={s.searchInput}
              testID="mp-search"
            />
            {!!search && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.muted} />
              </Pressable>
            )}
          </View>

          {loading ? (
            <View style={s.empty}><ActivityIndicator color={colors.brand} /></View>
          ) : filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="images-outline" size={40} color={colors.muted} />
              <Text style={s.emptyTxt}>NO MEDIA FOUND</Text>
              <Text style={s.emptySub}>Upload files in the Media Library first.</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(m) => m.id}
              numColumns={3}
              columnWrapperStyle={{ gap: spacing.sm }}
              contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 40 }}
              renderItem={({ item }) => (
                <Pressable onPress={() => { onPick(item); onClose(); }} style={s.tile} testID={`mp-item-${item.id}`}>
                  <View style={s.tileThumbWrap}>{renderThumb(item)}</View>
                  <Text style={s.tileTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={s.tileMeta} numberOfLines={1}>{item.media_type.toUpperCase()}{item.category ? ` · ${item.category}` : ""}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  card: { backgroundColor: colors.surface, borderTopWidth: 2, borderTopColor: colors.brand, maxHeight: "88%", minHeight: "60%" },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderStrong, backgroundColor: colors.surface2 },
  title: { flex: 1, fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.4, color: colors.brand },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface2 },
  searchInput: { flex: 1, fontSize: fs.base, color: colors.onSurface, paddingVertical: 6 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, padding: spacing.xl, minHeight: 200 },
  emptyTxt: { fontSize: fs.xs, fontWeight: "900", letterSpacing: 1.4, color: colors.onSurface3 },
  emptySub: { fontSize: fs.xs, color: colors.muted, textAlign: "center" },
  tile: { flex: 1 / 3, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, padding: 6 },
  tileThumbWrap: { width: "100%", aspectRatio: 1, backgroundColor: colors.surface3, marginBottom: 4 },
  thumb: { width: "100%", height: "100%" },
  thumbVideo: { backgroundColor: colors.inverse, alignItems: "center", justifyContent: "center" },
  thumbDoc: { alignItems: "center", justifyContent: "center" },
  playBadge: { position: "absolute", width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  tileTitle: { fontSize: 11, fontWeight: "800", color: colors.onSurface, letterSpacing: 0.3 },
  tileMeta: { fontSize: 9, color: colors.muted, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 2 },
});
