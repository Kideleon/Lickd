import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { fonts } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { radius, useTheme } from '../theme';
import { Text } from './ui';

function NativeDateField({ label, value, onChange, mode = 'date', minimumDate, maximumDate, placeholder = 'Choose' }: {
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

/** Browser version: the native picker doesn't exist on web, so use the browser's own date input. */
function pad(n: number) { return String(n).padStart(2, '0'); }
function toInput(d: Date | null, mode: 'date' | 'datetime'): string {
  if (!d) return '';
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return mode === 'datetime' ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}
function WebDateField({ label, value, onChange, mode, minimumDate, maximumDate }: {
  label?: string; value: Date | null; onChange: (d: Date) => void; mode: 'date' | 'datetime'; minimumDate?: Date; maximumDate?: Date;
}) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      {label ? <Text variant="small" bold style={{ marginBottom: 6 }}>{label}</Text> : null}
      {React.createElement('input', {
        type: mode === 'datetime' ? 'datetime-local' : 'date',
        value: toInput(value, mode),
        min: minimumDate ? toInput(minimumDate, mode) : undefined,
        max: maximumDate ? toInput(maximumDate, mode) : undefined,
        'aria-label': label ?? 'Date',
        onChange: (e: { target: { value: string } }) => {
          const v = e.target.value; if (!v) return;
          const [datePart, timePart] = v.split('T');
          const [y, m, d] = datePart.split('-').map(Number);
          const [hh, mm] = (timePart ?? '12:00').split(':').map(Number);
          onChange(new Date(y, m - 1, d, hh, mm));
        },
        style: { border: `2px solid ${c.line}`, borderRadius: radius.md, background: c.surface, color: c.text, padding: '0 14px',
          minHeight: 48, fontSize: 16, fontFamily: fonts.regular, colorScheme: 'dark light', width: '100%', boxSizing: 'border-box' },
      })}
    </View>
  );
}

export function DateField(props: {
  label?: string; value: Date | null; onChange: (d: Date) => void; mode?: 'date' | 'datetime';
  minimumDate?: Date; maximumDate?: Date; placeholder?: string;
}) {
  if (Platform.OS === 'web') return <WebDateField {...props} mode={props.mode ?? 'date'} />;
  return <NativeDateField {...props} />;
}
