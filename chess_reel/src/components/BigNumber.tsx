import React from 'react';
import {C} from '../constants';
import {FONT_STACK, measure1} from '../font';

export const EXP_RATIO = 0.55;
const GAP = 0.04;
const MARGIN = 0.97;

// Font size that fits `value` (plus optional exponent) in maxWidth, capped at maxFontSize.
export const fitFont = (value: string, maxWidth: number, maxFontSize = 2000, exponent?: string) => {
  const w1 = measure1(value) + (exponent ? GAP + EXP_RATIO * measure1(exponent) : 0);
  return Math.min(maxFontSize, (maxWidth * MARGIN) / w1);
};

// Horizontal offset (px, from the composition centre) of the base's centre when an exponent is present.
export const baseCenterOffset = (value: string, exponent: string, font: number) => {
  const wb = measure1(value) * font;
  const total = wb + (GAP + EXP_RATIO * measure1(exponent)) * font;
  return -total / 2 + wb / 2;
};

export const glowShadow = (k = 1) =>
  `0 0 ${40 * k}px rgba(255,217,138,${Math.min(0.9, 0.35 * k)}), 0 0 ${120 * k}px rgba(179,16,28,${Math.min(0.9, 0.5 * k)})`;

type Props = {
  value: string;
  maxWidth?: number;
  maxFontSize?: number;
  fontSize?: number; // force a size
  scaleX?: number;
  scaleY?: number;
  scale?: number;
  blur?: number;
  opacity?: number;
  exponent?: string;
  exponentScale?: number; // 0-1 spring-in of the exponent
  suffix?: string;
  color?: string;
  glow?: number;
  origin?: string;
  style?: React.CSSProperties;
};

/** All numbers in the reel go through this component. It is centred on its parent's (x,y) anchor. */
export const BigNumber: React.FC<Props> = ({
  value,
  maxWidth = 960,
  maxFontSize = 2000,
  fontSize,
  scaleX = 1,
  scaleY = 1,
  scale = 1,
  blur = 0,
  opacity = 1,
  exponent,
  exponentScale = 1,
  suffix,
  color = C.white,
  glow = 1,
  origin = 'center center',
  style,
}) => {
  const F = fontSize ?? fitFont(value, maxWidth, maxFontSize, exponent);
  const sufF = suffix ? Math.min(F * 0.5, fitFont(suffix, maxWidth, 2000)) : 0;
  const text: React.CSSProperties = {
    fontFamily: FONT_STACK,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 0.95,
    color,
    fontVariantNumeric: 'tabular-nums',
    textShadow: glowShadow(glow),
    whiteSpace: 'nowrap',
  };
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate(-50%, -50%) scale(${scale * scaleX}, ${scale * scaleY})`,
        transformOrigin: origin,
        opacity,
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        ...style,
      }}
    >
      <div style={{display: 'flex', alignItems: 'flex-start'}}>
        <span style={{...text, fontSize: F}}>{value}</span>
        {exponent ? (
          <span
            style={{
              ...text,
              fontSize: F * EXP_RATIO,
              marginLeft: F * GAP,
              // baseline of the exponent sits near the top of the base digits
              marginTop: -F * 0.2,
              display: 'inline-block',
              transform: `scale(${exponentScale})`,
              transformOrigin: 'left bottom',
              opacity: Math.min(1, exponentScale * 1.5),
            }}
          >
            {exponent}
          </span>
        ) : null}
      </div>
      {suffix ? <span style={{...text, fontSize: sufF, marginTop: F * 0.04}}>{suffix}</span> : null}
    </div>
  );
};

/** Absolutely positions children so that (x, y) is their anchor point. */
export const At: React.FC<{x: number; y: number; children: React.ReactNode; style?: React.CSSProperties}> = ({x, y, children, style}) => (
  <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0, ...style}}>{children}</div>
);
