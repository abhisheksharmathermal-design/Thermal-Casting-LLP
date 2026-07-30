import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminField, AdminButton, AdminSwitch, AdminEmpty } from "@/src/admin-ui";

export default function AdminCategories() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ name: "", parent_id: "", description: "", display_order: 0, enabled: true });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.categories()) as any[]); } catch {}
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startEdit = (m: any | null) => { setEdit(m); setForm(m ? { ...m, parent_id: m.parent_id || "" } : { name: "", parent_id: "", description: "", display_order: 0, enabled: true }); };
  const save = async () => {
    if (!form.name) return;
    setBusy(true);
    const payload = { ...form, parent_id: form.parent_id || null, display_order: parseInt(form.display_order) || 0 };
    try {
      if (edit) await api.adminUpdateCategory(edit.id, payload);
      else await api.adminCreateCategory(payload);
      setEdit(null); setForm({ name: "", parent_id: "", description: "", display_order: 0, enabled: true });
      await load();
    } catch (e) { console.log(e); }
    setBusy(false);
  };
  const del = async (id: string) => { try { await api.adminDeleteCategory(id); await load(); } catch {} };

  const parents = items.filter((i) => !i.parent_id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title="CATEGORIES" right={<Pressable onPress={() => startEdit(null)} style={s.addBtn} testID="add-cat"><Ionicons name="add" size={22} color="#fff" /></Pressable>} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          <View style={s.editor}>
            <Text style={s.editorTitle}>{edit ? "EDIT CATEGORY" : "NEW CATEGORY"}</Text>
            <AdminField label="NAME *" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} testID="cat-name" />
            <AdminField label="DESCRIPTION" value={form.description} onChange={(v: string) => setForm({ ...form, description: v })} multi />
            <AdminField label="DISPLAY ORDER" value={String(form.display_order)} onChange={(v: string) => setForm({ ...form, display_order: v })} kb="number-pad" />
            <Text style={s.hint}>PARENT CATEGORY (leave empty for top-level)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
              <Pressable onPress={() => setForm({ ...form, parent_id: "" })} style={[s.chip, !form.parent_id && s.chipOn]}><Text style={[s.chipTxt, !form.parent_id && s.chipTxtOn]}>NONE</Text></Pressable>
              {parents.filter((p) => p.id !== edit?.id).map((p) => (
                <Pressable key={p.id} onPress={() => setForm({ ...form, parent_id: p.id })} style={[s.chip, form.parent_id === p.id && s.chipOn]}>
                  <Text style={[s.chipTxt, form.parent_id === p.id && s.chipTxtOn]}>{p.name.toUpperCase()}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <AdminSwitch label="ENABLED" value={form.enabled} onChange={(v: boolean) => setForm({ ...form, enabled: v })} />
            <AdminButton label={edit ? "UPDATE" : "CREATE"} onPress={save} loading={busy} testID="save-cat" />
            {edit && <Pressable onPress={() => startEdit(null)} style={{ marginTop: spacing.sm, alignSelf: "center" }}><Text style={{ color: colors.muted, letterSpacing: 1 }}>CANCEL</Text></Pressable>}
          </View>

          <Text style={s.listTitle}>CATEGORIES ({items.length})</Text>
          {loading ? <ActivityIndicator color={colors.brand} /> : items.length === 0 ? <AdminEmpty title="NO CATEGORIES" icon="grid-outline" /> : parents.map((p) => (
            <View key={p.id}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{p.name}</Text>
                  {p.description ? <Text style={s.desc} numberOfLines={2}>{p.description}</Text> : null}
                </View>
                <Pressable onPress={() => startEdit(p)} style={s.iconBtn}><Ionicons name="create-outline" size={18} color={colors.onSurface3} /></Pressable>
                <Pressable onPress={() => del(p.id)} style={s.iconBtn}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
              </View>
              {items.filter((c) => c.parent_id === p.id).map((c) => (
                <View key={c.id} style={[s.row, s.subRow]}>
                  <Ionicons name="return-down-forward" size={16} color={colors.muted} />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={s.subName}>{c.name}</Text>
                  </View>
                  <Pressable onPress={() => startEdit(c)} style={s.iconBtn}><Ionicons name="create-outline" size={16} color={colors.onSurface3} /></Pressable>
                  <Pressable onPress={() => del(c.id)} style={s.iconBtn}><Ionicons name="trash-outline" size={16} color={colors.error} /></Pressable>
                </View>
              ))}
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
  hint: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "800", color: colors.onSurface3 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.brand, backgroundColor: colors.onSurface },
  chipTxt: { fontSize: fs.xs, fontWeight: "800", letterSpacing: 1, color: colors.onSurface3 },
  chipTxtOn: { color: colors.brand },
  listTitle: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "900", color: colors.onSurface3, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, marginBottom: spacing.sm },
  subRow: { marginLeft: spacing.lg, borderColor: colors.border, backgroundColor: colors.surface },
  name: { fontSize: fs.base, fontWeight: "800", color: colors.onSurface },
  subName: { fontSize: fs.sm, fontWeight: "700", color: colors.onSurface2 },
  desc: { fontSize: fs.xs, color: colors.muted, marginTop: 4 },
  iconBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
});
