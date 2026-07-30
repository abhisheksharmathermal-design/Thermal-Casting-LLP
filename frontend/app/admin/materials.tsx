import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminField, AdminButton, AdminSwitch, AdminEmpty } from "@/src/admin-ui";

export default function AdminMaterials() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ name: "", grade_code: "", category: "", description: "", standards: "", typical_use: "", enabled: true });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.materials()) as any[]); } catch (e) { console.log(e); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startEdit = (m: any | null) => {
    setEdit(m);
    setForm(m ? { ...m } : { name: "", grade_code: "", category: "", description: "", standards: "", typical_use: "", enabled: true });
  };
  const save = async () => {
    if (!form.name) return;
    setBusy(true);
    try {
      if (edit) await api.adminUpdateMaterial(edit.id, form);
      else await api.adminCreateMaterial(form);
      setEdit(null); setForm({ name: "", grade_code: "", category: "", description: "", standards: "", typical_use: "", enabled: true });
      await load();
    } catch (e) { console.log(e); }
    setBusy(false);
  };
  const del = async (id: string) => { try { await api.adminDeleteMaterial(id); await load(); } catch {} };

  if (edit !== null || form.name === "" && busy) {
    // Editor stays visible on demand — see form rendering below
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title="MATERIALS & GRADES" right={
        <Pressable onPress={() => startEdit(null)} style={s.addBtn} testID="add-material"><Ionicons name="add" size={22} color="#fff" /></Pressable>
      } />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          <View style={s.editor}>
            <Text style={s.editorTitle}>{edit ? "EDIT MATERIAL" : "NEW MATERIAL"}</Text>
            <AdminField label="NAME" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} testID="mat-name" placeholder="e.g. WCB, CF8M" />
            <AdminField label="GRADE CODE" value={form.grade_code} onChange={(v: string) => setForm({ ...form, grade_code: v })} />
            <AdminField label="CATEGORY" value={form.category} onChange={(v: string) => setForm({ ...form, category: v })} placeholder="Carbon Steel / Stainless / Nickel Alloy" />
            <AdminField label="DESCRIPTION" value={form.description} onChange={(v: string) => setForm({ ...form, description: v })} multi />
            <AdminField label="STANDARDS" value={form.standards} onChange={(v: string) => setForm({ ...form, standards: v })} placeholder="ASTM A216 / A351" />
            <AdminField label="TYPICAL USE" value={form.typical_use} onChange={(v: string) => setForm({ ...form, typical_use: v })} />
            <AdminSwitch label="ENABLED" value={form.enabled} onChange={(v: boolean) => setForm({ ...form, enabled: v })} />
            <AdminButton label={edit ? "UPDATE" : "CREATE"} onPress={save} loading={busy} testID="save-material" />
            {edit && <Pressable onPress={() => startEdit(null)} style={{ marginTop: spacing.sm, alignSelf: "center" }}><Text style={{ color: colors.muted, letterSpacing: 1 }}>CANCEL</Text></Pressable>}
          </View>

          <Text style={s.listTitle}>ALL MATERIALS ({items.length})</Text>
          {loading ? <ActivityIndicator color={colors.brand} /> : items.length === 0 ? <AdminEmpty title="NO MATERIALS" icon="flask-outline" /> : (
            items.map((m) => (
              <View key={m.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{m.name}  <Text style={s.code}>{m.grade_code ? "· " + m.grade_code : ""}</Text></Text>
                  <Text style={s.cat}>{m.category || "—"}{m.standards ? "  ·  " + m.standards : ""}</Text>
                  {m.description ? <Text style={s.desc} numberOfLines={2}>{m.description}</Text> : null}
                </View>
                <Pressable onPress={() => startEdit(m)} style={s.iconBtn}><Ionicons name="create-outline" size={18} color={colors.onSurface3} /></Pressable>
                <Pressable onPress={() => del(m.id)} style={s.iconBtn}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  addBtn: { width: 40, height: 40, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  editor: { padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, marginBottom: spacing.md },
  editorTitle: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.4, color: colors.brand, marginBottom: spacing.sm },
  listTitle: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "900", color: colors.onSurface3, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, marginBottom: spacing.sm },
  name: { fontSize: fs.base, fontWeight: "800", color: colors.onSurface },
  code: { fontSize: fs.xs, color: colors.brand, fontWeight: "700" },
  cat: { fontSize: fs.xs, color: colors.muted, marginTop: 2 },
  desc: { fontSize: fs.xs, color: colors.onSurface3, marginTop: 4 },
  iconBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
});
