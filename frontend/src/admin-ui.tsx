import React from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fs, spacing } from "@/src/theme";

export function AdminTopBar({ title, right }: { title: string; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <SafeAreaView edges={["top"]} style={s.topBar}>
      <Pressable onPress={() => router.back()} style={s.back}>
        <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
      </Pressable>
      <Text numberOfLines={1} style={s.title}>{title}</Text>
      <View style={{ minWidth: 44, alignItems: "flex-end" }}>{right}</View>
    </SafeAreaView>
  );
}

export function AdminField({ label, value, onChange, multi, kb, secure, testID, placeholder }: any) {
  return (
    <View style={{ gap: 4, marginBottom: spacing.md }}>
      <Text style={s.lbl}>{label}</Text>
      <TextInput
        value={value ?? ""}
        onChangeText={onChange}
        multiline={multi}
        keyboardType={kb}
        secureTextEntry={secure}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize={kb === "email-address" ? "none" : "sentences"}
        style={[s.input, multi && { minHeight: 96, paddingTop: spacing.md, textAlignVertical: "top" }]}
        testID={testID}
      />
    </View>
  );
}

export function AdminSwitch({ label, value, onChange, testID }: any) {
  return (
    <Pressable onPress={() => onChange(!value)} style={s.switch} testID={testID}>
      <Text style={s.switchLbl}>{label}</Text>
      <View style={[s.switchBox, value && s.switchOn]}>
        <Text style={s.switchTxt}>{value ? "ON" : "OFF"}</Text>
      </View>
    </Pressable>
  );
}

export function AdminButton({ label, onPress, variant = "primary", loading, testID, icon }: any) {
  const styles: any = variant === "primary" ? s.btnPrimary : variant === "danger" ? s.btnDanger : s.btnGhost;
  const textStyles: any = variant === "primary" ? s.btnPrimaryTxt : variant === "danger" ? s.btnDangerTxt : s.btnGhostTxt;
  return (
    <Pressable onPress={onPress} disabled={loading} style={[styles, loading && { opacity: 0.5 }]} testID={testID}>
      {loading ? <ActivityIndicator color={variant === "ghost" ? colors.brand : "#fff"} /> : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" }}>
          {icon && <Ionicons name={icon} size={16} color={variant === "ghost" ? colors.brand : "#fff"} />}
          <Text style={textStyles}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function AdminSectionTitle({ title }: { title: string }) {
  return (
    <View style={s.secHead}>
      <View style={s.secBar} />
      <Text style={s.secTitle}>{title}</Text>
    </View>
  );
}

export function AdminEmpty({ icon = "cube-outline", title, actionLabel, onAction }: any) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={40} color={colors.muted} />
      <Text style={s.emptyTxt}>{title}</Text>
      {actionLabel && <AdminButton label={actionLabel} onPress={onAction} />}
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderStrong, gap: spacing.sm },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.4, color: colors.brand },
  lbl: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "800", color: colors.onSurface3 },
  input: { borderWidth: 1, borderColor: colors.borderStrong, padding: spacing.md, fontSize: fs.base, color: colors.onSurface, backgroundColor: colors.surface2, minHeight: 48 },
  switch: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  switchLbl: { flex: 1, fontSize: fs.sm, fontWeight: "700", letterSpacing: 1, color: colors.onSurface },
  switchBox: { paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  switchOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  switchTxt: { fontSize: fs.xs, fontWeight: "900", letterSpacing: 1.4, color: colors.onSurface },
  btnPrimary: { backgroundColor: colors.brand, paddingVertical: spacing.md, alignItems: "center", justifyContent: "center", minHeight: 48 },
  btnPrimaryTxt: { color: "#fff", fontWeight: "900", letterSpacing: 1.4, fontSize: fs.sm },
  btnDanger: { backgroundColor: colors.error, paddingVertical: spacing.md, alignItems: "center", justifyContent: "center", minHeight: 48 },
  btnDangerTxt: { color: "#fff", fontWeight: "900", letterSpacing: 1.4, fontSize: fs.sm },
  btnGhost: { paddingVertical: spacing.md, alignItems: "center", justifyContent: "center", minHeight: 48, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.surface2 },
  btnGhostTxt: { color: colors.brand, fontWeight: "900", letterSpacing: 1.4, fontSize: fs.sm },
  secHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  secBar: { width: 4, height: 18, backgroundColor: colors.brand },
  secTitle: { fontSize: fs.base, fontWeight: "900", letterSpacing: 1.4, color: colors.onSurface },
  empty: { alignItems: "center", padding: spacing.xl, gap: spacing.md },
  emptyTxt: { fontSize: fs.sm, letterSpacing: 1.2, fontWeight: "700", color: colors.muted },
});
