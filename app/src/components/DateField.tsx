import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { radius, useTheme } from '../theme';
import { Text } from './ui';

export function DateField({ label, value, onChange, mode = 'date', minimumDate, maximumDate, placeholder = 'Choose' }: {
  label?: string; value: Date | null; onChange: (d: Date) => void; mode?: 'date' | 'datetime';
  minimumDate?: Date; maximumDate?: Date; placeholder?: string;
}) {
  const { c, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  // Android can't pick date+time in one dialog, so it steps through date then time.
  const [androidStep, setAndroidStep] = useState<'date' | 'time'>('date');
  const [draft, setDraft] = useState<Date>(value ?? new Date());

  const text = value
    ? mode === 'datetime'
      ? value.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : value.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : placeholder;

  return (
    <View style={{ marginBottom: 16 }}>
      {label ? <Text variant="small" bold style={{ marginBottom: 6 }}>{label}</Text> : null}
      <Pressable onPress={() => { setDraft(value ?? maximumDate ?? new Date()); setAndroidStep('date'); setOpen(!open); }}
        accessibilityRole="button" accessibilityLabel={`${label ?? 'Date'}: ${text}`}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: c.line,
          borderRadius: radius.md, backgroundColor: c.surface, paddingHorizontal: 14, minHeight: 48 }}>
        <Text variant="body" tone={value ? 'default' : 'muted'}>{text}</Text>
        <Ionicons name="calendar-outline" size={20} color={c.muted} />
      </Pressable>
      {open ? (
        <DateTimePicker
          value={draft}
          mode={Platform.OS === 'android' ? androidStep : mode === 'datetime' ? 'datetime' : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          themeVariant={isDark ? 'dark' : 'light'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(e, d) => {
            if (Platform.OS === 'android') {
              if (e.type === 'dismissed' || !d) { setOpen(false); return; }
              if (mode === 'datetime' && androidStep === 'date') { setDraft(d); setAndroidStep('time'); return; }
              setOpen(false); onChange(d); return;
            }
            if (d) { setDraft(d); onChange(d); }
          }}
        />
      ) : null}
    </View>
  );
}
