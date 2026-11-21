import { Environment, Lightformer } from '@react-three/drei';
import type { JSX } from 'react';

/** Studio three-point lighting plus offline procedural Lightformer IBL reflections (§5.2). */
export function Lights(): JSX.Element {
  return (
    <>
      <directionalLight position={[-2, 3, 4]} intensity={1.8} color="#fff5e6" />
      <directionalLight position={[3, 1, 2]} intensity={0.7} color="#cfe2ff" />
      <directionalLight position={[0, 2, -4]} intensity={1.5} color="#ffffff" />
      <Environment resolution={256}>
        <Lightformer
          form="rect"
          intensity={1.6}
          color="#fff8ef"
          position={[-3, 4, 4]}
          scale={[6, 6, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.9}
          color="#d6e6ff"
          position={[4, 2, 2]}
          scale={[5, 5, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="ring"
          intensity={1.4}
          color="#ffffff"
          position={[0, 3, -4]}
          scale={[4, 4, 1]}
          target={[0, 0, 0]}
        />
      </Environment>
    </>
  );
}
