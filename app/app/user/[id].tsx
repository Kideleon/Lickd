import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ProfileView } from '../../src/features/ProfileView';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProfileView userId={id!} />;
}
