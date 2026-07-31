import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Linking, Image as RNImage } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { resolveUrl } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";

export default function HomeScreen() {
  const router = useRouter();
  const [company, setCompany] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [c, m, v, p, n]: any = await Promise.all([
        api.company(),
        api.media(),
        api.videos(),
        api.products({ featured: true }),
        api.news(),
      ]);
      setCompany(c);
      setMedia(m);
      setVideos(v);
      setFeatured(p);
      setNews(n);
    } catch (e) {
      console.log("home load err", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  // Refresh whenever the Home tab regains focus so any admin edits appear immediately.
  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) {
    return (
      <SafeAreaView style={s.center} edges={["top"]}>
        <ActivityIndicator color={colors.brand} size="large" />
      </SafeAreaView>
    );
  }

  const heroImage = resolveUrl(company?.hero_image) || "https://images.pexels.com/photos/6804260/pexels-photo-6804260.jpeg?w=1200";
  const images = media.filter((m) => m.media_type === "image");
  const brochures = media.filter((m) => m.media_type === "brochure" || m.media_type === "certificate");

  return (
    <View style={s.screen}>
      <ScrollView
        stickyHeaderIndices={[]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        {/* HERO */}
        <View style={s.hero} testID="home-hero">
          <Image source={{ uri: heroImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["transparent", "rgba(17,24,39,0.95)"]} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={["top"]} style={s.heroInner}>
            <View style={s.brandRow}>
              <RNImage source={require("../../assets/images/logo.png")} style={s.logoImg} resizeMode="contain" />
              <Text style={s.brandName}>THERMAL CASTING LLP</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={s.heroTitle}>{company?.tagline || "Precision Alloy Steel Castings"}</Text>
            <Text style={s.heroMeta}>ISO 9001:2015  ·  IBR-1950  ·  BHEL APPROVED</Text>
          </SafeAreaView>
        </View>

        {/* QUICK ACTIONS */}
        <View style={s.actions}>
          <Pressable style={s.actionBtn} onPress={() => router.push("/(tabs)/catalogue")} testID="action-catalogue">
            <Ionicons name="cube-outline" size={20} color={colors.onSurface} />
            <Text style={s.actionTxt}>Catalogue</Text>
          </Pressable>
          <Pressable style={s.actionBtn} onPress={() => router.push("/rfq")} testID="action-rfq">
            <Ionicons name="document-text-outline" size={20} color={colors.onSurface} />
            <Text style={s.actionTxt}>Request Quote</Text>
          </Pressable>
        </View>

        {/* NEWS & ANNOUNCEMENTS */}
        {news.length > 0 && (
          <Section title="NEWS & ANNOUNCEMENTS">
            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
              {news.slice(0, 5).map((n: any) => (
                <View key={n.id} style={s.newsCard}>
                  <View style={s.newsTagRow}>
                    <View style={[s.newsTag, { backgroundColor: n.type === "announcement" ? colors.brand : colors.surface3 }]}>
                      <Text style={[s.newsTagTxt, { color: n.type === "announcement" ? "#fff" : colors.onSurface }]}>{n.type.toUpperCase()}</Text>
                    </View>
                    {n.priority === "high" && <Text style={s.newsHigh}>HIGH PRIORITY</Text>}
                    <Text style={s.newsDate}>{new Date(n.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={s.newsTitle}>{n.title}</Text>
                  {n.summary ? <Text style={s.newsSummary}>{n.summary}</Text> : null}
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* FEATURED PRODUCTS */}
        <Section title="FEATURED PRODUCTS" onSeeAll={() => router.push("/(tabs)/catalogue")}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
            {featured.map((p: any) => (
              <Pressable key={p.id} style={s.prodCard} onPress={() => router.push(`/product/${p.id}`)} testID={`featured-${p.ref_no}`}>
                <Image source={{ uri: resolveUrl(p.image_url) || heroImage }} style={s.prodImg} contentFit="cover" />
                <View style={s.prodBody}>
                  <Text style={s.prodRef}>{p.ref_no}</Text>
                  <Text numberOfLines={2} style={s.prodName}>{p.name}</Text>
                  <Text style={s.prodCat}>{p.category}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Section>

        {/* VIDEO LIBRARY */}
        <Section title="VIDEO LIBRARY" onSeeAll={() => router.push("/media")}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
            {videos.map((v: any) => {
              const thumb = resolveUrl(v.thumbnail_url);
              return (
                <Pressable key={v.id} style={s.videoCard} onPress={() => router.push(`/video/${v.id}`)} testID={`video-${v.id}`}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={s.videoImg} contentFit="cover" />
                  ) : (
                    <View style={[s.videoImg, s.videoImgPh]}>
                      <Ionicons name="videocam-outline" size={40} color="rgba(255,255,255,0.35)" />
                    </View>
                  )}
                  <View style={s.playBadge}><Ionicons name="play" size={22} color="#fff" /></View>
                  <View style={s.videoBody}>
                    <Text numberOfLines={2} style={s.videoTitle}>{v.title}</Text>
                    <Text style={s.videoCat}>{v.category}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Section>

        {/* MEDIA GRID */}
        <Section title="MEDIA GALLERY" onSeeAll={() => router.push("/media")}>
          <View style={s.mediaGrid}>
            {images.slice(0, 6).map((m: any) => (
              <Pressable key={m.id} style={s.mediaTile} onPress={() => router.push(`/media`)}>
                <Image source={{ uri: resolveUrl(m.url) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              </Pressable>
            ))}
          </View>
        </Section>

        {/* BROCHURES */}
        <Section title="BROCHURES & CERTIFICATES">
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {brochures.map((b: any) => (
              <Pressable key={b.id} style={s.docRow} onPress={() => { const u = resolveUrl(b.url); if (u) Linking.openURL(u); }} testID={`doc-${b.id}`}>
                <Ionicons name={b.media_type === "certificate" ? "ribbon-outline" : "document-outline"} size={22} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={s.docTitle}>{b.title}</Text>
                  <Text style={s.docSub}>{b.media_type.toUpperCase()}  ·  {b.category}</Text>
                </View>
                <Ionicons name="download-outline" size={20} color={colors.onSurface3} />
              </Pressable>
            ))}
          </View>
        </Section>

        {/* ABOUT */}
        <Section title="ABOUT">
          <View style={s.aboutBox}>
            <Text style={s.aboutTxt}>{company?.about}</Text>
            <View style={s.hr} />
            <Text style={s.subHead}>CERTIFICATIONS</Text>
            {(company?.certifications || []).map((c: string, i: number) => (
              <View key={i} style={s.bullet}>
                <View style={s.dot} />
                <Text style={s.bulletTxt}>{c}</Text>
              </View>
            ))}
            <View style={s.hr} />
            <Text style={s.subHead}>INDUSTRIES SERVED</Text>
            <View style={s.chipRow}>
              {(company?.industries || []).map((i: string) => (
                <View key={i} style={s.chip}><Text style={s.chipTxt}>{i}</Text></View>
              ))}
            </View>
            <View style={s.hr} />
            <Text style={s.subHead}>CONTACT</Text>
            <Text style={s.contactTxt}>{company?.contact?.address}</Text>
            <Pressable onPress={() => Linking.openURL(`tel:${company?.contact?.phone}`)}>
              <Text style={s.link}>{company?.contact?.phone}</Text>
            </Pressable>
            {(company?.contact?.emails || []).map((e: string) => (
              <Pressable key={e} onPress={() => Linking.openURL(`mailto:${e}`)}>
                <Text style={s.link}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function Section({ title, children, onSeeAll }: any) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <View style={s.sectionHead}>
        <View style={s.sectionBar} />
        <Text style={s.sectionTitle}>{title}</Text>
        {onSeeAll && (
          <Pressable onPress={onSeeAll} style={{ marginLeft: "auto" }}>
            <Text style={s.seeAll}>SEE ALL →</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  hero: { height: 320, backgroundColor: colors.inverse },
  heroInner: { flex: 1, padding: spacing.lg, justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  logoImg: { width: 48, height: 48 },
  brandName: { color: "#fff", fontWeight: "900", fontSize: fs.base, letterSpacing: 1.6 },
  heroTitle: { color: "#fff", fontSize: fs.hero, fontWeight: "900", letterSpacing: -0.5, lineHeight: 36 },
  heroMeta: { color: colors.brand, fontSize: fs.xs, letterSpacing: 1.6, fontWeight: "700", marginTop: spacing.sm },

  actions: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.borderStrong, backgroundColor: colors.surface2 },
  actionBtn: { flex: 1, paddingVertical: spacing.lg, alignItems: "center", gap: 4, borderRightWidth: 1, borderRightColor: colors.border },
  actionTxt: { fontSize: fs.xs, fontWeight: "700", letterSpacing: 1, color: colors.onSurface },

  sectionHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.md, gap: spacing.sm },
  sectionBar: { width: 4, height: 18, backgroundColor: colors.brand },
  sectionTitle: { fontSize: fs.base, fontWeight: "900", letterSpacing: 1.4, color: colors.onSurface },
  seeAll: { fontSize: fs.xs, fontWeight: "700", letterSpacing: 1, color: colors.brand },

  prodCard: { width: 200, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong },
  prodImg: { width: "100%", height: 130, backgroundColor: colors.surface3 },
  prodBody: { padding: spacing.md, gap: 4 },
  prodRef: { fontSize: fs.xs, color: colors.brand, fontWeight: "700", letterSpacing: 1.2 },
  prodName: { fontSize: fs.base, fontWeight: "700", color: colors.onSurface },
  prodCat: { fontSize: fs.xs, color: colors.muted, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "600" },

  videoCard: { width: 240, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong },
  videoImg: { width: "100%", height: 135, backgroundColor: colors.surface3 },
  videoImgPh: { backgroundColor: colors.inverse, alignItems: "center", justifyContent: "center" },
  playBadge: { position: "absolute", top: 55, left: "50%", marginLeft: -22, width: 44, height: 44, backgroundColor: "rgba(230,92,0,0.95)", alignItems: "center", justifyContent: "center" },
  videoBody: { padding: spacing.md },
  videoTitle: { fontSize: fs.base, fontWeight: "700", color: colors.onSurface },
  videoCat: { fontSize: fs.xs, color: colors.muted, marginTop: 2, letterSpacing: 0.8, textTransform: "uppercase" },

  mediaGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, gap: 2 },
  mediaTile: { width: "32.5%", aspectRatio: 1, backgroundColor: colors.surface3 },

  docRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface2, padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong },
  docTitle: { fontSize: fs.base, fontWeight: "700", color: colors.onSurface },
  docSub: { fontSize: fs.xs, color: colors.muted, marginTop: 2, letterSpacing: 0.8 },

  aboutBox: { marginHorizontal: spacing.lg, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong, padding: spacing.lg },
  aboutTxt: { fontSize: fs.base, color: colors.onSurface2, lineHeight: 22 },
  hr: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  subHead: { fontSize: fs.sm, fontWeight: "900", letterSpacing: 1.5, color: colors.onSurface, marginBottom: spacing.md },
  bullet: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  dot: { width: 6, height: 6, backgroundColor: colors.brand, marginTop: 8 },
  bulletTxt: { flex: 1, fontSize: fs.base, color: colors.onSurface2, lineHeight: 22 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: colors.borderStrong },
  chipTxt: { fontSize: fs.xs, letterSpacing: 1, fontWeight: "700", color: colors.onSurface },
  contactTxt: { fontSize: fs.base, color: colors.onSurface2, lineHeight: 22, marginBottom: spacing.sm },
  link: { fontSize: fs.base, color: colors.brand, fontWeight: "700", marginTop: 4 },

  newsCard: { padding: spacing.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface2 },
  newsTagRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  newsTag: { paddingHorizontal: 6, paddingVertical: 2 },
  newsTagTxt: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  newsHigh: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: colors.error },
  newsDate: { marginLeft: "auto", fontSize: fs.xs, color: colors.muted, letterSpacing: 0.8 },
  newsTitle: { fontSize: fs.base, fontWeight: "800", color: colors.onSurface, marginBottom: 4 },
  newsSummary: { fontSize: fs.xs, color: colors.onSurface3, lineHeight: 18 },
});
