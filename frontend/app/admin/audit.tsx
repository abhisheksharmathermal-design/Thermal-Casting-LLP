import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminEmpty } from "@/src/admin-ui";

export default function AdminAudit() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await api.adminAuditLogs()) as any[]); } catch (e) { console.log(e); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title="AUDIT LOGS" />
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          {items.length === 0 ? <AdminEmpty title="NO ACTIVITY YET" icon="time-outline" /> : items.map((log) => (
            <View key={log.id} style={s.row}>
              <View style={s.iconBox}><Text style={s.iconTxt}>{log.action.split(".")[0].charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.action}>{log.action.toUpperCase()}</Text>
                <Text style={s.who}>{log.actor_email || "system"}  ·  {log.actor_role || "-"}</Text>
                <Text style={s.when}>{new Date(log.timestamp).toLocaleString()}  ·  {log.entity}{log.entity_id ? " #" + log.entity_id.slice(0, 8) : ""}</Text>
                {log.meta && Object.keys(log.meta).length > 0 ? <Text style={s.meta}>{JSON.stringify(log.meta)}</Text> : null}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, marginBottom: spacing.sm },
  iconBox: { width: 32, height: 32, backgroundColor: colors.brandLight, borderWidth: 1, borderColor: colors.brand, alignItems: "center", justifyContent: "center" },
  iconTxt: { color: colors.brand, fontWeight: "900" },
  action: { fontSize: fs.xs, fontWeight: "900", letterSpacing: 1.4, color: colors.brand },
  who: { fontSize: fs.xs, color: colors.onSurface, marginTop: 2 },
  when: { fontSize: fs.xs, color: colors.muted, marginTop: 2 },
  meta: { fontSize: 10, color: colors.onSurface3, marginTop: 4, fontFamily: "monospace" },
});
