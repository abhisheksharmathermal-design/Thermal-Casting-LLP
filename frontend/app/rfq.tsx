import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, fs, spacing } from "@/src/theme";

const INDUSTRIES = ["Valves", "Pumps", "Mining", "Aluminium Smelting", "Steel Mill", "Oil & Gas", "General Engineering", "Other"];

export default function RFQ() {
  const router = useRouter();
  const { user } = useAuth();
  const { product_id, product_name } = useLocalSearchParams<{ product_id?: string; product_name?: string }>();
  const [form, setForm] = useState({
    company_name: user?.company || "",
    contact_person: user?.full_name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    industry: "",
    project_details: "",
    target_delivery: "",
  });
  const [items, setItems] = useState<any[]>(
    product_id ? [{ product_id, product_name, quantity: 1, specifications: "" }] : [{ product_name: "", quantity: 1, specifications: "" }],
  );
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const updateItem = (i: number, patch: any) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const addItem = () => setItems([...items, { product_name: "", quantity: 1, specifications: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const submit = async () => {
    setErr(null); setOk(null);
    if (!form.company_name || !form.contact_person || !form.email || !form.phone || !form.project_details) {
      setErr("Please fill all required fields");
      return;
    }
    if (items.some((it) => !it.product_name)) {
      setErr("Every item needs a product name");
      return;
    }
    setBusy(true);
    try {
      const r: any = await api.submitRFQ({ ...form, items });
      setOk(r.ref_no);
      setTimeout(() => router.replace("/(tabs)/portal"), 1200);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  if (ok) {
    return (
      <SafeAreaView style={s.screen} edges={["top"]}>
        <View style={s.successBox}>
          <View style={s.checkBadge}><Ionicons name="checkmark" size={44} color="#fff" /></View>
          <Text style={s.okTitle}>RFQ SUBMITTED</Text>
          <Text style={s.okRef}>{ok}</Text>
          <Text style={s.okMsg}>Our engineering team will review and respond shortly.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <Text style={s.topTitle}>REQUEST FOR QUOTATION</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Section title="CONTACT INFORMATION">
            <F label="COMPANY *" v={form.company_name} on={(v) => setForm({ ...form, company_name: v })} tid="rfq-company" />
            <F label="CONTACT PERSON *" v={form.contact_person} on={(v) => setForm({ ...form, contact_person: v })} tid="rfq-name" />
            <F label="EMAIL *" v={form.email} on={(v) => setForm({ ...form, email: v })} tid="rfq-email" kb="email-address" />
            <F label="PHONE *" v={form.phone} on={(v) => setForm({ ...form, phone: v })} tid="rfq-phone" kb="phone-pad" />
            <View>
              <Text style={s.lbl}>INDUSTRY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
                {INDUSTRIES.map((i) => (
                  <Pressable key={i} onPress={() => setForm({ ...form, industry: i })} style={[s.tag, form.industry === i && s.tagOn]}>
                    <Text style={[s.tagTxt, form.industry === i && s.tagTxtOn]}>{i.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Section>

          <Section title={`ITEMS (${items.length})`}>
            {items.map((it, i) => (
              <View key={i} style={s.itemBox}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={s.itemNo}>ITEM #{i + 1}</Text>
                  {items.length > 1 && (
                    <Pressable onPress={() => removeItem(i)} style={{ marginLeft: "auto" }}>
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </Pressable>
                  )}
                </View>
                <F label="PRODUCT NAME *" v={it.product_name} on={(v) => updateItem(i, { product_name: v })} tid={`item-name-${i}`} />
                <F label="QUANTITY" v={String(it.quantity)} on={(v) => updateItem(i, { quantity: parseInt(v) || 1 })} kb="number-pad" tid={`item-qty-${i}`} />
                <F label="SPECIFICATIONS / NOTES" v={it.specifications} on={(v) => updateItem(i, { specifications: v })} multi tid={`item-spec-${i}`} />
              </View>
            ))}
            <Pressable onPress={addItem} style={s.addBtn} testID="add-item">
              <Ionicons name="add" size={18} color={colors.brand} />
              <Text style={s.addTxt}>ADD ANOTHER ITEM</Text>
            </Pressable>
          </Section>

          <Section title="PROJECT DETAILS">
            <F label="PROJECT DETAILS *" v={form.project_details} on={(v) => setForm({ ...form, project_details: v })} multi tid="rfq-details" />
            <F label="TARGET DELIVERY" v={form.target_delivery} on={(v) => setForm({ ...form, target_delivery: v })} tid="rfq-delivery" />
          </Section>

          {err && <Text style={s.err}>{err}</Text>}

          <Pressable onPress={submit} disabled={busy} style={[s.submit, busy && { opacity: 0.5 }]} testID="rfq-submit">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.submitTxt}>SUBMIT RFQ →</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, children }: any) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm }}>
        <View style={s.bar} />
        <Text style={s.secTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function F({ label, v, on, kb, multi, tid }: any) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.lbl}>{label}</Text>
      <TextInput value={v} onChangeText={on} keyboardType={kb} multiline={multi} style={[s.input, multi && { minHeight: 84, paddingTop: spacing.md }]} textAlignVertical={multi ? "top" : "center"} autoCapitalize={kb === "email-address" ? "none" : "sentences"} testID={tid} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.4, color: colors.brand },
  bar: { width: 4, height: 18, backgroundColor: colors.brand },
  secTitle: { fontSize: fs.base, fontWeight: "900", letterSpacing: 1.4, color: colors.onSurface },
  lbl: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "800", color: colors.onSurface3 },
  input: { borderWidth: 1, borderColor: colors.borderStrong, padding: spacing.md, fontSize: fs.base, color: colors.onSurface, backgroundColor: colors.surface2, minHeight: 48 },
  itemBox: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, padding: spacing.md, gap: spacing.sm },
  itemNo: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "900", color: colors.brand },
  addBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, justifyContent: "center", borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandLight, paddingVertical: spacing.md },
  addTxt: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.2, color: colors.brand },
  tag: { paddingHorizontal: spacing.md, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  tagOn: { backgroundColor: colors.onSurface, borderColor: colors.brand },
  tagTxt: { fontSize: fs.xs, fontWeight: "700", letterSpacing: 1.1, color: colors.onSurface3 },
  tagTxtOn: { color: colors.brand },
  err: { color: colors.error, textAlign: "center", fontSize: fs.sm },
  submit: { backgroundColor: colors.brand, paddingVertical: spacing.lg, alignItems: "center", marginTop: spacing.md },
  submitTxt: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: fs.base },
  successBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  checkBadge: { width: 90, height: 90, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  okTitle: { fontSize: fs.xxl, fontWeight: "900", letterSpacing: 1, color: colors.onSurface },
  okRef: { fontSize: fs.xl, fontWeight: "900", color: colors.brand, letterSpacing: 1.5 },
  okMsg: { textAlign: "center", color: colors.onSurface3, fontSize: fs.base },
});
