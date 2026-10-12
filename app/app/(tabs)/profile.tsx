import React from 'react';
import { ProfileView } from '../../src/features/ProfileView';
import { useUid } from '../../src/lib/auth';

export default function MyProfile() {
  const uid = useUid();
  return <ProfileView userId={uid} isTab />;
}
