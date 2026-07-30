import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image as RNImage } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { useFocusEffect } from "expo-router";

const LOGO = require("../../assets/images/logo.png");

export default function Portal() {
  const { user, loading, login, logout } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [rfqLoad, setRfqLoad] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const loadStaffData = useCallback(async () => {
    if (!user) return;
    setRfqLoad(true);
    try {
      if (["super_admin", "admin"].includes(user.role)) {
        const [all, st]: any = await Promise.all([api.allRFQs(), api.adminStats()]);
        setRfqs(all); setStats(st);
      } else if (user.role === "sales_executive") {
        setRfqs((await api.allRFQs()) as any[]);
      }
    } catch (e) { console.log(e); }
    setRfqLoad(false);
  }, [user]);

  useFocusEffect(useCallback(() => { if (user) loadStaffData(); }, [user, loadStaffData]));

  const submit = async () => {
    setErr(null); setBusy(true);
    try { await login(email.trim(), password); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.brand} /></View>;

  // === LOGIN SCREEN (ADMIN ONLY — customer signup hidden) ===
  if (!user) {
    return (
      <SafeAreaView style={s.screen} edges={["top"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            <View style={s.brandBlock}>
              <RNImage source={LOGO} style={s.brandLogo} resizeMode="contain" />
              <Text style={s.brandTag}>ADMIN PORTAL</Text>
              <Text style={s.brandSub}>Enterprise Content Management</Text>
            </View>

            <View style={s.loginBox}>
              <Text style={s.mono}>SIGN IN</Text>
              <Text style={s.h1}>Administrator Login</Text>
              <View style={{ height: spacing.md }} />
              <Field label="EMAIL" value={email} onChange={setEmail} kb="email-address" testID="in-email" />
              <Field label="PASSWORD" value={password} onChange={setPassword} secure testID="in-pw" />
              {err && <Text style={s.err}>{err}</Text>}
              <Pressable onPress={submit} disabled={busy} style={[s.primary, busy && { opacity: 0.5 }]} testID="btn-submit">
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>SIGN IN →</Text>}
              </Pressable>
            </View>

            <Text style={s.legalHint}>
              This is a restricted-access portal for authorised Thermal Casting personnel.
              {"\n"}For product inquiries, please use the RFQ / Inquiry form.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // === STAFF DASHBOARD ===
  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.pHeader}>
          <RNImage source={LOGO} style={s.headerLogo} resizeMode="contain" />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={s.mono}>{user.role.replace("_", " ").toUpperCase()}</Text>
            <Text style={s.h1}>{user.full_name}</Text>
            <Text style={s.h1Sub}>{user.email}</Text>
          </View>
          <Pressable onPress={logout} style={s.logoutBtn} testID="btn-logout">
            <Ionicons name="log-out-outline" size={20} color={colors.onSurface} />
          </Pressable>
        </View>

        {stats && (
          <View style={s.statsGrid}>
            <StatCard label="RFQs" value={stats.rfqs} />
            <StatCard label="PRODUCTS" value={stats.products} />
            <StatCard label="MEDIA" value={stats.media} />
            <StatCard label="INQUIRIES" value={stats.rfqs_by_status?.submitted || 0} />
          </View>
        )}

        <Pressable style={s.syncBar} onPress={() => router.push("/admin")} testID="btn-admin-hub">
          <Ionicons name="apps-outline" size={20} color={colors.brand} />
          <Text style={s.syncTxt}>ENTERPRISE ADMIN CONSOLE</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurface3} />
        </Pressable>

        <Pressable style={s.syncBar} onPress={() => router.push("/account/change-password")} testID="btn-change-pw">
          <Ionicons name="key-outline" size={20} color={colors.brand} />
          <Text style={s.syncTxt}>CHANGE PASSWORD</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurface3} />
        </Pressable>

        <Pressable style={s.syncBar} onPress={() => router.push("/account/sessions")} testID="btn-sessions">
          <Ionicons name="phone-portrait-outline" size={20} color={colors.brand} />
          <Text style={s.syncTxt}>ACTIVE DEVICES</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurface3} />
        </Pressable>

        <View style={s.sectionHead}>
          <View style={s.bar} />
          <Text style={s.sTitle}>RECENT RFQs</Text>
        </View>

        {rfqLoad ? <View style={s.center}><ActivityIndicator color={colors.brand} /></View> : rfqs.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="document-text-outline" size={40} color={colors.muted} />
            <Text style={s.emptyTxt}>NO RFQs YET</Text>
          </View>
        ) : (
          rfqs.slice(0, 10).map((r) => (
            <Pressable key={r.id} style={s.rfqCard} onPress={() => router.push(`/rfq-detail/${r.id}`)} testID={`rfq-${r.ref_no}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={s.rfqRef}>{r.ref_no}</Text>
                <StatusPill status={r.status} />
              </View>
              <Text style={s.rfqComp}>{r.company_name}</Text>
              <Text style={s.rfqItems}>{r.items.length} ITEM(S)  ·  {new Date(r.created_at).toLocaleDateString()}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, secure, kb, testID }: any) {
  return (
    <View style={{ gap: 4, marginBottom: spacing.md }}>
      <Text style={s.lbl}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={kb}
        autoCapitalize={kb === "email-address" ? "none" : "sentences"}
        style={s.input}
        testID={testID}
      />
    </View>
  );
}

function StatCard({ label, value }: any) {
  return (
    <View style={s.statCard}>
      <Text style={s.statLbl}>{label}</Text>
      <Text style={s.statVal}>{value}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: any = {
    submitted: { bg: colors.brandLight, fg: colors.brand },
    under_review: { bg: colors.brandLight, fg: colors.brand },
    engineering_review: { bg: "#FEF3C7", fg: "#78350F" },
    quoted: { bg: "#D1FAE5", fg: "#064E3B" },
    closed: { bg: colors.surface3, fg: colors.onSurface3 },
  };
  const c = map[status] || map.submitted;
  return (
    <View style={[s.pill, { backgroundColor: c.bg }]}>
      <Text style={[s.pillTxt, { color: c.fg }]}>{status.replace(/_/g, " ").toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  brandBlock: { alignItems: "center", padding: spacing.xl, marginTop: spacing.xl },
  brandLogo: { width: 160, height: 160 },
  brandTag: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 2, color: colors.brand, marginTop: spacing.md },
  brandSub: { fontSize: fs.xs, letterSpacing: 1.4, color: colors.muted, marginTop: 4 },

  loginBox: { padding: spacing.lg, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong, marginTop: spacing.md },
  mono: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "800", color: colors.brand },
  h1: { fontSize: fs.xxl, fontWeight: "900", color: colors.onSurface, marginTop: 4 },
  h1Sub: { fontSize: fs.sm, color: colors.muted, marginTop: 2, letterSpacing: 0.8 },
  lbl: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "800", color: colors.onSurface3 },
  input: { borderWidth: 1, borderColor: colors.borderStrong, padding: spacing.md, fontSize: fs.base, color: colors.onSurface, backgroundColor: colors.surface, height: 48 },
  err: { color: colors.error, fontSize: fs.sm, letterSpacing: 0.5, marginBottom: spacing.sm },
  primary: { backgroundColor: colors.brand, paddingVertical: spacing.lg, alignItems: "center", minHeight: 52 },
  primaryTxt: { color: "#fff", fontWeight: "900", fontSize: fs.base, letterSpacing: 1.5 },
  legalHint: { textAlign: "center", fontSize: fs.xs, color: colors.muted, letterSpacing: 0.8, marginTop: spacing.xl, lineHeight: 18 },

  pHeader: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  headerLogo: { width: 56, height: 56 },
  logoutBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong },
  statsGrid: { flexDirection: "row", flexWrap: "wrap" },
  statCard: { width: "50%", padding: spacing.lg, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2 },
  statLbl: { fontSize: fs.xs, letterSpacing: 1.4, color: colors.muted, fontWeight: "700" },
  statVal: { fontSize: 28, fontWeight: "900", color: colors.brand, marginTop: 4 },

  syncBar: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.border },
  syncTxt: { flex: 1, fontSize: fs.sm, fontWeight: "800", letterSpacing: 1.4, color: colors.onSurface },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
  bar: { width: 4, height: 18, backgroundColor: colors.brand },
  sTitle: { fontSize: fs.base, fontWeight: "900", letterSpacing: 1.4, color: colors.onSurface },

  emptyBox: { alignItems: "center", padding: spacing.xl, gap: spacing.md },
  emptyTxt: { fontSize: fs.sm, letterSpacing: 1.2, fontWeight: "700", color: colors.muted },
  rfqCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong, gap: 4 },
  rfqRef: { fontSize: fs.base, fontWeight: "900", color: colors.brand, letterSpacing: 1 },
  rfqComp: { fontSize: fs.base, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  rfqItems: { fontSize: fs.xs, color: colors.muted, letterSpacing: 0.8, textTransform: "uppercase" },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  pillTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
});
