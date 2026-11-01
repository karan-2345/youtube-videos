import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import {AVAILABLE} from './available';
import {SLOTS} from './slots';

const warned = new Set<string>();
/** Renders an <Audio> for every slot whose file exists in public/audio; otherwise nothing (with a warning). */
export const AudioLayer: React.FC = () => {
  // If per-scene voiceovers exist, they replace the single full-length track.
  const perScene = SLOTS.some((s) => s.id.startsWith('voiceover-') && AVAILABLE.includes(s.file));
  return (
    <>
      {SLOTS.map((s) => {
        if (!AVAILABLE.includes(s.file) || (perScene && s.id === 'voiceover')) {
          if (!warned.has(s.file) && !AVAILABLE.includes(s.file)) {
            warned.add(s.file);
            console.warn(`[audio] public/audio/${s.file} not found; slot "${s.id}" is silent`);
          }
          return null;
        }
        return (
          <Sequence key={s.id} from={s.startFrame} durationInFrames={s.durationInFrames} name={`audio:${s.id}`}>
            <Audio src={staticFile(`audio/${s.file}`)} volume={s.volume ?? (s.type === 'voiceover' ? 1 : 0.6)} />
          </Sequence>
        );
      })}
    </>
  );
};
