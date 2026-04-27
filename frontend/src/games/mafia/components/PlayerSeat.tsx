import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Player, Phase } from '../types';

interface PlayerSeatProps {
  player: Player;
  position: [number, number, number];
  phase: Phase;
  isVoteTarget: boolean;
  onSelect: (id: string) => void;
}

export default function PlayerSeat({
  player,
  position,
  phase,
  isVoteTarget,
  onSelect,
}: PlayerSeatProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  // Initialize with seat-based offset to avoid Math.random in render (ESLint purity rule)
  const floatT = useRef(player.seat * (Math.PI * 2 / 8));

  const isClickable = (phase === 'vote') && player.alive && !player.isMe;

  useFrame((_, delta) => {
    floatT.current += delta * 0.8;
    if (!meshRef.current) return;

    // Subtle float
    meshRef.current.position.y = position[1] + Math.sin(floatT.current) * 0.06;

    // Scale pulse for vote target
    if (isVoteTarget) {
      const s = 1 + Math.sin(floatT.current * 3) * 0.05;
      meshRef.current.scale.setScalar(s);
    } else {
      meshRef.current.scale.setScalar(1);
    }

    // Glow ring rotation
    if (glowRef.current) {
      glowRef.current.rotation.z += delta * 1.2;
    }
  });

  const aliveColor = player.isMe
    ? '#ffd700'
    : isVoteTarget
    ? '#e94560'
    : '#4fc3f7';

  const deadColor = '#2a2a3a';
  const capsuleColor = player.alive ? aliveColor : deadColor;
  const emissiveColor = player.alive
    ? player.isMe ? '#ffd700' : isVoteTarget ? '#e94560' : '#0f4a6a'
    : '#0a0a14';
  const emissiveIntensity = player.alive ? (isVoteTarget ? 0.8 : player.isMe ? 0.6 : 0.25) : 0.02;

  return (
    <group position={position}>
      {/* Main avatar capsule */}
      <mesh
        ref={meshRef}
        onClick={() => { if (isClickable) onSelect(player.id); }}
        onPointerOver={e => { if (isClickable) { e.stopPropagation(); document.body.style.cursor = 'pointer'; } }}
        onPointerOut={() => { document.body.style.cursor = 'default'; }}
        castShadow
      >
        <capsuleGeometry args={[0.28, 0.55, 8, 16]} />
        <meshStandardMaterial
          color={capsuleColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.3}
          metalness={0.7}
          transparent={!player.alive}
          opacity={player.alive ? 1 : 0.35}
        />
      </mesh>

      {/* Outer glow ring for isMe */}
      {player.isMe && player.alive && (
        <mesh ref={glowRef} position={[0, 0, 0]}>
          <torusGeometry args={[0.42, 0.03, 8, 32]} />
          <meshStandardMaterial
            color="#ffd700"
            emissive="#ffd700"
            emissiveIntensity={2}
            transparent
            opacity={0.7}
          />
        </mesh>
      )}

      {/* Vote target ring */}
      {isVoteTarget && player.alive && (
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[0.44, 0.03, 8, 32]} />
          <meshStandardMaterial
            color="#e94560"
            emissive="#e94560"
            emissiveIntensity={2}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Dead X */}
      {!player.alive && (
        <Text
          position={[0, 0.1, 0.35]}
          fontSize={0.35}
          color="#e94560"
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          ✕
        </Text>
      )}

      {/* Name tag */}
      <Text
        position={[0, -0.65, 0]}
        fontSize={0.16}
        color={player.alive ? (player.isMe ? '#ffd700' : '#c0c0e0') : '#444460'}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.2}
        font={undefined}
      >
        {player.name}{player.isMe ? ' ★' : ''}
      </Text>

      {/* Point light for each seat (subtle) */}
      {player.alive && player.isMe && (
        <pointLight
          position={[0, 0.5, 0]}
          color="#ffd700"
          intensity={0.4}
          distance={2}
        />
      )}
    </group>
  );
}
