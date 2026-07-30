import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminButton, AdminEmpty } from "@/src/admin-ui";

export default function Sessions() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.sessions()) as any[]); } catch (e) { console.log(e); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const revoke = async (sid: string) => {
    setBusy(true);
    try { await api.revokeSession(sid); await load(); } catch (e) { console.log(e); }
    setBusy(false);
  };
  const logoutOthers = async () => {
    setBusy(true);
    try { await api.logoutOtherSessions(); await load(); } catch (e) { console.log(e); }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title="ACTIVE DEVICES" />
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          <Text style={s.info}>
            You have {items.length} active session{items.length === 1 ? "" : "s"}. Maximum 10 sessions allowed per account.
            Older sessions are automatically ended.
          </Text>

          {items.length > 1 && (
            <View style={{ marginBottom: spacing.md }}>
              <AdminButton label="SIGN OUT ALL OTHER DEVICES" onPress={logoutOthers} loading={busy} variant="ghost" icon="log-out-outline" testID="btn-logout-others" />
            </View>
          )}

          {items.length === 0 ? <AdminEmpty title="NO ACTIVE SESSIONS" icon="phone-portrait-outline" /> : items.map((sess) => (
            <View key={sess.id} style={[s.row, sess.current && s.rowCurrent]}>
              <View style={s.iconBox}>
                <Ionicons name={sess.user_agent?.toLowerCase().includes("mobile") ? "phone-portrait" : "desktop-outline"} size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Text style={s.device} numberOfLines={1}>{shortUA(sess.user_agent)}</Text>
                  {sess.current && <View style={s.currentTag}><Text style={s.currentTagTxt}>THIS DEVICE</Text></View>}
                </View>
                <Text style={s.meta}>IP: {sess.ip || "—"}  ·  {new Date(sess.last_seen).toLocaleString()}</Text>
                <Text style={s.metaSub}>Session id: {sess.id.slice(0, 8)}…  ·  Expires {new Date(sess.expires_at).toLocaleDateString()}</Text>
              </View>
              {!sess.current && (
                <Pressable onPress={() => revoke(sess.id)} style={s.iconBtn} testID={`revoke-${sess.id}`}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function shortUA(ua: string) {
  if (!ua || ua === "unknown") return "Unknown device";
  if (ua.includes("iPhone")) return "iPhone";
  if (ua.includes("iPad")) return "iPad";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Macintosh")) return "Mac";
  if (ua.includes("Windows")) return "Windows PC";
  if (ua.includes("Linux")) return "Linux";
  return ua.slice(0, 50);
}

const s = StyleSheet.create({
  info: { fontSize: fs.sm, color: colors.onSurface3, marginBottom: spacing.md, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "flex-start", padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, marginBottom: spacing.sm },
  rowCurrent: { borderColor: colors.brand, borderWidth: 2 },
  iconBox: { width: 40, height: 40, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center" },
  device: { fontSize: fs.base, fontWeight: "800", color: colors.onSurface, flex: 1 },
  currentTag: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.brand },
  currentTagTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: "#fff" },
  meta: { fontSize: fs.xs, color: colors.muted, marginTop: 4, letterSpacing: 0.5 },
  metaSub: { fontSize: 10, color: colors.muted, marginTop: 2, letterSpacing: 0.4 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
});
