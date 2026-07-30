import { StyleSheet } from "react-native";

// Navy Blue palette matched to Thermal Casting LLP logo
export const colors = {
  surface: "#F5F6F8",
  onSurface: "#0F1F3A",
  surface2: "#FFFFFF",
  onSurface2: "#1E3A5F",
  surface3: "#E5E9F0",
  onSurface3: "#334966",
  inverse: "#1E3A5F",     // navy — primary corporate color (like logo)
  onInverse: "#F3F5F8",
  brand: "#1E3A5F",        // navy primary
  brandDark: "#12253D",
  brandLight: "#DDE5F0",
  brandAccent: "#C9A227",  // subtle gold accent for CTAs
  onBrand: "#FFFFFF",
  success: "#059669",
  warning: "#D97706",
  error: "#DC2626",
  border: "#D1D8E0",
  borderStrong: "#1E3A5F",
  muted: "#5A6B80",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const typography = {
  display: "System",
  mono: "System",
};

export const fs = {
  xs: 11,
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  hero: 32,
};

export const globalStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  divider: { height: 1, backgroundColor: colors.borderStrong },
  sectionLabel: {
    fontSize: fs.sm,
    letterSpacing: 1.4,
    fontWeight: "700",
    color: colors.onSurface,
    textTransform: "uppercase",
  },
  monoLabel: {
    fontSize: fs.xs,
    letterSpacing: 1.2,
    color: colors.muted,
    textTransform: "uppercase",
    fontWeight: "600",
  },
});
