import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminField, AdminButton } from "@/src/admin-ui";

export default function ChangePassword() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setMsg(null);
    if (!current || !next || !confirm) { setMsg({ ok: false, text: "All fields are required" }); return; }
    if (next.length < 8) { setMsg({ ok: false, text: "New password must be at least 8 characters" }); return; }
    if (next !== confirm) { setMsg({ ok: false, text: "New passwords do not match" }); return; }
    setBusy(true);
    try {
      await api.changePassword({ current_password: current, new_password: next, confirm_password: confirm });
      setMsg({ ok: true, text: "Password updated. Other sessions have been signed out." });
      setCurrent(""); setNext(""); setConfirm("");
      setTimeout(() => router.back(), 1200);
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title="CHANGE PASSWORD" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.info}>Enter your current password and choose a new one. Changing your password will sign you out of all other devices.</Text>
            <AdminField label="CURRENT PASSWORD" value={current} onChange={setCurrent} secure testID="in-current" />
            <AdminField label="NEW PASSWORD (min 8 chars)" value={next} onChange={setNext} secure testID="in-new" />
            <AdminField label="CONFIRM NEW PASSWORD" value={confirm} onChange={setConfirm} secure testID="in-confirm" />
            {msg && <Text style={[s.msg, { color: msg.ok ? colors.success : colors.error }]}>{msg.text}</Text>}
            <AdminButton label="UPDATE PASSWORD" onPress={submit} loading={busy} testID="btn-save-pw" icon="checkmark" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  card: { padding: spacing.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong },
  info: { fontSize: fs.sm, color: colors.onSurface3, marginBottom: spacing.lg, lineHeight: 20 },
  msg: { fontSize: fs.sm, fontWeight: "700", textAlign: "center", marginBottom: spacing.md, letterSpacing: 0.5 },
});
