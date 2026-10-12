import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Header, Screen, Text } from '../../src/components/ui';
import { DOCS } from '../../src/lib/legal';

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = DOCS[doc ?? 'guidelines'] ?? DOCS.guidelines;
  return (
    <Screen scroll>
      <Header title={d.title} />
      {d.draft ? <Text variant="small" tone="danger" style={{ marginBottom: 12 }}>Draft text. Have a lawyer review and replace this before launch.</Text> : null}
      {d.sections.map((s) => (
        <React.Fragment key={s.h}>
          <Text variant="h2" style={{ marginTop: 18, marginBottom: 6 }}>{s.h}</Text>
          <Text tone="muted">{s.p}</Text>
        </React.Fragment>
      ))}
    </Screen>
  );
}
