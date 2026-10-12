import React, { useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleProp, Switch, Text as RNText, TextInput, TextInputProps,
  TextStyle, View, ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, radius, space, useTheme } from '../theme';
import { avatarUrl } from '../lib/media';

// ───────────── Text ─────────────
type Variant = 'display' | 'title' | 'h2' | 'body' | 'small' | 'caption';
type Tone = 'default' | 'muted' | 'primary' | 'danger' | 'success' | 'teal' | 'onPrimary';

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.heavy, fontSize: 38, lineHeight: 40, letterSpacing: -1 },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 16 },
};

export function Text({ variant = 'body', tone = 'default', bold, style, ...rest }: React.ComponentProps<typeof RNText> & {
  variant?: Variant; tone?: Tone; bold?: boolean;
}) {
  const { c } = useTheme();
  const color = tone === 'muted' ? c.muted : tone === 'primary' ? c.primary : tone === 'danger' ? c.danger
    : tone === 'success' ? c.success : tone === 'teal' ? c.teal : tone === 'onPrimary' ? c.onPrimary : c.text;
  return <RNText {...rest} style={[VARIANTS[variant], { color }, bold && { fontFamily: fonts.bold }, style]} />;
}

// ───────────── Sticker: hard offset shadow that works on iOS and Android ─────────────
export function Sticker({ children, style, r = radius.lg, offset = 3, fill, border, shadow, borderWidth }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; r?: number; offset?: number;
  fill?: string; border?: string; shadow?: string; borderWidth?: number;
}) {
  const { c, isDark } = useTheme();
  return (
    <View style={[{ marginRight: offset, marginBottom: offset }, style]}>
      <View style={{
        position: 'absolute', top: offset, left: offset, right: -offset, bottom: -offset,
        backgroundColor: shadow ?? c.shadow, borderRadius: r,
      }} />
      <View style={{
        backgroundColor: fill ?? c.surface, borderRadius: r, overflow: 'hidden',
        borderWidth: borderWidth ?? (isDark ? 1.5 : 2), borderColor: border ?? (isDark ? c.line : c.edge),
      }}>{children}</View>
    </View>
  );
}

export function Card({ children, style, pad = true, onPress }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: boolean; onPress?: () => void;
}) {
  const inner = <View style={pad ? { padding: space.lg } : undefined}>{children}</View>;
  if (!onPress) return <Sticker style={style}>{inner}</Sticker>;
  return <Pressable onPress={onPress} accessibilityRole="button" style={style}><Sticker>{inner}</Sticker></Pressable>;
}

// ───────────── Buttons ─────────────
export function Button({ title, onPress, variant = 'primary', loading, disabled, small, icon, style, full = true }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean; disabled?: boolean; small?: boolean; icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>; full?: boolean;
}) {
  const { c, isDark } = useTheme();
  const [down, setDown] = useState(false);
  const off = down ? 0 : small ? 2 : 3;
  const fill = variant === 'primary' ? c.primary : variant === 'danger' ? c.danger : variant === 'secondary' ? c.surface : 'transparent';
  const fg = variant === 'primary' ? c.onPrimary : variant === 'danger' ? '#FFFFFF' : variant === 'ghost' ? c.primary : c.text;
  const isDisabled = disabled || loading;
  const body = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: small ? 8 : 14, paddingHorizontal: small ? 14 : 20,
    }}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 20} color={fg} /> : null}
          <Text variant={small ? 'small' : 'h2'} style={{ color: fg, fontFamily: fonts.bold, fontSize: small ? 14 : 16 }}>{title}</Text>
        </>
      )}
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!isDisabled }}
      disabled={isDisabled} onPress={onPress}
      onPressIn={() => setDown(true)} onPressOut={() => setDown(false)}
      style={[{ opacity: isDisabled ? 0.5 : 1, alignSelf: full ? 'stretch' : 'flex-start' }, style]}
    >
      {variant === 'ghost' ? body : (
        <View style={{ transform: [{ translateX: down ? 3 : 0 }, { translateY: down ? 3 : 0 }] }}>
          <Sticker r={radius.md} offset={off || 0.01} fill={fill} border={isDark ? '#000' : c.edge} borderWidth={2}>
            {body}
          </Sticker>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, size = 24, color, badge }: {
  name: keyof typeof Ionicons.glyphMap; onPress?: () => void; label: string; size?: number; color?: string; badge?: number;
}) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size} color={color ?? c.text} />
      {badge ? (
        <View style={{ position: 'absolute', top: 3, right: 1, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
          backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="caption" style={{ color: c.onPrimary, fontFamily: fonts.bold, fontSize: 11, lineHeight: 14 }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ───────────── Inputs ─────────────
export function Input({ label, error, hint, style, multiline, ...rest }: TextInputProps & {
  label?: string; error?: string | null; hint?: string;
}) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: space.lg }}>
      {label ? <Text variant="small" bold style={{ marginBottom: 6 }}>{label}</Text> : null}
      <TextInput
        {...rest}
        multiline={multiline}
        accessibilityLabel={label ?? rest.placeholder}
        placeholderTextColor={c.muted}
        onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
        style={[{
          fontFamily: fonts.regular, fontSize: 16, color: c.text, backgroundColor: c.surface,
          borderWidth: 2, borderColor: error ? c.danger : focus ? c.primary : c.line, borderRadius: radius.md,
          paddingHorizontal: 14, paddingVertical: multiline ? 12 : 12, minHeight: multiline ? 96 : 48,
          textAlignVertical: multiline ? 'top' : 'center',
        }, style]}
      />
      {error ? <Text variant="caption" tone="danger" style={{ marginTop: 4 }}>{error}</Text>
        : hint ? <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>{hint}</Text> : null}
    </View>
  );
}

export function ToggleRow({ title, subtitle, value, onChange }: {
  title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text variant="body" bold>{title}</Text>
        {subtitle ? <Text variant="small" tone="muted">{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={title}
        trackColor={{ false: c.line, true: c.primary }} thumbColor="#FFFFFF" />
    </View>
  );
}

// ───────────── Chips & segmented ─────────────
export function Chip({ label, selected, onPress, icon }: {
  label: string; selected?: boolean; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { c, isDark } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: radius.pill, borderWidth: 2, marginRight: 8, marginBottom: 8,
        backgroundColor: selected ? c.primary : c.surface,
        borderColor: selected ? (isDark ? '#000' : c.edge) : c.line,
      }}>
      {icon ? <Ionicons name={icon} size={15} color={selected ? c.onPrimary : c.text} /> : null}
      <Text variant="small" style={{ color: selected ? c.onPrimary : c.text, fontFamily: fonts.semibold }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string; badge?: number }[]; value: T; onChange: (k: T) => void;
}) {
  const { c, isDark } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surface2, borderRadius: radius.md, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={{ flex: 1, paddingVertical: 8, borderRadius: radius.sm + 2, alignItems: 'center', flexDirection: 'row',
              justifyContent: 'center', gap: 6, backgroundColor: on ? c.surface : 'transparent',
              borderWidth: on ? 2 : 0, borderColor: isDark ? c.line : c.edge }}>
            <Text variant="small" style={{ fontFamily: on ? fonts.bold : fonts.medium, color: on ? c.text : c.muted }}>{o.label}</Text>
            {o.badge ? (
              <View style={{ backgroundColor: c.primary, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                <Text variant="caption" style={{ color: c.onPrimary, fontSize: 11, lineHeight: 14, fontFamily: fonts.bold }}>{o.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Underlined tab strip used on profiles and groups. */
export function TabStrip<T extends string>({ tabs, value, onChange }: {
  tabs: { key: T; label: string }[]; value: T; onChange: (k: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: c.line }}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 4, marginBottom: -2,
              borderBottomColor: on ? c.primary : 'transparent' }}>
            <Text variant="small" style={{ fontFamily: on ? fonts.bold : fonts.medium, color: on ? c.text : c.muted }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ───────────── Avatar ─────────────
export function Avatar({ path, name, size = 44, ring, onPress }: {
  path?: string | null; name?: string; size?: number; ring?: string; onPress?: () => void;
}) {
  const { c, isDark } = useTheme();
  const uri = avatarUrl(path);
  const initial = (name ?? '?').trim().charAt(0).toUpperCase();
  const r = size * 0.34;
  const inner = (
    <View style={{
      width: size, height: size, borderRadius: r, overflow: 'hidden', backgroundColor: c.surface2,
      borderWidth: ring ? 3 : 2, borderColor: ring ?? (isDark ? c.line : c.edge), alignItems: 'center', justifyContent: 'center',
    }}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150}
        accessibilityLabel={name ? `${name}'s photo` : 'Profile photo'} />
        : <Text style={{ fontFamily: fonts.heavy, fontSize: size * 0.42, color: c.primary }}>{initial}</Text>}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${name ?? 'profile'}`}>{inner}</Pressable> : inner;
}

// ───────────── Layout ─────────────
export function Screen({ children, scroll, style, edges = ['top'], padded = true }: {
  children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[]; padded?: boolean;
}) {
  const { c } = useTheme();
  const pad = padded ? { paddingHorizontal: space.lg } : undefined;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[pad, { paddingBottom: space.xxl }, style]}>{children}</ScrollView>
      ) : <View style={[{ flex: 1 }, pad, style]}>{children}</View>}
    </SafeAreaView>
  );
}

export function Header({ title, back = true, right, subtitle }: {
  title?: string; back?: boolean; right?: React.ReactNode; subtitle?: string;
}) {
  const router = useRouter();
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 6, gap: 4 }}>
      {back ? <IconButton name="chevron-back" label="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
      <View style={{ flex: 1 }}>
        {title ? <Text variant="h2" numberOfLines={1} accessibilityRole="header">{title}</Text> : null}
        {subtitle ? <Text variant="caption" tone="muted" numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.md }}>
      <Text variant="h2" accessibilityRole="header">{title}</Text>
      {action ? <Pressable onPress={onAction} accessibilityRole="button"><Text variant="small" tone="primary" bold>{action}</Text></Pressable> : null}
    </View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 2, backgroundColor: c.line, opacity: 0.6 }} />;
}

export function ListRow({ icon, title, subtitle, onPress, right, danger }: {
  icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; onPress?: () => void;
  right?: React.ReactNode; danger?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" disabled={!onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
      {icon ? <Ionicons name={icon} size={22} color={danger ? c.danger : c.text} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" bold tone={danger ? 'danger' : 'default'}>{title}</Text>
        {subtitle ? <Text variant="small" tone="muted">{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={c.muted} /> : null)}
    </Pressable>
  );
}

// ───────────── States ─────────────
export function Loading({ label }: { label?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ padding: space.xxl, alignItems: 'center', gap: 10 }} accessibilityLiveRegion="polite">
      <ActivityIndicator color={c.primary} size="large" />
      {label ? <Text variant="small" tone="muted">{label}</Text> : null}
    </View>
  );
}

export function Empty({ icon = 'sparkles-outline', title, body, action, onAction }: {
  icon?: keyof typeof Ionicons.glyphMap; title: string; body?: string; action?: string; onAction?: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ padding: space.xxl, alignItems: 'center', gap: 8 }}>
      <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] }}>
        <Ionicons name={icon} size={30} color={c.primary} />
      </View>
      <Text variant="h2" style={{ textAlign: 'center', marginTop: 6 }}>{title}</Text>
      {body ? <Text variant="small" tone="muted" style={{ textAlign: 'center', maxWidth: 300 }}>{body}</Text> : null}
      {action ? <Button title={action} onPress={onAction} small full={false} style={{ marginTop: 10 }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong.';
  return <Empty icon="cloud-offline-outline" title="Couldn't load this" body={msg} action={onRetry ? 'Try again' : undefined} onAction={onRetry} />;
}

// ───────────── Bottom sheet ─────────────
export interface SheetOption { label: string; onPress: () => void; destructive?: boolean; icon?: keyof typeof Ionicons.glyphMap; }

export function OptionSheet({ visible, title, options, onClose }: {
  visible: boolean; title?: string; options: SheetOption[]; onClose: () => void;
}) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }} onPress={onClose} accessibilityLabel="Close menu">
        <Pressable onPress={() => {}} style={{
          backgroundColor: c.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: insets.bottom + 12,
          paddingTop: 10, paddingHorizontal: space.lg, borderTopWidth: 2, borderColor: isDark ? c.line : c.edge,
        }}>
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.line, marginBottom: 10 }} />
          {title ? <Text variant="h2" style={{ marginBottom: 6 }}>{title}</Text> : null}
          {options.map((o) => (
            <Pressable key={o.label} accessibilityRole="button"
              onPress={() => { onClose(); setTimeout(o.onPress, 150); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
              {o.icon ? <Ionicons name={o.icon} size={22} color={o.destructive ? c.danger : c.text} /> : null}
              <Text variant="body" bold tone={o.destructive ? 'danger' : 'default'}>{o.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={onClose} accessibilityRole="button" style={{ paddingVertical: 14, alignItems: 'center' }}>
            <Text variant="body" tone="muted" bold>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Wordmark: lowercase, heavy, with a teal dot. */
export function Wordmark({ size = 30 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }} accessibilityRole="header" accessibilityLabel="LICKD">
      <Text style={{ fontFamily: fonts.heavy, fontSize: size, lineHeight: size * 1.05, letterSpacing: -1.5, color: c.primary }}>lickd</Text>
      <View style={{ width: size * 0.2, height: size * 0.2, borderRadius: size * 0.1, backgroundColor: c.teal, marginLeft: 2, marginBottom: size * 0.16 }} />
    </View>
  );
}
