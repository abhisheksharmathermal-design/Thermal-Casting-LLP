import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminField, AdminButton, AdminSectionTitle } from "@/src/admin-ui";
import { UploadField } from "@/src/upload-field";

export default function AdminCompany() {
  const [c, setC] = useState<any>({ name: "", tagline: "", about: "", hero_image: "", contact: { phone: "", emails: [], website: "", address: "" } });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { (async () => { try { setC(await api.company()); } catch {} })(); }, []);

  const setField = (k: string, v: any) => setC((prev: any) => ({ ...prev, [k]: v }));
  const setContact = (k: string, v: any) => setC((prev: any) => ({ ...prev, contact: { ...(prev.contact || {}), [k]: v } }));

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const payload = { ...c };
      delete payload._id;
      await api.adminUpdateCompany(payload);
      setMsg("SAVED SUCCESSFULLY");
    } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title="COMPANY PROFILE" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <AdminSectionTitle title="CORPORATE IDENTITY" />
          <View style={s.box}>
            <AdminField label="COMPANY NAME" value={c.name} onChange={(v: string) => setField("name", v)} />
            <AdminField label="TAGLINE" value={c.tagline} onChange={(v: string) => setField("tagline", v)} />
            <AdminField label="ABOUT" value={c.about} onChange={(v: string) => setField("about", v)} multi />
            <UploadField label="HERO IMAGE" value={c.hero_image} onChange={(v: string) => setField("hero_image", v)} testID="company-hero" />
          </View>

          <AdminSectionTitle title="CONTACT" />
          <View style={s.box}>
            <AdminField label="PHONE" value={c.contact?.phone} onChange={(v: string) => setContact("phone", v)} />
            <AdminField label="EMAIL(S) — comma separated" value={(c.contact?.emails || []).join(", ")} onChange={(v: string) => setContact("emails", v.split(",").map((x) => x.trim()).filter(Boolean))} />
            <AdminField label="WEBSITE" value={c.contact?.website} onChange={(v: string) => setContact("website", v)} />
            <AdminField label="ADDRESS" value={c.contact?.address} onChange={(v: string) => setContact("address", v)} multi />
          </View>

          <AdminSectionTitle title="CERTIFICATIONS / INDUSTRIES (comma separated)" />
          <View style={s.box}>
            <AdminField label="CERTIFICATIONS" value={(c.certifications || []).join(" | ")} onChange={(v: string) => setField("certifications", v.split("|").map((x) => x.trim()).filter(Boolean))} multi />
            <AdminField label="INDUSTRIES" value={(c.industries || []).join(", ")} onChange={(v: string) => setField("industries", v.split(",").map((x) => x.trim()).filter(Boolean))} multi />
          </View>

          {msg && <Text style={{ textAlign: "center", color: msg.includes("SAVED") ? colors.success : colors.error, marginBottom: spacing.md, fontWeight: "700", letterSpacing: 1 }}>{msg}</Text>}
          <AdminButton label="SAVE COMPANY PROFILE" onPress={save} loading={busy} testID="save-company" icon="save-outline" />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  box: { padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2, marginBottom: spacing.md },
});
