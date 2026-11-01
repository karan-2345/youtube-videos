import React from 'react';
import {Composition} from 'remotion';
import {DURATION, FPS, H, W} from './constants';
import {Reel} from './Reel';

export const RemotionRoot: React.FC = () => (
  <Composition id="Reel" component={Reel} durationInFrames={DURATION} fps={FPS} width={W} height={H} />
);
