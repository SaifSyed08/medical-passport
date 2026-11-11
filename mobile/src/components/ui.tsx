import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { hasJapanese } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { color, font, radius, space, TOUCH } from "@/lib/theme";

/** Text that switches to Noto Sans JP when it contains Japanese. Dynamic type stays on. */
export function T({ style, children, serif, weight, ...rest }: TextProps & { serif?: boolean; weight?: "500" | "700" }) {
  const str = typeof children === "string" ? children : Array.isArray(children) ? children.join("") : "";
  const ja = hasJapanese(str);
  const family = ja ? (weight === "700" ? font.jaBold : weight === "500" ? font.jaMedium : font.ja) : serif ? font.serif : font.sans;
  return (
    <Text maxFontSizeMultiplier={1.8} {...rest} style={[styles.text, family ? { fontFamily: family } : null, !ja && weight ? { fontWeight: weight } : null, style]}>
      {children}
    </Text>
  );
}

export function Heading({ children, size = 30 }: { children: ReactNode; size?: number }) {
  return (
    <T serif accessibilityRole="header" style={{ fontSize: size, lineHeight: size * 1.15, letterSpacing: -0.5, color: color.ink }}>
      {children}
    </T>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <T style={styles.eyebrow}>{children}</T>;
}

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  stale = false,
  scroll = true,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  stale?: boolean;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useSession();
  const pad = { paddingTop: insets.top + space.m, paddingHorizontal: space.xl, paddingBottom: space.xxl };
  const content = (
    <>
      <DemoBanner />
      {stale && <Notice tone="warn">{t.offline}</Notice>}
      {children}
    </>
  );
  if (!scroll) return <View style={[styles.screen, pad]}>{content}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[pad, { gap: space.l }]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {content}
    </ScrollView>
  );
}

export function DemoBanner() {
  const { t } = useSession();
  return (
    <View accessibilityRole="text" style={styles.demo}>
      <T style={styles.demoText}>{t.demoBanner}</T>
    </View>
  );
}

/** The Tessera wordmark. Long-press opens presenter tools. */
export function Logo({ presenter = true }: { presenter?: boolean }) {
  const { me } = useSession();
  return (
    <Pressable
      onLongPress={presenter && me?.presenterEnabled ? () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/presenter"); } : undefined}
      delayLongPress={600}
      accessibilityRole="image"
      accessibilityLabel="Tessera"
      style={styles.logo}
    >
      <View style={styles.brandIcon}><T style={{ color: "white", fontSize: 18, fontWeight: "700", lineHeight: 20 }}>+</T></View>
      <T weight="500" style={{ fontSize: 17, letterSpacing: -0.5, color: color.ink }}>Tessera</T>
    </Pressable>
  );
}

type ButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  busy?: boolean;
  label?: string;
  hint?: string;
  haptic?: boolean;
  style?: ViewStyle;
};
export function Button({ children, onPress, secondary, danger, disabled, busy, label, hint, haptic, style }: ButtonProps) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? (typeof children === "string" ? children : undefined)}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={() => {
        if (haptic) void Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondary : styles.primary,
        danger && (secondary ? { borderColor: color.errorLine } : { backgroundColor: color.errorText }),
        pressed && !off && (secondary ? { backgroundColor: "#eef3f7" } : { backgroundColor: danger ? "#8f3f34" : color.blueDark }),
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={secondary ? color.blue : "white"} /> : null}
      {typeof children === "string" ? (
        <T weight="500" style={{ fontSize: 16, color: secondary ? (danger ? color.errorText : "#30445e") : "white", textAlign: "center" }}>{children}</T>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function Section({ title, children, tone, action }: { title?: string; children: ReactNode; tone?: "allergy"; action?: ReactNode }) {
  return (
    <View style={[styles.section, tone === "allergy" && { backgroundColor: color.allergyBg, borderColor: color.allergyLine }]}>
      {(title || action) && (
        <View style={styles.sectionHead}>
          {title ? (
            <T serif accessibilityRole="header" style={{ fontSize: 22, color: tone === "allergy" ? color.allergyTitle : color.sectionTitle, flexShrink: 1 }}>
              {title}
            </T>
          ) : <View />}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

export function Row({ title, detail, right, onPress, label, last }: { title: string; detail?: string; right?: ReactNode; onPress?: () => void; label?: string; last?: boolean }) {
  const inner = (
    <>
      <View style={{ flex: 1, gap: 3 }}>
        <T style={{ fontSize: 15.5, color: color.ink, lineHeight: 21 }}>{title}</T>
        {detail ? <T style={{ fontSize: 13.5, color: color.body, lineHeight: 19 }}>{detail}</T> : null}
      </View>
      {right}
    </>
  );
  const style = [styles.row, !last && styles.rowLine];
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? `${title}${detail ? `, ${detail}` : ""}`} onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}>
      {inner}
      <T style={{ color: color.subtle, fontSize: 20 }}>›</T>
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={label} style={style}>{inner}</View>
  );
}

export function Pill({ children, tone = "ok" }: { children: string; tone?: "ok" | "warn" | "muted" | "error" }) {
  const c = {
    ok: [color.okBg, color.okText],
    warn: [color.warnBg, color.warnText],
    muted: [color.notice, color.noticeText],
    error: [color.errorBg, color.errorText],
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c[0] }]}>
      <T style={{ color: c[1], fontSize: 12, fontWeight: "500" }}>{children}</T>
    </View>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "error" | "ok" }) {
  const c = {
    info: [color.notice, color.noticeText, "transparent"],
    warn: [color.warnBg, color.warnText, "transparent"],
    error: [color.errorBg, color.errorText, color.errorLine],
    ok: [color.okBg, color.okText, "transparent"],
  }[tone];
  return (
    <View accessibilityRole={tone === "error" ? "alert" : "text"} style={[styles.notice, { backgroundColor: c[0], borderColor: c[2] }]}>
      <T style={{ color: c[1], fontSize: 13.5, lineHeight: 19 }}>{children}</T>
    </View>
  );
}

export function Field({ label, hint, error, ...input }: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={{ gap: 7 }}>
      <T weight="500" style={{ fontSize: 14, color: "#5b6c7b" }}>{label}</T>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={color.subtle}
        maxFontSizeMultiplier={1.6}
        {...input}
        style={[styles.input, input.multiline && { minHeight: 90, textAlignVertical: "top" }, !!error && { borderColor: color.errorText }]}
      />
      {error ? <T style={{ fontSize: 12.5, color: color.errorText }}>{error}</T> : hint ? <T style={{ fontSize: 12.5, color: color.subtle }}>{hint}</T> : null}
    </View>
  );
}

/** Two-option segmented control (e.g. Emergency / Restricted, 日本語 / English). */
export function Segmented<V extends string>({ value, options, onChange, label }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; label: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.segmented}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${label}: ${o.label}`}
            onPress={() => {
              if (!on) {
                void Haptics.selectionAsync();
                onChange(o.value);
              }
            }}
            style={[styles.segment, on && styles.segmentOn]}
          >
            <T weight="500" style={{ fontSize: 13.5, color: on ? "white" : "#30445e" }}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Wrapping single-choice chips, for option sets too long for a segmented control (e.g. 6 languages). */
export function Chips<V extends string>({ value, options, onChange, label }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; label: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${label}: ${o.label}`}
            onPress={() => {
              if (!on) {
                void Haptics.selectionAsync();
                onChange(o.value);
              }
            }}
            style={[styles.chip, on && styles.segmentOn]}
          >
            <T weight="500" style={{ fontSize: 14, color: on ? "white" : "#30445e" }}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Loading() {
  const { t } = useSession();
  return (
    <View style={{ padding: space.xxl, alignItems: "center", gap: space.m }} accessibilityLabel={t.loading}>
      <ActivityIndicator color={color.blue} />
    </View>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useSession();
  return (
    <View style={{ gap: space.m }}>
      <Notice tone="error">{t.errorGeneric}</Notice>
      <Button secondary onPress={onRetry}>{t.retry}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  text: { color: color.ink, fontSize: 15 },
  eyebrow: { fontSize: 11.5, letterSpacing: 1.8, color: "#7d8c99", textTransform: "uppercase" },
  demo: { alignSelf: "flex-start", backgroundColor: color.notice, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  demoText: { fontSize: 11.5, color: color.noticeText },
  logo: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: TOUCH, alignSelf: "flex-start" },
  brandIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: color.ink, alignItems: "center", justifyContent: "center" },
  button: { minHeight: 52, borderRadius: radius.button, paddingHorizontal: 22, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1 },
  primary: { backgroundColor: color.blue, borderColor: "transparent" },
  secondary: { backgroundColor: "transparent", borderColor: "#cdd5dd" },
  section: { backgroundColor: color.surface, borderColor: "#e0e5e7", borderWidth: 1, borderRadius: radius.section, padding: 20, gap: 4 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.m, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: TOUCH, paddingVertical: 10 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: "#edf0f2" },
  pill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4, alignSelf: "flex-start" },
  notice: { borderRadius: radius.button, paddingHorizontal: 15, paddingVertical: 13, borderWidth: 1 },
  input: { minHeight: TOUCH, borderWidth: 1, borderColor: color.fieldLine, borderRadius: radius.field, backgroundColor: "white", paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: color.ink },
  segmented: { flexDirection: "row", borderRadius: radius.button, borderWidth: 1, borderColor: "#cdd5dd", overflow: "hidden" },
  segment: { flex: 1, minHeight: TOUCH - 4, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  segmentOn: { backgroundColor: color.blue, borderColor: color.blue },
  chip: { minHeight: TOUCH - 4, minWidth: 64, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: "#cdd5dd", backgroundColor: "white", alignItems: "center", justifyContent: "center" },
});
