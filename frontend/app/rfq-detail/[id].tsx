import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, fs, spacing } from "@/src/theme";
import { StatusPill } from "@/app/(tabs)/portal";

const STATUSES = ["submitted", "under_review", "engineering_review", "quoted", "closed"];

export default function RFQDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [r, setR] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => { try { const d: any = await api.rfq(id); setR(d); setNotes(d.admin_notes || ""); setStatus(d.status); } catch (e) { console.log(e); } setLoading(false); };
  useEffect(() => { load(); }, [id]);

  const saveStatus = async () => {
    setSaving(true);
    try { await api.adminUpdateRFQ(id, { status, admin_notes: notes, priority, quotation_url: quoteUrl || undefined, quotation_amount: quoteAmt ? parseFloat(quoteAmt) : undefined }); await load(); } catch (e) { console.log(e); }
    setSaving(false);
  };

  const [priority, setPriority] = useState<string>("normal");
  const [quoteUrl, setQuoteUrl] = useState<string>("");
  const [quoteAmt, setQuoteAmt] = useState<string>("");

  React.useEffect(() => {
    if (r) {
      setPriority(r.priority || "normal");
      setQuoteUrl(r.quotation_url || "");
      setQuoteAmt(r.quotation_amount ? String(r.quotation_amount) : "");
    }
  }, [r]);

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.brand} /></View>;
  if (!r) return <View style={s.center}><Text>Not found</Text></View>;

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <Text style={s.topTitle}>{r.ref_no}</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}>
          <View style={s.headBlock}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={s.mono}>RFQ REFERENCE</Text>
              <StatusPill status={r.status} />
            </View>
            <Text style={s.ref}>{r.ref_no}</Text>
            <Text style={s.date}>SUBMITTED {new Date(r.created_at).toLocaleString()}</Text>
          </View>

          <View style={s.block}>
            <Text style={s.blockLbl}>COMPANY</Text><Text style={s.blockVal}>{r.company_name}</Text>
            <Text style={s.blockLbl}>CONTACT</Text><Text style={s.blockVal}>{r.contact_person}</Text>
            <Text style={s.blockLbl}>EMAIL</Text><Text style={s.blockVal}>{r.email}</Text>
            <Text style={s.blockLbl}>PHONE</Text><Text style={s.blockVal}>{r.phone}</Text>
            {r.industry ? <><Text style={s.blockLbl}>INDUSTRY</Text><Text style={s.blockVal}>{r.industry}</Text></> : null}
            <Text style={s.blockLbl}>PROJECT DETAILS</Text><Text style={s.blockVal}>{r.project_details}</Text>
            {r.target_delivery ? <><Text style={s.blockLbl}>TARGET DELIVERY</Text><Text style={s.blockVal}>{r.target_delivery}</Text></> : null}
          </View>

          <Text style={s.h2}>ITEMS</Text>
          {r.items.map((it: any, i: number) => (
            <View key={i} style={s.item}>
              <Text style={s.itemNo}>ITEM #{i + 1}  ·  QTY {it.quantity}</Text>
              <Text style={s.itemName}>{it.product_name}</Text>
              {it.specifications ? <Text style={s.itemSpec}>{it.specifications}</Text> : null}
            </View>
          ))}

          {["super_admin", "admin", "sales_executive"].includes(user?.role || "") && (
            <View style={s.adminBox}>
              <Text style={s.h2}>ADMIN CONTROLS</Text>
              <Text style={s.blockLbl}>STATUS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
                {STATUSES.map((st) => (
                  <Pressable key={st} onPress={() => setStatus(st)} style={[s.stChip, status === st && s.stChipOn]} testID={`st-${st}`}>
                    <Text style={[s.stTxt, status === st && s.stTxtOn]}>{st.replace(/_/g, " ").toUpperCase()}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={s.blockLbl}>PRIORITY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
                {["low", "normal", "high", "urgent"].map((p) => (
                  <Pressable key={p} onPress={() => setPriority(p)} style={[s.stChip, priority === p && s.stChipOn]}>
                    <Text style={[s.stTxt, priority === p && s.stTxtOn]}>{p.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={s.blockLbl}>QUOTATION URL</Text>
              <TextInput value={quoteUrl} onChangeText={setQuoteUrl} placeholder="https://…" style={s.notes} />
              <Text style={s.blockLbl}>QUOTATION AMOUNT</Text>
              <TextInput value={quoteAmt} onChangeText={setQuoteAmt} keyboardType="decimal-pad" placeholder="0.00" style={s.notes} />
              <Text style={s.blockLbl}>ADMIN NOTES</Text>
              <TextInput value={notes} onChangeText={setNotes} multiline style={s.notes} placeholder="Internal notes…" testID="admin-notes" />
              <Pressable onPress={saveStatus} disabled={saving} style={[s.saveBtn, saving && { opacity: 0.5 }]} testID="save-status">
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>SAVE CHANGES →</Text>}
              </Pressable>
            </View>
          )}
          {r.admin_notes && user?.role === "customer" && (
            <View style={s.block}>
              <Text style={s.blockLbl}>NOTES FROM THERMAL CASTING</Text>
              <Text style={s.blockVal}>{r.admin_notes}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.4, color: colors.brand },
  headBlock: { padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2 },
  mono: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "800", color: colors.muted },
  ref: { fontSize: fs.xxl, fontWeight: "900", color: colors.brand, letterSpacing: 1, marginTop: 6 },
  date: { fontSize: fs.xs, color: colors.muted, letterSpacing: 0.8, marginTop: 4 },
  block: { padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2 },
  blockLbl: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "800", color: colors.brand, marginTop: spacing.sm },
  blockVal: { fontSize: fs.base, color: colors.onSurface, marginTop: 2, lineHeight: 20 },
  h2: { fontSize: fs.base, fontWeight: "900", letterSpacing: 1.4, color: colors.onSurface, marginTop: spacing.sm },
  item: { padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2 },
  itemNo: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "800", color: colors.brand },
  itemName: { fontSize: fs.base, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  itemSpec: { fontSize: fs.sm, color: colors.onSurface3, marginTop: 4 },
  adminBox: { padding: spacing.md, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandLight },
  stChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2 },
  stChipOn: { backgroundColor: colors.onSurface, borderColor: colors.brand },
  stTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.onSurface },
  stTxtOn: { color: colors.brand },
  notes: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: "#fff", padding: spacing.md, minHeight: 80, textAlignVertical: "top", fontSize: fs.base },
  saveBtn: { backgroundColor: colors.onSurface, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.md },
  saveTxt: { color: colors.brand, fontWeight: "900", letterSpacing: 1.5 },
});
