import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { api, resolveUrl } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";

export default function VideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try {
      const vids: any = await api.videos();
      setVideo(vids.find((v: any) => v.id === id));
    } catch (e) { console.log(e); }
    setLoading(false);
  })(); }, [id]);

  const player = useVideoPlayer(resolveUrl(video?.url) || "", (p) => { p.loop = false; p.play(); });

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.brand} /></View>;
  if (!video) return <View style={s.center}><Text style={{ color: "#fff" }}>Video not found</Text></View>;

  return (
    <View style={s.screen}>
      <SafeAreaView edges={["top"]} style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={24} color="#fff" /></Pressable>
        <Text numberOfLines={1} style={s.topTitle}>{video.title}</Text>
        <View style={{ width: 44 }} />
      </SafeAreaView>
      <VideoView player={player} style={s.player} contentFit="contain" allowsFullscreen nativeControls />
      <View style={s.body}>
        <Text style={s.cat}>{video.category?.toUpperCase()}</Text>
        <Text style={s.title}>{video.title}</Text>
        {video.description ? <Text style={s.desc}>{video.description}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: "#000" },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: fs.sm, fontWeight: "800", letterSpacing: 1.2 },
  player: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  body: { padding: spacing.lg, backgroundColor: colors.surface2, flex: 1 },
  cat: { fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "800", color: colors.brand },
  title: { fontSize: fs.xl, fontWeight: "900", color: colors.onSurface, marginTop: 4 },
  desc: { fontSize: fs.base, color: colors.onSurface2, marginTop: spacing.md, lineHeight: 22 },
});
