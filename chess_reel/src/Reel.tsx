import React, {useEffect, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, Sequence} from 'remotion';
import {SCENES} from './constants';
import {loadInter} from './font';
import {PaintDefs} from './components/PaintOverlay';
import {AudioLayer} from './audio/AudioLayer';
import {Scene1Hook} from './scenes/Scene1Hook';
import {Scene2Moves} from './scenes/Scene2Moves';
import {Scene3Numbers} from './scenes/Scene3Numbers';
import {Scene4Shannon} from './scenes/Scene4Shannon';
import {Scene5Universe} from './scenes/Scene5Universe';
import {Scene6Close} from './scenes/Scene6Close';

export const Reel: React.FC = () => {
  const [handle] = useState(() => delayRender('Loading Inter ExtraBold'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadInter().then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  if (!ready) return null;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <PaintDefs />
      {/* ViralClipSlot: drop a real "Chess is boring" clip here later (give it a duration and shift the scenes). */}
      <Sequence name="ViralClipSlot" from={0} durationInFrames={1} layout="none">
        {null}
      </Sequence>
      <Sequence name="Scene1Hook" from={SCENES.s1.from} durationInFrames={SCENES.s1.dur}>
        <Scene1Hook />
      </Sequence>
      <Sequence name="Scene2Moves" from={SCENES.s2.from} durationInFrames={SCENES.s2.dur}>
        <Scene2Moves />
      </Sequence>
      <Sequence name="Scene3Numbers" from={SCENES.s3.from} durationInFrames={SCENES.s3.dur}>
        <Scene3Numbers />
      </Sequence>
      <Sequence name="Scene4Shannon" from={SCENES.s4.from} durationInFrames={SCENES.s4.dur}>
        <Scene4Shannon />
      </Sequence>
      <Sequence name="Scene5Universe" from={SCENES.s5.from} durationInFrames={SCENES.s5.dur}>
        <Scene5Universe />
      </Sequence>
      <Sequence name="Scene6Close" from={SCENES.s6.from} durationInFrames={SCENES.s6.dur}>
        <Scene6Close />
      </Sequence>
      <AudioLayer />
    </AbsoluteFill>
  );
};
