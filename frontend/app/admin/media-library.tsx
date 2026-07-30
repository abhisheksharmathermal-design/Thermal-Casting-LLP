import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { api, uploadFile, resolveUrl } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminField, AdminButton, AdminSwitch, AdminEmpty } from "@/src/admin-ui";
import { MediaPicker } from "@/src/media-picker";

const TYPES: string[] = ["All", "image", "video", "brochure", "certificate", "pdf"];
const MAX_IMG_MB = 20;
const MAX_VIDEO_MB = 100;

export default function AdminMediaLibrary() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("All");
  const [search, setSearch] = useState("");

  // uploader state
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<{ uri: string; name: string; mime: string; sizeMB: number; type: "image" | "video" } | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Uploads");
  const [featured, setFeatured] = useState(false);

  // edit / replace state
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [replaceBusy, setReplaceBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.media()) as any[]); } catch (e) { console.log(e); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const askPerms = async () => {
    const lib = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!lib.granted && lib.canAskAgain) await ImagePicker.requestMediaLibraryPermissionsAsync();
  };

  const pickAsset = async (kind: "image" | "video") => {
    await askPerms();
    setErr(null);
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "image" ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.85,
      videoMaxDuration: 300,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    const sizeMB = (a.fileSize || 0) / (1024 * 1024);
    const limit = kind === "image" ? MAX_IMG_MB : MAX_VIDEO_MB;
    if (sizeMB && sizeMB > limit) {
      setErr(`File too large — max ${limit} MB (got ${sizeMB.toFixed(1)} MB)`);
      return;
    }
    const mime = a.mimeType || (kind === "image" ? "image/jpeg" : "video/mp4");
    setPending({ uri: a.uri, name: a.fileName || `${kind}-${Date.now()}.${mime.split("/")[1]}`, mime, sizeMB, type: kind });
    setTitle(a.fileName || "");
  };

  const upload = async () => {
    if (!pending) return;
    setBusy(true); setPct(0); setErr(null);
    try {
      await uploadFile(pending.uri, pending.name, pending.mime, pending.type, {
        saveToLibrary: true,
        title: title || pending.name,
        onProgress: setPct,
      });
      // If admin set featured on new upload, patch it after creation
      if (featured) {
        const list: any[] = await api.media();
        const newItem = list.find((m) => m.title === (title || pending.name));
        if (newItem) await api.adminUpdateMedia(newItem.id, { featured: true, category });
      } else if (category !== "Uploads") {
        const list: any[] = await api.media();
        const newItem = list.find((m) => m.title === (title || pending.name));
        if (newItem) await api.adminUpdateMedia(newItem.id, { category });
      }
      setPending(null); setTitle(""); setCategory("Uploads"); setFeatured(false); setPct(0);
      await load();
    } catch (e: any) {
      setErr(e.message || "Upload failed");
    }
    setBusy(false);
  };

  const startEdit = (m: any) => { setEditing(m); setEditForm({ title: m.title, description: m.description || "", category: m.category || "", featured: !!m.featured, tags: (m.tags || []).join(", "), thumbnail_url: m.thumbnail_url || "" }); };
  const saveEdit = async () => {
    if (!editing) return;
    setReplaceBusy(true);
    try {
      await api.adminUpdateMedia(editing.id, {
        title: editForm.title,
        description: editForm.description || null,
        category: editForm.category,
        featured: !!editForm.featured,
        tags: (editForm.tags || "").split(",").map((t: string) => t.trim()).filter(Boolean),
        thumbnail_url: editForm.thumbnail_url || null,
      });
      setEditing(null); await load();
    } catch (e: any) { Alert.alert("Save failed", e.message || ""); }
    setReplaceBusy(false);
  };

  // Video thumbnail management (uploads a new image OR picks from Media Library)
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbPicker, setThumbPicker] = useState(false);
  const uploadVideoThumb = async () => {
    await askPerms();
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    setThumbBusy(true);
    try {
      const mime = a.mimeType || "image/jpeg";
      const up = await uploadFile(a.uri, a.fileName || `thumb-${Date.now()}.jpg`, mime, "image", { saveToLibrary: false });
      setEditForm((prev: any) => ({ ...prev, thumbnail_url: up.url }));
    } catch (e: any) { Alert.alert("Thumbnail upload failed", e.message || ""); }
    setThumbBusy(false);
  };

  const replaceMedia = async (m: any) => {
    const kind: "image" | "video" = m.media_type === "video" ? "video" : "image";
    await askPerms();
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "image" ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.85,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    const sizeMB = (a.fileSize || 0) / (1024 * 1024);
    const limit = kind === "image" ? MAX_IMG_MB : MAX_VIDEO_MB;
    if (sizeMB && sizeMB > limit) { Alert.alert("File too large", `Max ${limit} MB`); return; }
    setReplaceBusy(true); setPct(0);
    try {
      const mime = a.mimeType || (kind === "image" ? "image/jpeg" : "video/mp4");
      const up = await uploadFile(a.uri, a.fileName || `replace-${Date.now()}`, mime, kind, { onProgress: setPct });
      await api.adminReplaceMedia(m.id, { url: up.url, thumbnail_url: kind === "image" ? up.url : m.thumbnail_url, upload_id: up.id });
      await load();
    } catch (e: any) { Alert.alert("Replace failed", e.message || ""); }
    setReplaceBusy(false); setPct(0);
  };

  const del = (m: any) => {
    Alert.alert(
      "Delete media?",
      `"${m.title}" will be permanently removed from the Media Library.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
          try { await api.adminDeleteMedia(m.id); await load(); } catch (e: any) { Alert.alert("Delete failed", e.message || ""); }
        } },
      ],
    );
  };

  const filtered = items.filter((m) => (typeFilter === "All" || m.media_type === typeFilter)
    && (!search || (m.title || "").toLowerCase().includes(search.toLowerCase()) || (m.category || "").toLowerCase().includes(search.toLowerCase())));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title="MEDIA LIBRARY" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>

          {/* UPLOAD PANEL */}
          <View style={s.card}>
            <Text style={s.cardTitle}>UPLOAD NEW MEDIA</Text>
            {!pending && !busy && (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable onPress={() => pickAsset("image")} style={s.pickBtn} testID="pick-image">
                  <Ionicons name="image-outline" size={22} color={colors.brand} />
                  <Text style={s.pickTxt}>PICK IMAGE</Text>
                  <Text style={s.pickSub}>Up to {MAX_IMG_MB} MB</Text>
                </Pressable>
                <Pressable onPress={() => pickAsset("video")} style={s.pickBtn} testID="pick-video">
                  <Ionicons name="videocam-outline" size={22} color={colors.brand} />
                  <Text style={s.pickTxt}>PICK VIDEO</Text>
                  <Text style={s.pickSub}>Up to {MAX_VIDEO_MB} MB</Text>
                </Pressable>
              </View>
            )}

            {pending && !busy && (
              <View>
                <View style={s.previewBox}>
                  {pending.type === "image" ? (
                    <Image source={{ uri: pending.uri }} style={s.previewImg} contentFit="cover" />
                  ) : (
                    <View style={s.previewVideo}>
                      <Ionicons name="videocam" size={36} color="#fff" />
                      <Text style={s.previewVideoTxt}>{pending.name}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.meta}>{pending.mime}  ·  {pending.sizeMB.toFixed(2)} MB</Text>
                <AdminField label="TITLE" value={title} onChange={setTitle} testID="up-title" />
                <AdminField label="CATEGORY" value={category} onChange={setCategory} />
                <AdminSwitch label="FEATURED" value={featured} onChange={setFeatured} />
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}><AdminButton label="CANCEL" variant="ghost" onPress={() => setPending(null)} /></View>
                  <View style={{ flex: 2 }}><AdminButton label="UPLOAD" onPress={upload} testID="do-upload" icon="cloud-upload-outline" /></View>
                </View>
              </View>
            )}

            {busy && (
              <View style={s.progressBox}>
                <ActivityIndicator color={colors.brand} />
                <Text style={s.progressTxt}>UPLOADING… {pct}%</Text>
                <View style={s.barTrack}><View style={[s.barFill, { width: `${Math.max(pct, 3)}%` }]} /></View>
              </View>
            )}

            {err && <Text style={s.err}>{err}</Text>}
          </View>

          {/* FILTER + SEARCH */}
          <View style={s.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, alignItems: "center" }}>
              {TYPES.map((t) => (
                <Pressable key={t} onPress={() => setTypeFilter(t)} style={[s.chip, typeFilter === t && s.chipOn]} testID={`f-${t}`}>
                  <Text style={[s.chipTxt, typeFilter === t && s.chipTxtOn]}>{t.toUpperCase()}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search media…" placeholderTextColor={colors.muted} style={s.searchInput} />

          {/* LIST */}
          <Text style={s.listTitle}>MEDIA ({filtered.length})</Text>
          {loading ? <ActivityIndicator color={colors.brand} /> : filtered.length === 0 ? <AdminEmpty title="NO MEDIA" icon="images-outline" /> : filtered.map((m) => (
            <View key={m.id} style={s.row}>
              <View style={s.thumbWrap}>
                {m.media_type === "image" ? (
                  <Image source={{ uri: resolveUrl(m.thumbnail_url || m.url) }} style={s.thumb} contentFit="cover" />
                ) : m.media_type === "video" ? (
                  <View style={s.thumbVideo}><Ionicons name="play" size={20} color="#fff" /></View>
                ) : (
                  <View style={s.thumb}><Ionicons name="document" size={20} color={colors.brand} /></View>
                )}
              </View>
              <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                <Text style={s.mTitle} numberOfLines={1}>{m.title}</Text>
                <Text style={s.mMeta}>{m.media_type.toUpperCase()}  ·  {m.category || "—"}{m.featured ? "  ·  ★" : ""}</Text>
              </View>
              <Pressable onPress={() => startEdit(m)} style={s.iconBtn}><Ionicons name="create-outline" size={18} color={colors.onSurface3} /></Pressable>
              <Pressable onPress={() => replaceMedia(m)} style={s.iconBtn}><Ionicons name="swap-horizontal" size={18} color={colors.brand} /></Pressable>
              <Pressable onPress={() => del(m)} style={s.iconBtn}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* EDIT MODAL */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalWrap}>
          <View style={s.modalCard}>
            <Text style={s.cardTitle}>EDIT MEDIA</Text>
            <ScrollView>
              {editing && (editing.media_type === "image" ? (
                <Image source={{ uri: resolveUrl(editing.url) }} style={s.modalPreview} contentFit="cover" />
              ) : editing.media_type === "video" ? (
                <ModalVideoPreview url={resolveUrl(editing.url) || ""} />
              ) : null)}

              {/* CUSTOM THUMBNAIL (videos & docs) */}
              {editing && editing.media_type !== "image" && (
                <View style={s.thumbSection}>
                  <Text style={s.thumbLabel}>CUSTOM COVER / THUMBNAIL</Text>
                  <View style={s.thumbBox}>
                    {editForm.thumbnail_url ? (
                      <Image source={{ uri: resolveUrl(editForm.thumbnail_url) }} style={s.thumbPreview} contentFit="cover" />
                    ) : (
                      <View style={[s.thumbPreview, s.thumbPh]}>
                        <Ionicons name="image-outline" size={28} color={colors.muted} />
                        <Text style={s.thumbPhTxt}>NO THUMBNAIL</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                    <Pressable onPress={() => setThumbPicker(true)} style={s.thumbBtn} disabled={thumbBusy} testID="thumb-library">
                      <Ionicons name="albums-outline" size={14} color={colors.brand} />
                      <Text style={s.thumbBtnTxt}>LIBRARY</Text>
                    </Pressable>
                    <Pressable onPress={uploadVideoThumb} style={s.thumbBtn} disabled={thumbBusy} testID="thumb-upload">
                      {thumbBusy ? <ActivityIndicator size="small" color={colors.brand} /> : <Ionicons name="cloud-upload-outline" size={14} color={colors.brand} />}
                      <Text style={s.thumbBtnTxt}>UPLOAD</Text>
                    </Pressable>
                    {!!editForm.thumbnail_url && (
                      <Pressable onPress={() => setEditForm((p: any) => ({ ...p, thumbnail_url: "" }))} style={[s.thumbBtn, { borderColor: colors.error }]} testID="thumb-remove">
                        <Ionicons name="trash-outline" size={14} color={colors.error} />
                        <Text style={[s.thumbBtnTxt, { color: colors.error }]}>REMOVE</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              <AdminField label="TITLE" value={editForm.title} onChange={(v: string) => setEditForm({ ...editForm, title: v })} />
              <AdminField label="DESCRIPTION" value={editForm.description} onChange={(v: string) => setEditForm({ ...editForm, description: v })} multi />
              <AdminField label="CATEGORY" value={editForm.category} onChange={(v: string) => setEditForm({ ...editForm, category: v })} />
              <AdminField label="TAGS (comma separated)" value={editForm.tags} onChange={(v: string) => setEditForm({ ...editForm, tags: v })} />
              <AdminSwitch label="FEATURED" value={!!editForm.featured} onChange={(v: boolean) => setEditForm({ ...editForm, featured: v })} />
            </ScrollView>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1 }}><AdminButton label="CANCEL" variant="ghost" onPress={() => setEditing(null)} /></View>
              <View style={{ flex: 2 }}><AdminButton label="SAVE" onPress={saveEdit} loading={replaceBusy} icon="checkmark" /></View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Thumbnail picker (choose an existing image as video cover) */}
      <MediaPicker
        visible={thumbPicker}
        onClose={() => setThumbPicker(false)}
        onPick={(item) => setEditForm((p: any) => ({ ...p, thumbnail_url: item.url }))}
        kind="image"
        title="PICK THUMBNAIL FROM LIBRARY"
      />
    </View>
  );
}

function ModalVideoPreview({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => { p.loop = false; });
  return <VideoView player={player} style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", marginBottom: spacing.md }} nativeControls />;
}

const s = StyleSheet.create({
  card: { padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, marginBottom: spacing.md },
  cardTitle: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.4, color: colors.brand, marginBottom: spacing.md },
  pickBtn: { flex: 1, alignItems: "center", padding: spacing.md, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandLight, gap: 4 },
  pickTxt: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "900", color: colors.brand },
  pickSub: { fontSize: 10, color: colors.muted, letterSpacing: 0.5 },
  previewBox: { width: "100%", aspectRatio: 16 / 10, backgroundColor: colors.surface3, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  previewImg: { width: "100%", height: "100%" },
  previewVideo: { flex: 1, backgroundColor: colors.inverse, alignItems: "center", justifyContent: "center", gap: 4 },
  previewVideoTxt: { color: "#fff", fontSize: fs.xs, letterSpacing: 0.5 },
  meta: { fontSize: fs.xs, color: colors.muted, marginBottom: spacing.sm, letterSpacing: 0.5 },
  progressBox: { alignItems: "center", padding: spacing.md, gap: spacing.sm },
  progressTxt: { fontSize: fs.xs, fontWeight: "900", letterSpacing: 1.2, color: colors.brand },
  barTrack: { width: "100%", height: 8, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border },
  barFill: { height: "100%", backgroundColor: colors.brand },
  err: { color: colors.error, marginTop: spacing.sm, fontSize: fs.sm },
  filterRow: { height: 48, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, justifyContent: "center", marginBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, height: 36, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipOn: { borderColor: colors.brand, backgroundColor: colors.onSurface },
  chipTxt: { fontSize: fs.xs, fontWeight: "800", letterSpacing: 1, color: colors.onSurface3 },
  chipTxtOn: { color: colors.brand },
  searchInput: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, padding: spacing.md, marginBottom: spacing.md, fontSize: fs.base },
  listTitle: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "900", color: colors.onSurface3, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, marginBottom: spacing.sm, gap: 4 },
  thumbWrap: { width: 56, height: 56 },
  thumb: { width: "100%", height: "100%", backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  thumbVideo: { flex: 1, backgroundColor: colors.inverse, alignItems: "center", justifyContent: "center" },
  mTitle: { fontSize: fs.sm, fontWeight: "800", color: colors.onSurface },
  mMeta: { fontSize: 10, color: colors.muted, letterSpacing: 0.8, marginTop: 2, textTransform: "uppercase" },
  iconBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surface2, padding: spacing.lg, borderTopWidth: 2, borderTopColor: colors.brand, maxHeight: "85%" },
  modalPreview: { width: "100%", aspectRatio: 16 / 10, backgroundColor: colors.surface3, marginBottom: spacing.md },
  thumbSection: { marginBottom: spacing.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  thumbLabel: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "900", color: colors.brand, marginBottom: spacing.sm },
  thumbBox: { width: "100%", aspectRatio: 16 / 10, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border },
  thumbPreview: { width: "100%", height: "100%" },
  thumbPh: { alignItems: "center", justifyContent: "center", gap: 4 },
  thumbPhTxt: { fontSize: 10, letterSpacing: 1, fontWeight: "800", color: colors.muted },
  thumbBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderColor: colors.brand, paddingVertical: spacing.sm, backgroundColor: colors.brandLight },
  thumbBtnTxt: { fontSize: 10, letterSpacing: 1.2, fontWeight: "900", color: colors.brand },
});
