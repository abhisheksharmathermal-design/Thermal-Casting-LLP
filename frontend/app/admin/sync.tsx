import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";

export default function WPSync() {
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const t = await AsyncStorage.getItem("tc_token_v1");
      const r = await fetch(`${API_BASE}/admin/wp/status`, { headers: { Authorization: `Bearer ${t}` } });
      setStatus(await r.json());
    } catch (e: any) { setMsg(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const runSync = async () => {
    setSyncing(true); setMsg(null);
    try {
      const t = await AsyncStorage.getItem("tc_token_v1");
      const r = await fetch(`${API_BASE}/admin/wp/sync`, { method: "POST", headers: { Authorization: `Bearer ${t}` } });
      const data = await r.json();
      setMsg(data.status === "ok" ? `Synced ${data.counts.products} products, ${data.counts.media} media` : (data.counts?.error || "Sync failed"));
      await load();
    } catch (e: any) { setMsg(e.message); }
    setSyncing(false);
  };

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <Text style={s.topTitle}>WORDPRESS SYNC</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}>
        {loading ? <ActivityIndicator color={colors.brand} /> : (
          <>
            <View style={s.card}>
              <Text style={s.lbl}>INTEGRATION STATUS</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 6 }}>
                <View style={[s.dot, { backgroundColor: status?.configured ? colors.success : colors.warning }]} />
                <Text style={s.val}>{status?.configured ? "CONFIGURED" : "NOT CONFIGURED"}</Text>
              </View>
              {status?.wp_url ? <Text style={s.url}>{status.wp_url}</Text> : (
                <Text style={s.hint}>Set WORDPRESS_BASE_URL, WORDPRESS_USER and WORDPRESS_APP_PASSWORD in backend/.env to enable sync with your existing WordPress website.</Text>
              )}
            </View>

            <Pressable onPress={runSync} disabled={syncing || !status?.configured} style={[s.syncBtn, (!status?.configured || syncing) && { opacity: 0.5 }]} testID="run-sync">
              {syncing ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="sync" size={20} color="#fff" />
                  <Text style={s.syncTxt}>PULL FROM WORDPRESS</Text>
                </>
              )}
            </Pressable>

            {msg && <View style={s.msg}><Text style={s.msgTxt}>{msg}</Text></View>}

            <Text style={s.h2}>ARCHITECTURE</Text>
            <View style={s.card}>
              <Text style={s.para}>The mobile app talks to canonical /api endpoints only. A pluggable WordPress adapter pulls products, media, brochures and news from WP REST API and normalizes them into our schema.</Text>
              <Text style={s.para}>WordPress can be replaced by any CMS (Strapi, Contentful, or a dedicated backend) by swapping the adapter — the mobile app remains untouched.</Text>
            </View>

            <Text style={s.h2}>RECENT SYNCS</Text>
            {(status?.recent_syncs || []).length === 0 ? (
              <Text style={s.hint}>No syncs yet.</Text>
            ) : (
              (status.recent_syncs || []).map((log: any) => (
                <View key={log.id} style={s.logRow}>
                  <View style={[s.dot, { backgroundColor: log.status === "success" ? colors.success : log.status === "error" ? colors.error : colors.warning }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.logTitle}>{log.status.toUpperCase()} · {log.direction?.toUpperCase()}</Text>
                    <Text style={s.logSub}>{new Date(log.started_at).toLocaleString()} · P:{log.counts?.products || 0} M:{log.counts?.media || 0}</Text>
                    {log.error && <Text style={s.logErr}>{log.error}</Text>}
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.4, color: colors.brand },
  card: { padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2 },
  lbl: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "800", color: colors.brand },
  val: { fontSize: fs.base, fontWeight: "900", color: colors.onSurface, letterSpacing: 1 },
  url: { fontSize: fs.sm, color: colors.onSurface3, marginTop: 6 },
  hint: { fontSize: fs.sm, color: colors.muted, marginTop: 6, lineHeight: 20 },
  dot: { width: 10, height: 10 },
  syncBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brand, paddingVertical: spacing.lg },
  syncTxt: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: fs.base },
  msg: { padding: spacing.md, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandLight },
  msgTxt: { color: "#9A3412", fontWeight: "700" },
  h2: { fontSize: fs.base, fontWeight: "900", letterSpacing: 1.4, color: colors.onSurface, marginTop: spacing.md },
  para: { fontSize: fs.sm, color: colors.onSurface2, lineHeight: 20, marginBottom: spacing.sm },
  logRow: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: "flex-start" },
  logTitle: { fontSize: fs.xs, fontWeight: "900", letterSpacing: 1, color: colors.onSurface },
  logSub: { fontSize: fs.xs, color: colors.muted, marginTop: 2 },
  logErr: { fontSize: fs.xs, color: colors.error, marginTop: 4 },
});
