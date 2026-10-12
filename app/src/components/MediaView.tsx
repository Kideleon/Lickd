import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTheme } from '../theme';
import { Bucket, useMediaUrl } from '../lib/media';

function VideoBox({ uri, style, autoplay, loop }: { uri: string; style?: StyleProp<ViewStyle>; autoplay?: boolean; loop?: boolean }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = !!loop; if (autoplay) p.play(); });
  return <VideoView player={player} style={[{ width: '100%', height: '100%' }, style]} nativeControls contentFit="contain" />;
}

/** Renders a stored media path (image or video), resolving signed URLs for private media. */
export function MediaView({ path, type = 'image', bucket = 'media', style, fit = 'cover', autoplay, loop, label }: {
  path: string | null | undefined; type?: string; bucket?: Bucket; style?: StyleProp<ViewStyle>;
  fit?: 'cover' | 'contain'; autoplay?: boolean; loop?: boolean; label?: string;
}) {
  const { c } = useTheme();
  const uri = useMediaUrl(path, bucket);
  const box: ViewStyle = { backgroundColor: c.surface2, overflow: 'hidden' };
  if (!uri) return <View style={[box, style]} />;
  if (type === 'video') {
    return <View style={[box, style]}><VideoBox uri={uri} autoplay={autoplay} loop={loop} /></View>;
  }
  return (
    <View style={[box, style]}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit={fit} transition={200}
        accessibilityLabel={label ?? 'Photo'} recyclingKey={path ?? undefined} />
    </View>
  );
}
