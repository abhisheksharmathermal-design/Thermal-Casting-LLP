import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminField, AdminButton, AdminSwitch, AdminEmpty } from "@/src/admin-ui";
import { UploadField } from "@/src/upload-field";

export default function AdminNews() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ title: "", summary: "", body: "", image_url: "", type: "news", published: true, priority: "normal" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.news()) as any[]); } catch {}
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startEdit = (n: any | null) => { setEdit(n); setForm(n ? { ...n } : { title: "", summary: "", body: "", image_url: "", type: "news", published: true, priority: "normal" }); };
  const save = async () => {
    if (!form.title) return;
    setBusy(true);
    try {
      if (edit) await api.adminUpdateNews(edit.id, form);
      else await api.adminCreateNews(form);
      startEdit(null); await load();
    } catch (e) { console.log(e); }
    setBusy(false);
  };
  const del = async (id: string) => { try { await api.adminDeleteNews(id); await load(); } catch {} };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title="NEWS & ANNOUNCEMENTS" right={<Pressable onPress={() => startEdit(null)} style={s.addBtn} testID="add-news"><Ionicons name="add" size={22} color="#fff" /></Pressable>} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          <View style={s.editor}>
            <Text style={s.editorTitle}>{edit ? "EDIT" : "NEW POST"}</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
              {["news", "announcement"].map((t) => (
                <Pressable key={t} onPress={() => setForm({ ...form, type: t })} style={[s.chip, form.type === t && s.chipOn]}>
                  <Text style={[s.chipTxt, form.type === t && s.chipTxtOn]}>{t.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <AdminField label="TITLE" value={form.title} onChange={(v: string) => setForm({ ...form, title: v })} testID="news-title" />
            <AdminField label="SUMMARY" value={form.summary} onChange={(v: string) => setForm({ ...form, summary: v })} multi />
            <AdminField label="BODY" value={form.body} onChange={(v: string) => setForm({ ...form, body: v })} multi />
            <UploadField label="COVER IMAGE" value={form.image_url} onChange={(v: string) => setForm({ ...form, image_url: v })} testID="news-image" />
            <Text style={s.hint}>PRIORITY</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
              {["low", "normal", "high"].map((p) => (
                <Pressable key={p} onPress={() => setForm({ ...form, priority: p })} style={[s.chip, form.priority === p && s.chipOn]}>
                  <Text style={[s.chipTxt, form.priority === p && s.chipTxtOn]}>{p.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <AdminSwitch label="PUBLISHED" value={form.published} onChange={(v: boolean) => setForm({ ...form, published: v })} />
            <AdminButton label={edit ? "UPDATE" : "PUBLISH"} onPress={save} loading={busy} testID="save-news" />
            {edit && <Pressable onPress={() => startEdit(null)} style={{ marginTop: spacing.sm, alignSelf: "center" }}><Text style={{ color: colors.muted, letterSpacing: 1 }}>CANCEL</Text></Pressable>}
          </View>

          <Text style={s.listTitle}>ALL POSTS ({items.length})</Text>
          {loading ? <ActivityIndicator color={colors.brand} /> : items.length === 0 ? <AdminEmpty title="NO POSTS" icon="megaphone-outline" /> : items.map((n) => (
            <View key={n.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: 4 }}>
                  <View style={[s.tag, { backgroundColor: n.type === "announcement" ? colors.brandLight : colors.surface3 }]}>
                    <Text style={s.tagTxt}>{n.type.toUpperCase()}</Text>
                  </View>
                  {n.priority === "high" && <View style={[s.tag, { backgroundColor: "#FEE2E2" }]}><Text style={[s.tagTxt, { color: colors.error }]}>HIGH</Text></View>}
                </View>
                <Text style={s.name}>{n.title}</Text>
                {n.summary ? <Text style={s.desc} numberOfLines={2}>{n.summary}</Text> : null}
              </View>
              <Pressable onPress={() => startEdit(n)} style={s.iconBtn}><Ionicons name="create-outline" size={18} color={colors.onSurface3} /></Pressable>
              <Pressable onPress={() => del(n.id)} style={s.iconBtn}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  addBtn: { width: 40, height: 40, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  editor: { padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, marginBottom: spacing.md },
  editorTitle: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.4, color: colors.brand, marginBottom: spacing.sm },
  hint: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "800", color: colors.onSurface3, marginBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.brand, backgroundColor: colors.onSurface },
  chipTxt: { fontSize: fs.xs, fontWeight: "800", letterSpacing: 1, color: colors.onSurface3 },
  chipTxtOn: { color: colors.brand },
  listTitle: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "900", color: colors.onSurface3, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, marginBottom: spacing.sm },
  tag: { paddingHorizontal: 6, paddingVertical: 2 },
  tagTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.onSurface },
  name: { fontSize: fs.base, fontWeight: "800", color: colors.onSurface },
  desc: { fontSize: fs.xs, color: colors.muted, marginTop: 4 },
  iconBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
});
