import React from 'react';
import {FONT_STACK, measure1} from '../font';

export const Label: React.FC<{text: string; opacity?: number; size?: number; color?: string; y?: number}> = ({
  text,
  opacity = 1,
  size = 44,
  color = 'rgba(255,255,255,0.92)',
}) => {
  // auto-fit long labels to the safe-zone width
  const fit = 930 / (measure1(text) + 0.14 * text.length);
  const fs = Math.min(size, fit);
  return (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      transform: 'translate(-50%, -50%)',
      fontFamily: FONT_STACK,
      fontWeight: 800,
      fontSize: fs,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color,
      opacity,
      whiteSpace: 'nowrap',
      textShadow: '0 2px 18px rgba(0,0,0,0.8)',
    }}
  >
    {text}
  </div>
  );
};
