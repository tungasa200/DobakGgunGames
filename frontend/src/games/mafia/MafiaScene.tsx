import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import PlayerSeat from './components/PlayerSeat';
import type { GameState } from './types';

// ===== Table =====
function RoundTable() {
  return (
    <group>
      {/* Table surface */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <cylinderGeometry args={[3.2, 3.2, 0.12, 64]} />
        <meshStandardMaterial
          color="#0a0d18"
          roughness={0.4}
          metalness={0.6}
          emissive="#050710"
        />
      </mesh>

      {/* Glowing edge ring */}
      <mesh position={[0, 0.02, 0]}>
        <torusGeometry args={[3.2, 0.04, 8, 128]} />
        <meshStandardMaterial
          color="#4fc3f7"
          emissive="#4fc3f7"
          emissiveIntensity={2.5}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Inner decorative ring */}
      <mesh position={[0, 0.03, 0]}>
        <torusGeometry args={[2.0, 0.02, 8, 128]} />
        <meshStandardMaterial
          color="#7c4dff"
          emissive="#7c4dff"
          emissiveIntensity={1.5}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Table leg / base */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.4, 0.6, 0.8, 32]} />
        <meshStandardMaterial color="#080810" roughness={0.8} metalness={0.3} />
      </mesh>
    </group>
  );
}

// ===== Floor =====
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.95, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial
        color="#03030a"
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  );
}

// ===== Dynamic Scene Lighting =====
interface SceneLightsProps {
  isNight: boolean;
}

function SceneLights({ isNight }: SceneLightsProps) {
  const pointRef = useRef<THREE.PointLight>(null);
  const spot1Ref = useRef<THREE.SpotLight>(null);

  useEffect(() => {
    if (!pointRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(pointRef.current!, {
        intensity: isNight ? 0.6 : 1.8,
        duration: 1.5,
        ease: 'power2.inOut',
      });
    });
    return () => ctx.revert();
  }, [isNight]);

  useFrame((_, delta) => {
    if (spot1Ref.current) {
      spot1Ref.current.position.x = Math.sin(Date.now() * 0.0003) * 0.5;
    }
    void delta;
  });

  return (
    <>
      <ambientLight intensity={isNight ? 0.04 : 0.08} color="#101030" />
      <pointLight
        ref={pointRef}
        position={[0, 5, 0]}
        color={isNight ? '#2a3a6a' : '#4fc3f7'}
        intensity={1.8}
        distance={20}
        castShadow
        shadow-mapSize={[512, 512]}
      />
      <spotLight
        ref={spot1Ref}
        position={[4, 7, 2]}
        target-position={[0, 0, 0]}
        color={isNight ? '#1a1060' : '#5090c0'}
        intensity={isNight ? 0.5 : 1.2}
        angle={0.5}
        penumbra={0.8}
        distance={18}
      />
      <spotLight
        position={[-4, 6, -3]}
        target-position={[0, 0, 0]}
        color={isNight ? '#300020' : '#4060a0'}
        intensity={isNight ? 0.3 : 0.8}
        angle={0.6}
        penumbra={0.9}
        distance={18}
      />
      {/* Red accent light — always subtle */}
      <pointLight
        position={[0, 2, -3]}
        color="#e94560"
        intensity={0.3}
        distance={8}
      />
    </>
  );
}

// ===== Camera Controller =====
interface CameraControllerProps {
  voteTarget: string | null;
  players: GameState['players'];
  phase: GameState['phase'];
}

function CameraController({ voteTarget, players, phase }: CameraControllerProps) {
  const { camera } = useThree();
  const defaultPos = useRef(new THREE.Vector3(0, 6.5, 11));
  const defaultLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const animRef = useRef(false);

  useEffect(() => {
    if (!voteTarget || phase !== 'vote') {
      // Return to default
      const ctx = gsap.context(() => {
        gsap.to(camera.position, {
          x: defaultPos.current.x,
          y: defaultPos.current.y,
          z: defaultPos.current.z,
          duration: 1.2,
          ease: 'power2.inOut',
          onUpdate: () => camera.lookAt(defaultLookAt.current),
        });
      });
      return () => ctx.revert();
    }

    const target = players.find(p => p.id === voteTarget);
    if (!target) return;

    const angle = (target.seat / 8) * Math.PI * 2;
    const r = 4.5;
    const tx = Math.sin(angle) * r;
    const tz = Math.cos(angle) * r;

    const ctx = gsap.context(() => {
      animRef.current = true;
      gsap.to(camera.position, {
        x: tx * 0.5,
        y: 4.5,
        z: tz * 0.5 + 6,
        duration: 1,
        ease: 'power2.inOut',
        onUpdate: () => camera.lookAt(tx, 0.5, tz),
        onComplete: () => { animRef.current = false; },
      });
    });
    return () => ctx.revert();
  }, [voteTarget, phase, players, camera]);

  useFrame(() => {
    if (!animRef.current && !voteTarget) {
      camera.lookAt(defaultLookAt.current);
    }
  });

  return null;
}

// ===== Main Scene Content =====
interface SceneContentProps {
  state: GameState;
  onSelectPlayer: (id: string) => void;
}

function SceneContent({ state, onSelectPlayer }: SceneContentProps) {
  const { players, phase } = state;
  const isNight = phase === 'night';

  const myPlayer = players.find(p => p.isMe);
  const myVoteTarget = myPlayer?.voteTarget ?? null;

  // Compute seat positions in circle around table
  const seatRadius = 4.0;
  const seatPositions: [number, number, number][] = players.map(player => {
    const angle = (player.seat / 8) * Math.PI * 2 - Math.PI / 2;
    return [
      Math.cos(angle) * seatRadius,
      0.65,
      Math.sin(angle) * seatRadius,
    ];
  });

  return (
    <>
      <fog attach="fog" args={['#050508', 12, 30]} />
      <SceneLights isNight={isNight} />
      <RoundTable />
      <Floor />

      {players.map((player, i) => (
        <PlayerSeat
          key={player.id}
          player={player}
          position={seatPositions[i]}
          phase={phase}
          isVoteTarget={myVoteTarget === player.id}
          onSelect={onSelectPlayer}
        />
      ))}

      <CameraController
        voteTarget={myVoteTarget}
        players={players}
        phase={phase}
      />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          intensity={isNight ? 1.4 : 0.8}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.9} />
      </EffectComposer>
    </>
  );
}

// ===== Canvas Wrapper =====
interface MafiaSceneProps {
  state: GameState;
  onSelectPlayer: (id: string) => void;
}

export default function MafiaScene({ state, onSelectPlayer }: MafiaSceneProps) {
  return (
    <Canvas
      camera={{ fov: 60, position: [0, 6.5, 11], near: 0.1, far: 100 }}
      shadows
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#050508' }}
    >
      <SceneContent state={state} onSelectPlayer={onSelectPlayer} />
    </Canvas>
  );
}
