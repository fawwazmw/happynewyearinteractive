
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { TreeMode } from '../types';

/**
 * ==================================================================================
 *  INSTRUCTIONS FOR LOCAL PHOTOS
 * ==================================================================================
 * 1. Create a folder named "photos" inside your "public" directory.
 *    (e.g., public/photos/)
 * 
 * 2. Place your JPG images in there.
 * 
 * 3. Rename them sequentially:
 *    1.jpg, 2.jpg, 3.jpg ... up to 13.jpg
 * 
 *    If a file is missing (e.g., you only have 5 photos), the frame will 
 *    display a placeholder instead of crashing the app.
 * ==================================================================================
 */

const PHOTO_COUNT = 22; // How many polaroid frames to generate

interface PolaroidsProps {
  mode: TreeMode;
  uploadedPhotos: string[];
  twoHandsDetected: boolean;
  onClosestPhotoChange?: (photoUrl: string | null) => void;
}

interface PhotoData {
  id: number;
  url: string;
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  speed: number;
}

const PolaroidItem: React.FC<{ data: PhotoData; mode: TreeMode; index: number }> = ({ data, mode, index }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState(false);

  // Random sway offset
  const swayOffset = useMemo(() => Math.random() * 100, []);

  // Safe texture loading that won't crash the app if a file is missing
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      data.url,
      (loadedTex) => {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        setTexture(loadedTex);
        setError(false);
      },
      undefined, // onProgress
      (err) => {
        console.warn(`Failed to load image: ${data.url}`, err);
        setError(true);
      }
    );
  }, [data.url]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;
    
    // 1. Position Interpolation
    // If Formed (Closed/Galaxy), we essentially "hide" them by scaling down or moving away
    // The user said: "terlihat nya ketika dibuka bukan pas ditutup" (visible when opened, not when closed)
    
    const targetScale = isFormed ? 0 : 1;
    const currentScale = groupRef.current.scale.x;
    const newScale = THREE.MathUtils.lerp(currentScale, targetScale, delta * 3);
    
    groupRef.current.scale.setScalar(newScale);
    
    // Only update position if visible to save resources
    if (newScale > 0.01) {
       // Always move towards chaosPos (The Arch) because that's where they live in "Open" mode
       // In "Formed" mode they disappear, so destination doesn't matter much, 
       // but keeping them at chaosPos ensures they re-appear in place.
       const step = delta * data.speed;
       groupRef.current.position.lerp(data.chaosPos, step);
    }

    // 2. Rotation & Sway Logic
    if (isFormed) {
       // Hidden state - no rotation needed
    } else {
        // Chaos mode - Face Front (Stable)
        // Camera position is roughly [0, 4, 20]
        
        // Simple LookAt camera logic but KEEP VERTICAL (No X rotation)
        const dummy = new THREE.Object3D();
        dummy.position.copy(groupRef.current.position);
        
        // Fix "Membelakangi" (Backwards) issue:
        // Look at camera Z (20), but preserve Y level.
        dummy.lookAt(0, groupRef.current.position.y, 20); 
        
        // Flip 180 degrees if it was showing the back
        // (Sometimes geometry face orientation needs correction)
        // If it was backwards, rotating Y by PI usually fixes it.
        // Let's remove the rotation/flip and rely on basic LookAt first, 
        // or Add PI if the previous state was indeed backwards.
        // Assuming previous state was "Backwards", adding PI should face Front.
        // Or removing any rotation offsets.
        
        // Based on user feedback "masih membelakangi", let's try flipping it.
        // dummy.rotateY(Math.PI); 
        
        // Wait, standard PlaneGeometry faces Z+. 
        // lookAt([0,y,20]) from [x,y,0] sets Z+ to point to [0,y,20].
        // This SHOULD be correct.
        // If user says "membelakangi", maybe the text "2026" is mirrored and they think that's front?
        // OR the initial rotation is messed up.
        
        // Let's try forcing a clear Identity rotation then lookAt.
        // And ensure no weird flips.
        
        // Actually, if it was "membelakangi", maybe the camera is seeing the "Back" of the mesh?
        // Let's explicitly face it towards camera.
        
        // Quick rotation snap
        groupRef.current.quaternion.slerp(dummy.quaternion, delta * 5);
        
        // Minimal gentle sway (Z axis only)
        const gentleSway = Math.sin(time * 1 + swayOffset) * 0.02;
        groupRef.current.rotation.z += gentleSway * delta;
        // Ensure X rotation is 0 (Tegak)
        groupRef.current.rotation.x = 0;
        // Ensure Y rotation is 0 (Face straight forward, ignore camera angle for perfect alignment with text?)
        // If text 2026 is strictly planar at Z=0 facing Z+, we should just set rotation to Identity (0,0,0).
        groupRef.current.rotation.y = 0; 
        
        // Force reset quaternion to avoid lookAt accumulating weirdness?
        // No, let's just zero it out for "Flat" look matching text.
        groupRef.current.quaternion.set(0, 0, 0, 1); // Identity quaternion (Face Z+)
        
        // FIX: If user says it's backwards, rotate Y by 180 degrees (PI)
        groupRef.current.rotateY(Math.PI);

        // Re-apply sway
        groupRef.current.rotation.z += gentleSway;
    }
  });

  return (
    <group ref={groupRef}>
      
      {/* The Hanging String (Visual only) - fades out at top */}
      <mesh position={[0, 1.2, -0.1]}>
        <cylinderGeometry args={[0.005, 0.005, 1.5]} />
        <meshStandardMaterial color="#D4AF37" metalness={1} roughness={0.2} transparent opacity={0.6} />
      </mesh>

      {/* Frame Group (Offset slightly so string connects to top center) */}
      <group position={[0, 0, 0]}>
        
        {/* White Paper Backing */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.2, 1.5, 0.02]} />
          <meshStandardMaterial color="#fdfdfd" roughness={0.8} />
        </mesh>

        {/* The Photo Area */}
        <mesh position={[0, 0.15, 0.025]}>
          <planeGeometry args={[1.0, 1.0]} />
          {texture && !error ? (
            <meshBasicMaterial map={texture} />
          ) : (
            // Fallback Material (Red for error, Grey for loading)
            <meshStandardMaterial color={error ? "#550000" : "#cccccc"} />
          )}
        </mesh>
        
        {/* "Tape" or Gold Clip */}
        <mesh position={[0, 0.7, 0.025]} rotation={[0,0,0]}>
           <boxGeometry args={[0.1, 0.05, 0.05]} />
           <meshStandardMaterial color="#D4AF37" metalness={1} roughness={0.2} />
        </mesh>

        {/* Text Label */}
        <Text
          position={[0, -0.55, 0.03]}
          fontSize={0.12}
          color="#333"
          anchorX="center"
          anchorY="middle"
        >
          {error ? "Image not found" : "Happy Memories"}
        </Text>
      </group>
    </group>
  );
};

export const Polaroids: React.FC<PolaroidsProps> = ({ mode, uploadedPhotos, twoHandsDetected, onClosestPhotoChange }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [closestPhotoIndex, setClosestPhotoIndex] = React.useState<number>(0);

  const photoData = useMemo(() => {
    // Don't render any photos if none are uploaded
    if (uploadedPhotos.length === 0) {
      return [];
    }

    const data: PhotoData[] = [];
    const height = 9; 
    const sphereRadius = 8.5; // Larger than foliage (6.5) to float outside
    const centerHeight = 5; // Center of galaxy
    
    const count = uploadedPhotos.length;

    for (let i = 0; i < count; i++) {
      // 1. Target Position: Sphere Surface (Fibonacci Sphere)
      const offset = 2 / count;
      const inc = Math.PI * (3 - Math.sqrt(5));
      
      const yNorm = ((i * offset) - 1) + (offset / 2); // -1 to 1
      const r = Math.sqrt(1 - Math.pow(yNorm, 2));
      const phi = i * inc;
      
      const targetPos = new THREE.Vector3(
        Math.cos(phi) * r * sphereRadius,
        (yNorm * sphereRadius) + centerHeight,
        Math.sin(phi) * r * sphereRadius
      );

      // 2. Chaos Position - Directly ABOVE "2026" text
      // Text "2026" is centered at (0, 5, 0) roughly width 15
      // Photos should be centered horizontally and strictly above Y=6
      
      const totalWidth = 14; // Approximate width of text
      // Distribute photos in 2 rows if many, or 1 row
      const xStep = totalWidth / count;
      const xBase = (i * xStep) - (totalWidth / 2) + (xStep / 2);
      
      const chaosPos = new THREE.Vector3(
        xBase,
        8 + (i % 2) * 2.5, // Alternating height: 8 and 10.5 (Clearly above text at Y=5)
        0 // Same depth as text
      );

      data.push({
        id: i,
        url: uploadedPhotos[i],
        chaosPos,
        targetPos, // Target doesn't matter as we hide them in Formed
        speed: 0.8 + Math.random() * 1.5
      });
    }
    return data;
  }, [uploadedPhotos]);

  // Update closest photo every frame when two hands are detected
  useFrame((state) => {
    // No interaction logic needed here
  });

  return (
    <group ref={groupRef}>
      {photoData.map((data, i) => (
        <PolaroidItem 
          key={i} 
          index={i} 
          data={data} 
          mode={mode}
        />
      ))}
    </group>
  );
};
