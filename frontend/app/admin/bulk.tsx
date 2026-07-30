import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, API_BASE } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminField, AdminButton, AdminSectionTitle } from "@/src/admin-ui";

const SAMPLE_CSV = `name,category,sku,short_description,materials,grade,standards,weight,size,featured
Sample Valve Body,Valve Castings,TC-SAMPLE-1,Sample entry,WCB,WCB,ASTM A216,25 kg,DN100,true`;

export default function AdminBulk() {
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const doImport = async () => {
    setBusy(true); setResult(null);
    try {
      setResult(await api.adminImportCSV(csv));
    } catch (e: any) { setResult({ error: e.message }); }
    setBusy(false);
  };

  const openExport = async () => {
    const t = await AsyncStorage.getItem("tc_token_v1");
    // Backend requires auth for export. Since the Linking flow can't send headers,
    // we fetch here and inform the user of the CSV endpoint.
    Linking.openURL(`${API_BASE}/admin/products/export-csv?token=${t}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title="BULK IMPORT / EXPORT" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <AdminSectionTitle title="CSV IMPORT (PRODUCTS)" />
          <View style={s.box}>
            <Text style={s.info}>Paste CSV with header row. Required columns: <Text style={s.mono}>name, category</Text>. Optional: sku, short_description, materials, grade, standards, weight, size, image_url, featured.</Text>
            <AdminField label="CSV DATA" value={csv} onChange={setCsv} multi testID="csv-input" />
            <AdminButton label="IMPORT PRODUCTS" onPress={doImport} loading={busy} testID="bulk-import" icon="cloud-upload-outline" />
            {result && (
              <View style={[s.result, result.error ? { backgroundColor: "#FEE2E2", borderColor: colors.error } : { backgroundColor: "#D1FAE5", borderColor: colors.success }]}>
                {result.error ? <Text style={{ color: colors.error }}>{result.error}</Text> : (
                  <>
                    <Text style={s.resultTitle}>{result.imported} IMPORTED  ·  {result.skipped} SKIPPED</Text>
                    {(result.errors || []).map((e: string, i: number) => <Text key={i} style={s.errLine}>{e}</Text>)}
                  </>
                )}
              </View>
            )}
          </View>

          <AdminSectionTitle title="EXPORT" />
          <View style={s.box}>
            <Text style={s.info}>Download all products or RFQs as CSV. Requires an authenticated session.</Text>
            <View style={{ gap: spacing.sm }}>
              <AdminButton label="EXPORT PRODUCTS CSV" onPress={openExport} variant="ghost" icon="download-outline" />
              <Text style={s.hint}>Note: browser download requires you to be logged in with your JWT — use RFQ export via the RFQs screen for authenticated download.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  box: { padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, marginBottom: spacing.md },
  info: { fontSize: fs.sm, color: colors.onSurface3, marginBottom: spacing.md, lineHeight: 20 },
  mono: { fontFamily: "monospace", color: colors.brand },
  hint: { fontSize: fs.xs, color: colors.muted, lineHeight: 16 },
  result: { padding: spacing.md, borderWidth: 1, marginTop: spacing.md },
  resultTitle: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.2, color: colors.onSurface },
  errLine: { fontSize: fs.xs, color: colors.error, marginTop: 4 },
});
