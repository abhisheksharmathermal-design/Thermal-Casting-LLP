import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { uploadFile, resolveUrl } from "@/src/api";
import { colors, fs, spacing } from "@/src/theme";
import { MediaPicker, type MediaItem } from "@/src/media-picker";

type Kind = "image" | "video" | "brochure" | "certificate" | "pdf" | "datasheet" | "drawing";

type Props = {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  kind?: Kind;
  testID?: string;
  /** If true, uploaded assets are also indexed into the Media Library (recommended for reuse). */
  saveToLibrary?: boolean;
};

const IMAGE_LIKE: Kind[] = ["image"];
const VIDEO_LIKE: Kind[] = ["video"];

export function UploadField({ label, value, onChange, kind = "image", testID, saveToLibrary = true }: Props) {
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const preview = resolveUrl(value);

  const isImage = IMAGE_LIKE.includes(kind);
  const isVideo = VIDEO_LIKE.includes(kind);
  const isDoc = !isImage && !isVideo;

  const askPermissions = async () => {
    const lib = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!lib.granted && lib.canAskAgain) await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (isImage) {
      const cam = await ImagePicker.getCameraPermissionsAsync();
      if (!cam.granted && cam.canAskAgain) await ImagePicker.requestCameraPermissionsAsync();
    }
  };

  const doUpload = async (uri: string, filename?: string, mime?: string) => {
    setBusy(true); setPct(0);
    try {
      const defExt = isImage ? "jpg" : isVideo ? "mp4" : "pdf";
      const name = filename || `upload-${Date.now()}.${defExt}`;
      const type = mime || (isImage
        ? (name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg")
        : isVideo ? "video/mp4" : "application/pdf");
      const r = await uploadFile(uri, name, type, kind, {
        saveToLibrary,
        title: name,
        onProgress: setPct,
      });
      onChange(r.url);
    } catch (e: any) {
      Alert.alert("Upload failed", e.message || "Please try again.");
    }
    setBusy(false); setPct(0);
  };

  const pickFromGallery = async () => {
    await askPermissions();
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: isVideo ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!r.canceled && r.assets?.[0]) {
      const a = r.assets[0];
      await doUpload(a.uri, a.fileName || undefined, a.mimeType || undefined);
    }
  };

  const takePhoto = async () => {
    await askPermissions();
    const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!r.canceled && r.assets?.[0]) {
      const a = r.assets[0];
      await doUpload(a.uri, a.fileName || undefined, a.mimeType || undefined);
    }
  };

  const pickDoc = async () => {
    const r = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    await doUpload(a.uri, a.name, a.mimeType || "application/pdf");
  };

  const onPickFromLibrary = (item: MediaItem) => {
    onChange(item.url);
  };

  return (
    <View style={{ marginBottom: spacing.md }} testID={testID}>
      <Text style={s.lbl}>{label}</Text>
      <View style={s.box}>
        {preview ? (
          <View style={s.previewWrap}>
            {isImage ? (
              <Image source={{ uri: preview }} style={s.preview} contentFit="cover" />
            ) : isVideo ? (
              <View style={[s.preview, s.previewVideo]}>
                <Ionicons name="videocam" size={36} color="#fff" />
                <Text style={s.previewMeta} numberOfLines={1}>{preview.split("/").pop()}</Text>
              </View>
            ) : (
              <View style={[s.preview, s.previewDoc]}>
                <Ionicons name="document-text" size={36} color={colors.brand} />
                <Text style={s.previewDocTxt} numberOfLines={1}>{preview.split("/").pop()}</Text>
              </View>
            )}
            <Pressable onPress={() => onChange("")} style={s.removeBtn} testID={`${testID}-remove`}>
              <Ionicons name="close" size={16} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={s.placeholder}>
            <Ionicons name={isVideo ? "videocam-outline" : isDoc ? "document-outline" : "image-outline"} size={32} color={colors.muted} />
            <Text style={s.placeholderTxt}>NO {isVideo ? "VIDEO" : isDoc ? "FILE" : "IMAGE"}</Text>
          </View>
        )}

        <View style={s.actionsRow}>
          <Pressable style={s.actBtn} onPress={() => setPickerVisible(true)} disabled={busy} testID={`${testID}-library`}>
            <Ionicons name="albums-outline" size={16} color={colors.brand} />
            <Text style={s.actTxt}>LIBRARY</Text>
          </Pressable>
          {isDoc ? (
            <Pressable style={s.actBtn} onPress={pickDoc} disabled={busy} testID={`${testID}-file`}>
              <Ionicons name="cloud-upload-outline" size={16} color={colors.brand} />
              <Text style={s.actTxt}>UPLOAD</Text>
            </Pressable>
          ) : (
            <Pressable style={s.actBtn} onPress={pickFromGallery} disabled={busy} testID={`${testID}-gallery`}>
              <Ionicons name="images-outline" size={16} color={colors.brand} />
              <Text style={s.actTxt}>{isVideo ? "GALLERY" : "GALLERY"}</Text>
            </Pressable>
          )}
          {isImage && (
            <Pressable style={s.actBtn} onPress={takePhoto} disabled={busy} testID={`${testID}-camera`}>
              <Ionicons name="camera-outline" size={16} color={colors.brand} />
              <Text style={s.actTxt}>CAMERA</Text>
            </Pressable>
          )}
        </View>

        {busy && (
          <View style={s.overlay}>
            <ActivityIndicator color="#fff" />
            <Text style={s.overlayTxt}>UPLOADING… {pct}%</Text>
            <View style={s.barTrack}><View style={[s.barFill, { width: `${Math.max(pct, 3)}%` }]} /></View>
          </View>
        )}
      </View>

      <MediaPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onPick={onPickFromLibrary}
        kind={kind === "drawing" ? "any" : (kind as any)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  lbl: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "800", color: colors.onSurface3, marginBottom: 4 },
  box: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, position: "relative" },
  previewWrap: { width: "100%", aspectRatio: 16 / 10, backgroundColor: colors.surface3 },
  preview: { width: "100%", height: "100%" },
  previewVideo: { backgroundColor: colors.inverse, alignItems: "center", justifyContent: "center", gap: 4 },
  previewMeta: { color: "#fff", fontSize: fs.xs, letterSpacing: 0.5, paddingHorizontal: 8 },
  previewDoc: { alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brandLight },
  previewDocTxt: { color: colors.brand, fontSize: fs.xs, letterSpacing: 0.5, paddingHorizontal: 8, fontWeight: "700" },
  removeBtn: { position: "absolute", top: 8, right: 8, width: 28, height: 28, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  placeholder: { width: "100%", aspectRatio: 16 / 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface3, gap: 6 },
  placeholderTxt: { fontSize: fs.xs, letterSpacing: 1.2, fontWeight: "700", color: colors.muted },
  actionsRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.md, borderRightWidth: 1, borderRightColor: colors.border },
  actTxt: { fontSize: fs.xs, fontWeight: "900", letterSpacing: 1.2, color: colors.brand },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", gap: 8, padding: spacing.md },
  overlayTxt: { color: "#fff", fontSize: fs.xs, letterSpacing: 1.4, fontWeight: "800" },
  barTrack: { width: "80%", height: 6, backgroundColor: "rgba(255,255,255,0.2)" },
  barFill: { height: "100%", backgroundColor: "#fff" },
});
