import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { colors, fs, spacing } from "@/src/theme";

type Card = { title: string; icon: any; route: string; roles: string[]; desc: string };

const CARDS: Card[] = [
  { title: "PRODUCTS", icon: "cube-outline", route: "/admin/products", roles: ["super_admin", "admin"], desc: "Manage catalogue, images, videos, brochures" },
  { title: "MATERIALS & GRADES", icon: "flask-outline", route: "/admin/materials", roles: ["super_admin", "admin"], desc: "Casting materials & metallurgical grades" },
  { title: "CATEGORIES", icon: "grid-outline", route: "/admin/categories", roles: ["super_admin", "admin"], desc: "Product categories and subcategories" },
  { title: "COMPANY PROFILE", icon: "business-outline", route: "/admin/company", roles: ["super_admin", "admin"], desc: "Corporate info, contact, certifications" },
  { title: "NEWS & ANNOUNCEMENTS", icon: "megaphone-outline", route: "/admin/news", roles: ["super_admin", "admin"], desc: "Publish news feed & announcements" },
  { title: "MEDIA LIBRARY", icon: "images-outline", route: "/admin/media-library", roles: ["super_admin", "admin"], desc: "Upload, replace & organise images/videos/PDFs" },
  { title: "CUSTOMERS", icon: "people-outline", route: "/admin/customers", roles: ["super_admin", "admin", "sales_executive"], desc: "View customers & activity" },
  { title: "RFQs", icon: "document-text-outline", route: "/admin/rfqs", roles: ["super_admin", "admin", "sales_executive"], desc: "Assign, quote & track inquiries" },
  { title: "AI KNOWLEDGE", icon: "sparkles-outline", route: "/admin/ai-docs", roles: ["super_admin", "admin"], desc: "Upload documents grounding the AI" },
  { title: "STAFF & ROLES", icon: "shield-outline", route: "/admin/staff", roles: ["super_admin"], desc: "Manage Admin & Sales Exec accounts" },
  { title: "WORDPRESS SYNC", icon: "sync-outline", route: "/admin/sync", roles: ["super_admin", "admin"], desc: "Two-way sync with WordPress site" },
  { title: "AUDIT LOGS", icon: "time-outline", route: "/admin/audit", roles: ["super_admin", "admin"], desc: "All admin activity & changes" },
  { title: "BULK IMPORT / EXPORT", icon: "server-outline", route: "/admin/bulk", roles: ["super_admin", "admin"], desc: "CSV import & export products" },
];

export default function AdminHub() {
  const router = useRouter();
  const { user } = useAuth();

  if (!user || !["super_admin", "admin", "sales_executive"].includes(user.role)) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <Text style={{ fontSize: fs.base, color: colors.muted }}>Admin access required</Text>
      </SafeAreaView>
    );
  }

  const cards = CARDS.filter((c) => c.roles.includes(user.role));

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.mono}>ENTERPRISE CMS  ·  {user.role.replace("_", " ").toUpperCase()}</Text>
          <Text style={s.h1}>Admin Console</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        <View style={s.grid}>
          {cards.map((c) => (
            <Pressable key={c.title} onPress={() => router.push(c.route as any)} style={s.card} testID={`admin-${c.title}`}>
              <View style={s.iconBox}>
                <Ionicons name={c.icon} size={24} color={colors.brand} />
              </View>
              <Text style={s.cardTitle}>{c.title}</Text>
              <Text style={s.cardDesc}>{c.desc}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", padding: spacing.md, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderStrong, alignItems: "center", gap: spacing.sm },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  mono: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "800", color: colors.brand },
  h1: { fontSize: fs.xxl, fontWeight: "900", color: colors.onSurface, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: { width: "48.5%", padding: spacing.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong, minHeight: 130 },
  iconBox: { width: 40, height: 40, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  cardTitle: { fontSize: fs.xs, fontWeight: "900", letterSpacing: 1.3, color: colors.onSurface },
  cardDesc: { fontSize: 10, letterSpacing: 0.5, color: colors.muted, marginTop: 4, lineHeight: 14 },
});
