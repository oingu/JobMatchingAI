"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sphere, Stars, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

function VectorNodes() {
  const group = useRef<THREE.Group>(null);
  
  // Create random positions for background "data points"
  const nodes = useMemo(() => {
    return Array.from({ length: 15 }).map(() => ({
      position: [
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
      ] as [number, number, number],
      scale: Math.random() * 0.3 + 0.1,
    }));
  }, []);

  useFrame((state) => {
    if (group.current) {
      // Slowly rotate the entire group
      group.current.rotation.y = state.clock.elapsedTime * 0.1;
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.2;
      
      // Make it react to mouse slightly
      const targetX = (state.pointer.x * Math.PI) / 10;
      const targetY = (state.pointer.y * Math.PI) / 10;
      
      group.current.rotation.y += 0.05 * (targetX - group.current.rotation.y);
      group.current.rotation.x += 0.05 * (-targetY - group.current.rotation.x);
    }
  });

  return (
    <group ref={group}>
      <Float speed={2} rotationIntensity={1} floatIntensity={2}>
        <Sphere args={[1, 32, 32]} position={[0, 0, 0]}>
          <meshStandardMaterial 
            color="#10b981" 
            wireframe 
            emissive="#10b981"
            emissiveIntensity={0.5}
            transparent
            opacity={0.8}
          />
        </Sphere>
      </Float>

      {nodes.map((node, i) => (
        <Float key={i} speed={1.5} rotationIntensity={0.5} floatIntensity={1.5} position={node.position}>
          <Sphere args={[node.scale, 16, 16]}>
            <meshStandardMaterial 
              color="#3b82f6" 
              transparent 
              opacity={0.4} 
              roughness={0.1}
              metalness={0.8}
            />
          </Sphere>
        </Float>
      ))}
    </group>
  );
}

export function Scene3D() {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={50} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} color="#10b981" />
        <directionalLight position={[-10, -10, -5]} intensity={1} color="#3b82f6" />
        <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
        <VectorNodes />
      </Canvas>
    </div>
  );
}
