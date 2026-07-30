import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";

const SUGGESTED = [
  "What grades do you cast for valve bodies?",
  "Tell me about your aluminium sow moulds",
  "What is the largest single-piece casting you can produce?",
  "Which certifications does Thermal Casting hold?",
];

export default function Assistant() {
  const [sessionId] = useState(() => `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async (txt?: string) => {
    const message = (txt ?? input).trim();
    if (!message || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const r: any = await api.chat({ session_id: sessionId, message });
      setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `[Error] ${e.message}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={s.dot} />
          <Text style={s.mono}>KNOWLEDGE ASSISTANT · CLAUDE 4.5</Text>
        </View>
        <Text style={s.h1}>TC/AI</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={80}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 40 }}>
          {messages.length === 0 && (
            <View style={s.welcome}>
              <Text style={s.welcomeTitle}>&gt; READY</Text>
              <Text style={s.welcomeSub}>ASK ABOUT PRODUCTS, MATERIALS, CAPABILITIES, CERTIFICATIONS.</Text>
              <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
                {SUGGESTED.map((q) => (
                  <Pressable key={q} onPress={() => send(q)} style={s.suggBtn} testID={`suggest-${q.slice(0,10)}`}>
                    <Ionicons name="arrow-forward" size={14} color={colors.brand} />
                    <Text style={s.suggTxt}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {messages.map((m, i) => (
            <View key={i} style={[s.bubble, m.role === "user" ? s.userBub : s.aiBub]}>
              <Text style={s.bubMeta}>{m.role === "user" ? "YOU" : "TC/AI"}</Text>
              <Text style={m.role === "user" ? s.userTxt : s.aiTxt}>{m.content}</Text>
            </View>
          ))}
          {busy && (
            <View style={[s.bubble, s.aiBub]}>
              <Text style={s.bubMeta}>TC/AI</Text>
              <ActivityIndicator color={colors.brand} />
            </View>
          )}
        </ScrollView>

        <View style={s.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="TYPE A COMMAND..."
            placeholderTextColor={colors.muted}
            style={s.input}
            editable={!busy}
            onSubmitEditing={() => send()}
            testID="ai-input"
          />
          <Pressable onPress={() => send()} disabled={busy || !input.trim()} style={[s.sendBtn, (!input.trim() || busy) && { opacity: 0.4 }]} testID="ai-send">
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderStrong },
  dot: { width: 8, height: 8, backgroundColor: colors.success },
  mono: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "700", color: colors.onSurface3 },
  h1: { fontSize: fs.xxl, fontWeight: "900", color: colors.onSurface, marginTop: 2 },
  welcome: { padding: spacing.lg, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2 },
  welcomeTitle: { fontSize: fs.xxl, fontWeight: "900", color: colors.brand, letterSpacing: 1 },
  welcomeSub: { marginTop: spacing.sm, fontSize: fs.sm, color: colors.onSurface3, letterSpacing: 1.2, fontWeight: "600" },
  suggBtn: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  suggTxt: { flex: 1, fontSize: fs.base, color: colors.onSurface, fontWeight: "600" },
  bubble: { padding: spacing.md, borderWidth: 1, maxWidth: "88%" },
  userBub: { alignSelf: "flex-end", backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  aiBub: { alignSelf: "flex-start", backgroundColor: colors.surface2, borderColor: colors.borderStrong },
  bubMeta: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "800", color: colors.brand, marginBottom: 4 },
  userTxt: { color: "#fff", fontSize: fs.base, lineHeight: 20 },
  aiTxt: { color: colors.onSurface, fontSize: fs.base, lineHeight: 20 },
  inputBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface2, borderTopWidth: 1, borderTopColor: colors.borderStrong },
  input: { flex: 1, borderWidth: 1, borderColor: colors.borderStrong, padding: spacing.md, fontSize: fs.base, color: colors.onSurface, backgroundColor: colors.surface, height: 48 },
  sendBtn: { width: 48, height: 48, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
