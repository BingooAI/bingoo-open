import { MascotMessage } from '@/components/brand/mascot';
import { type MascotEmotion } from '@bingoo/core';

export function AuthHeader({
  emotion,
  bubble,
  title,
  subtitle,
}: {
  emotion: MascotEmotion;
  bubble: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-8">
      <MascotMessage emotion={emotion} size={64}>
        {bubble}
      </MascotMessage>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-foreground-muted">{subtitle}</p>
    </div>
  );
}
