import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Empty, Header, Loading, Screen, Text } from '../../src/components/ui';
import { getMyReports } from '../../src/lib/api';
import { useUid } from '../../src/lib/auth';
import { REPORT_REASONS } from '../../src/lib/types';

const LABEL: Record<string, string> = { open: 'Received', reviewing: 'In review', resolved: 'Reviewed. Action taken', dismissed: 'Reviewed. No violation found' };

export default function ReportHistory() {
  const me = useUid();
  const q = useQuery({ queryKey: ['my-reports'], queryFn: () => getMyReports(me) });
  return (
    <Screen scroll>
      <Header title="Report history" />
      {q.isLoading ? <Loading /> : (q.data ?? []).length === 0 ? <Empty icon="flag-outline" title="No reports" body="Reports you send show up here with their status." /> :
        q.data!.map((r) => (
          <Card key={r.id} style={{ marginBottom: 12 }}>
            <Text variant="body" bold>{REPORT_REASONS.find((x) => x.key === r.reason)?.label ?? r.reason}</Text>
            <Text variant="small" tone="muted">{r.target_type} · {new Date(r.created_at).toLocaleDateString()}</Text>
            <Text variant="small" tone={r.status === 'resolved' ? 'success' : 'default'} bold style={{ marginTop: 6 }}>{LABEL[r.status]}</Text>
          </Card>
        ))}
    </Screen>
  );
}
