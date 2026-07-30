import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminField, AdminButton, AdminSwitch, AdminEmpty } from "@/src/admin-ui";

const TYPES = ["catalogue", "brochure", "spec_sheet", "certificate", "policy", "other"];

export default function AdminAIDocs() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ title: "", description: "", doc_type: "catalogue", url: "", content: "", enabled: true });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.adminAIDocs()) as any[]); } catch (e) { console.log(e); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!form.title) return;
    setBusy(true);
    try {
      await api.adminCreateAIDoc(form);
      setForm({ title: "", description: "", doc_type: "catalogue", url: "", content: "", enabled: true });
      setShowForm(false);
      await load();
    } catch (e) { console.log(e); }
    setBusy(false);
  };
  const del = async (id: string) => { try { await api.adminDeleteAIDoc(id); await load(); } catch {} };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title="AI KNOWLEDGE" right={<Pressable onPress={() => setShowForm(!showForm)} style={s.addBtn}><Ionicons name={showForm ? "close" : "add"} size={22} color="#fff" /></Pressable>} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          {showForm && (
            <View style={s.editor}>
              <Text style={s.editorTitle}>UPLOAD KNOWLEDGE DOCUMENT</Text>
              <Text style={s.info}>Paste full document text below (or provide URL). The AI Assistant will automatically use this content as approved grounding knowledge in every reply.</Text>
              <AdminField label="TITLE" value={form.title} onChange={(v: string) => setForm({ ...form, title: v })} testID="ai-title" />
              <AdminField label="DESCRIPTION" value={form.description} onChange={(v: string) => setForm({ ...form, description: v })} />
              <Text style={s.hint}>DOCUMENT TYPE</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.md }}>
                {TYPES.map((t) => (
                  <Pressable key={t} onPress={() => setForm({ ...form, doc_type: t })} style={[s.chip, form.doc_type === t && s.chipOn]}>
                    <Text style={[s.chipTxt, form.doc_type === t && s.chipTxtOn]}>{t.replace("_", " ").toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
              <AdminField label="EXTERNAL URL (optional)" value={form.url} onChange={(v: string) => setForm({ ...form, url: v })} placeholder="https://…" />
              <AdminField label="DOCUMENT CONTENT (grounding text)" value={form.content} onChange={(v: string) => setForm({ ...form, content: v })} multi placeholder="Paste product specs, policies, technical data…" testID="ai-content" />
              <AdminSwitch label="ACTIVE (use in AI grounding)" value={form.enabled} onChange={(v: boolean) => setForm({ ...form, enabled: v })} />
              <AdminButton label="ADD KNOWLEDGE" onPress={create} loading={busy} testID="save-ai" icon="cloud-upload-outline" />
            </View>
          )}

          <Text style={s.listTitle}>ACTIVE KNOWLEDGE ({items.length})</Text>
          {loading ? <ActivityIndicator color={colors.brand} /> : items.length === 0 ? <AdminEmpty title="NO DOCUMENTS UPLOADED" icon="sparkles-outline" /> : items.map((d) => (
            <View key={d.id} style={s.row}>
              <View style={s.iconBox}><Ionicons name="document-text-outline" size={22} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{d.title}</Text>
                <Text style={s.meta}>{d.doc_type.toUpperCase()}{d.enabled ? "  ·  ACTIVE" : "  ·  INACTIVE"}{d.uploaded_by ? "  ·  " + d.uploaded_by : ""}</Text>
                {d.description ? <Text style={s.desc} numberOfLines={2}>{d.description}</Text> : null}
              </View>
              <Pressable onPress={() => del(d.id)} style={s.iconBtn}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
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
  info: { fontSize: fs.xs, color: colors.onSurface3, marginBottom: spacing.md, lineHeight: 18 },
  hint: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "800", color: colors.onSurface3, marginBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.brand, backgroundColor: colors.onSurface },
  chipTxt: { fontSize: fs.xs, fontWeight: "800", letterSpacing: 1, color: colors.onSurface3 },
  chipTxtOn: { color: colors.brand },
  listTitle: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "900", color: colors.onSurface3, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, marginBottom: spacing.sm },
  iconBox: { width: 44, height: 44, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center" },
  name: { fontSize: fs.base, fontWeight: "800", color: colors.onSurface },
  meta: { fontSize: fs.xs, color: colors.brand, marginTop: 2, letterSpacing: 1, fontWeight: "700" },
  desc: { fontSize: fs.xs, color: colors.onSurface3, marginTop: 4 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
});
