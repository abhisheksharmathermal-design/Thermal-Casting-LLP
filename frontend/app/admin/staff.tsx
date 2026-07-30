import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminField, AdminButton, AdminEmpty } from "@/src/admin-ui";

const ROLES = ["super_admin", "admin", "sales_executive"];

export default function AdminStaff() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ email: "", password: "", full_name: "", role: "sales_executive", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.adminStaff()) as any[]); } catch (e) { console.log(e); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    setErr(null);
    if (!form.email || !form.password || !form.full_name) { setErr("All fields required"); return; }
    setBusy(true);
    try {
      await api.adminCreateStaff(form);
      setShowForm(false);
      setForm({ email: "", password: "", full_name: "", role: "sales_executive", phone: "" });
      await load();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const del = async (id: string) => { try { await api.adminDeleteStaff(id); await load(); } catch (e) { console.log(e); } };

  if (user?.role !== "super_admin") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <AdminTopBar title="STAFF & ROLES" />
        <AdminEmpty title="SUPER ADMIN ONLY" icon="shield-outline" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title="STAFF & ROLES" right={
        <Pressable onPress={() => setShowForm(!showForm)} style={s.addBtn} testID="add-staff"><Ionicons name={showForm ? "close" : "add"} size={22} color="#fff" /></Pressable>
      } />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          {showForm && (
            <View style={s.editor}>
              <Text style={s.editorTitle}>NEW STAFF</Text>
              <AdminField label="FULL NAME" value={form.full_name} onChange={(v: string) => setForm({ ...form, full_name: v })} testID="staff-name" />
              <AdminField label="EMAIL" value={form.email} onChange={(v: string) => setForm({ ...form, email: v })} kb="email-address" testID="staff-email" />
              <AdminField label="PASSWORD" value={form.password} onChange={(v: string) => setForm({ ...form, password: v })} secure testID="staff-pw" />
              <AdminField label="PHONE" value={form.phone} onChange={(v: string) => setForm({ ...form, phone: v })} kb="phone-pad" />
              <Text style={s.hint}>ROLE</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md, flexWrap: "wrap" }}>
                {ROLES.map((r) => (
                  <Pressable key={r} onPress={() => setForm({ ...form, role: r })} style={[s.chip, form.role === r && s.chipOn]}>
                    <Text style={[s.chipTxt, form.role === r && s.chipTxtOn]}>{r.replace("_", " ").toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
              {err && <Text style={{ color: colors.error, marginBottom: spacing.sm }}>{err}</Text>}
              <AdminButton label="CREATE STAFF" onPress={create} loading={busy} testID="save-staff" icon="person-add" />
            </View>
          )}

          {loading ? <ActivityIndicator color={colors.brand} /> : items.map((u) => (
            <View key={u.id} style={s.row}>
              <View style={s.avatar}><Text style={s.avatarTxt}>{(u.full_name || u.email).charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{u.full_name}</Text>
                <Text style={s.sub}>{u.email}</Text>
                <View style={[s.roleTag, u.role === "super_admin" && { backgroundColor: colors.brand }]}>
                  <Text style={[s.roleTxt, u.role === "super_admin" && { color: "#fff" }]}>{u.role.replace("_", " ").toUpperCase()}</Text>
                </View>
              </View>
              {u.id !== user.id && (
                <Pressable onPress={() => del(u.id)} style={s.iconBtn}><Ionicons name="trash-outline" size={18} color={colors.error} /></Pressable>
              )}
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
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, marginBottom: spacing.sm },
  avatar: { width: 44, height: 44, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "900", fontSize: fs.lg },
  name: { fontSize: fs.base, fontWeight: "800", color: colors.onSurface },
  sub: { fontSize: fs.xs, color: colors.onSurface3, marginTop: 2 },
  roleTag: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: colors.brand },
  roleTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.brand },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
});
