import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Text, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { AdminTopBar, AdminField, AdminButton, AdminSwitch, AdminSectionTitle } from "@/src/admin-ui";
import { UploadField } from "@/src/upload-field";

export default function ProductEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const [form, setForm] = useState<any>({
    name: "", category: "", sku: "", short_description: "", description: "",
    material_ids: [], grade: "", industry: "", standards: "",
    weight: "", size: "", pressure_class: "", temperature_rating: "",
    casting_process: "", machining_details: "", inspection_details: "",
    heat_treatment: "", manufacturing_capacity: "",
    image_url: "", featured: false, enabled: true,
    seo_title: "", seo_description: "", seo_keywords: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { (async () => {
    if (!isNew) {
      try { const p: any = await api.product(id); setForm({ ...form, ...p }); } catch (e) { console.log(e); }
    }
  })(); }, [id]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setErr(null); setBusy(true);
    try {
      if (!form.name || !form.category) throw new Error("Name and category are required");
      if (isNew) await api.adminCreateProduct(form);
      else await api.adminUpdateProduct(id, form);
      router.back();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <AdminTopBar title={isNew ? "NEW PRODUCT" : "EDIT PRODUCT"} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
          <AdminSectionTitle title="BASIC INFO" />
          <View style={{ padding: spacing.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong, marginBottom: spacing.md }}>
            <AdminField label="PRODUCT NAME *" value={form.name} onChange={(v: string) => set("name", v)} testID="p-name" />
            <AdminField label="SKU / PRODUCT CODE" value={form.sku} onChange={(v: string) => set("sku", v)} testID="p-sku" placeholder="TC-XXXXX" />
            <AdminField label="CATEGORY *" value={form.category} onChange={(v: string) => set("category", v)} testID="p-cat" />
            <AdminField label="SUBCATEGORY" value={form.subcategory} onChange={(v: string) => set("subcategory", v)} />
            <AdminField label="SHORT DESCRIPTION" value={form.short_description} onChange={(v: string) => set("short_description", v)} />
            <AdminField label="DESCRIPTION" value={form.description} onChange={(v: string) => set("description", v)} multi />
            <UploadField label="PRODUCT IMAGE" value={form.image_url} onChange={(v: string) => set("image_url", v)} testID="p-image" />
          </View>

          <AdminSectionTitle title="TECHNICAL SPECS" />
          <View style={{ padding: spacing.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong, marginBottom: spacing.md }}>
            <AdminField label="MATERIAL / GRADE" value={form.materials} onChange={(v: string) => set("materials", v)} placeholder="e.g. WCB, CF8M" />
            <AdminField label="GRADE" value={form.grade} onChange={(v: string) => set("grade", v)} />
            <AdminField label="INDUSTRY" value={form.industry} onChange={(v: string) => set("industry", v)} />
            <AdminField label="STANDARDS" value={form.standards} onChange={(v: string) => set("standards", v)} placeholder="ASTM A216, A351" />
            <AdminField label="WEIGHT" value={form.weight} onChange={(v: string) => set("weight", v)} />
            <AdminField label="SIZE" value={form.size} onChange={(v: string) => set("size", v)} />
            <AdminField label="PRESSURE CLASS" value={form.pressure_class} onChange={(v: string) => set("pressure_class", v)} placeholder="150#, 300#" />
            <AdminField label="TEMPERATURE RATING" value={form.temperature_rating} onChange={(v: string) => set("temperature_rating", v)} />
            <AdminField label="CASTING PROCESS" value={form.casting_process} onChange={(v: string) => set("casting_process", v)} multi />
            <AdminField label="MACHINING DETAILS" value={form.machining_details} onChange={(v: string) => set("machining_details", v)} multi />
            <AdminField label="INSPECTION DETAILS" value={form.inspection_details} onChange={(v: string) => set("inspection_details", v)} multi />
            <AdminField label="HEAT TREATMENT" value={form.heat_treatment} onChange={(v: string) => set("heat_treatment", v)} />
            <AdminField label="MANUFACTURING CAPACITY" value={form.manufacturing_capacity} onChange={(v: string) => set("manufacturing_capacity", v)} />
          </View>

          <AdminSectionTitle title="SEO" />
          <View style={{ padding: spacing.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong, marginBottom: spacing.md }}>
            <AdminField label="SEO TITLE" value={form.seo_title} onChange={(v: string) => set("seo_title", v)} />
            <AdminField label="SEO DESCRIPTION" value={form.seo_description} onChange={(v: string) => set("seo_description", v)} multi />
            <AdminField label="SEO KEYWORDS" value={form.seo_keywords} onChange={(v: string) => set("seo_keywords", v)} />
          </View>

          <AdminSectionTitle title="VISIBILITY" />
          <View style={{ padding: spacing.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong, marginBottom: spacing.md }}>
            <AdminSwitch label="FEATURED (show on Home)" value={form.featured} onChange={(v: boolean) => set("featured", v)} />
            <AdminSwitch label="ENABLED (visible in catalogue)" value={form.enabled} onChange={(v: boolean) => set("enabled", v)} />
          </View>

          {err && <Text style={{ color: colors.error, textAlign: "center", marginBottom: spacing.md }}>{err}</Text>}
          <AdminButton label={isNew ? "CREATE PRODUCT" : "SAVE CHANGES"} onPress={save} loading={busy} testID="save-product" icon="checkmark" />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
