import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';

interface FoliageProps {
  mode: TreeMode;
  count: number;
}

const vertexShader = `
  uniform float uTime;
  uniform float uProgress;
  
  attribute vec3 aChaosPos;
  attribute vec3 aTargetPos;
  attribute float aRandom;
  
  varying vec3 vColor;
  varying float vAlpha;

  // Cubic Ease In Out
  float cubicInOut(float t) {
    return t < 0.5
      ? 4.0 * t * t * t
      : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  }

  void main() {
    // Add some individual variation to the progress so they don't all move at once
    float localProgress = clamp(uProgress * 1.2 - aRandom * 0.2, 0.0, 1.0);
    float easedProgress = cubicInOut(localProgress);

    // Interpolate position
    vec3 newPos = mix(aChaosPos, aTargetPos, easedProgress);
    
    // Add a slight "breathing" wind effect when formed
    if (easedProgress > 0.9) {
      newPos.x += sin(uTime * 2.0 + newPos.y) * 0.05;
      newPos.z += cos(uTime * 1.5 + newPos.y) * 0.05;
    }

    vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
    
    // Size attenuation
    gl_PointSize = (4.0 * aRandom + 2.0) * (20.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    // Color logic: Mix between Chaos and Formed (New Year Theme)
    // Palette: Gold, Deep Purple, Cyan, Silver
    vec3 goldColor = vec3(1.0, 0.8, 0.1);
    vec3 purpleColor = vec3(0.6, 0.1, 0.9);
    vec3 cyanColor = vec3(0.1, 0.9, 1.0);
    vec3 silverColor = vec3(0.9, 0.9, 1.0);
    
    // Sparkle effect
    float sparkle = sin(uTime * 8.0 + aRandom * 100.0);
    
    // Mix based on random attribute for variety
    vec3 targetColor;
    if (aRandom < 0.33) targetColor = purpleColor;
    else if (aRandom < 0.66) targetColor = cyanColor;
    else targetColor = silverColor;
    
    // When formed, mix gold with the target festive colors
    vec3 finalColor = mix(goldColor, targetColor, easedProgress);
    
    vColor = finalColor;
    
    // Intensive sparkle for New Year fireworks feel
    if (sparkle > 0.8) {
      vColor += vec3(0.8); // Flash white
    }

    vAlpha = 1.0;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Circular particle
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;

    // Soft edge
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5);

    gl_FragColor = vec4(vColor, vAlpha * glow);
  }
`;

export const Foliage: React.FC<FoliageProps> = ({ mode, count }) => {
  const meshRef = useRef<THREE.Points>(null);
  
  // Target progress reference for smooth JS-side dampening logic for the uniform
  const progressRef = useRef(0);

  const { chaosPositions, targetPositions, randoms } = useMemo(() => {
    const chaos = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const rnd = new Float32Array(count);

    // Helper to get point on "2026" text
    const getPointOnText = () => {
      // 0: '2', 1: '0', 2: '2', 3: '6'
      const char = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      
      const t = Math.random(); 
      // Simplified stroke logic for 2026
      if (char === 0 || char === 2) { // '2'
        if (t < 0.3) { x = Math.cos(t*10)*0.5; y = Math.sin(t*10)*0.5 + 0.5; } // Top curve
        else if (t < 0.6) { x = (0.5 - (t-0.3)*3); y = 0.5 - (t-0.3)*3; } // Diagonal
        else { x = (t-0.6)*2.5 - 0.5; y = -0.5; } // Bottom line
      } else if (char === 1) { // '0'
        const angle = t * Math.PI * 2;
        x = Math.cos(angle) * 0.5;
        y = Math.sin(angle) * 0.7; // Elongated 0
      } else { // '6'
        const angle = t * Math.PI * 2;
        if (t < 0.7) { // Main loop
           x = Math.cos(angle) * 0.5;
           y = Math.sin(angle) * 0.5 - 0.2;
        } else { // Stem
           x = -0.5 + (t-0.7); 
           y = 0.3 + (t-0.7)*2; // Rough approximation
           // Better '6': spiral
           const spiralT = t * 3;
           x = Math.cos(spiralT) * 0.5;
           y = Math.sin(spiralT) * 0.5;
           if (t > 0.5) y += (t-0.5); // Lift stem
        }
      }
      
      // Spacing: 2 0 2 6
      // Positions: -1.5, -0.5, 0.5, 1.5
      const spacing = 1.2;
      x += (char - 1.5) * spacing;
      
      return { x: x * 3, y: y * 3 + 5, z: (Math.random() - 0.5) * 0.5 }; // Scale up and center vertically
    };

    // Better '2026' sampling using canvas (more accurate)
    const generateTextPoints = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, 200, 60);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 40px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('2026', 100, 30);
      
      const imageData = ctx.getImageData(0, 0, 200, 60);
      const points: {x: number, y: number}[] = [];
      
      for(let i=0; i<imageData.data.length; i+=4) {
        if (imageData.data[i] > 128) { // If white pixel
           const idx = i/4;
           const px = (idx % 200);
           const py = Math.floor(idx / 200);
           points.push({x: px, y: py});
        }
      }
      return points;
    };

    const textPoints = generateTextPoints();

    for (let i = 0; i < count; i++) {
      // 1. Chaos Positions: Now "2026" Text
      let tx = 0, ty = 0, tz = 0;
      
      if (textPoints && textPoints.length > 0) {
        const pt = textPoints[Math.floor(Math.random() * textPoints.length)];
        // Map 0-200 to -10 to 10
        // FIX: Invert X to prevent text from looking "backwards" (mirrored)
        tx = -(pt.x - 100) * 0.15;
        // Map 0-60 to -3 to 3 (inverted Y)
        ty = -(pt.y - 30) * 0.15 + 5; // +5 to center vertically
        tz = (Math.random() - 0.5) * 1.0; // Give it depth
      } else {
        // Fallback if canvas fails
        const p = getPointOnText();
        tx = p.x; ty = p.y; tz = p.z;
      }

      chaos[i * 3] = tx;
      chaos[i * 3 + 1] = ty;
      chaos[i * 3 + 2] = tz;

      // 2. Target Positions: Expanding Galaxy Sphere (Fireworks/Universe)
      // Use Fibonacci Sphere algorithm for even distribution
      const offset = 2 / count;
      const inc = Math.PI * (3 - Math.sqrt(5));
      
      const yNorm = ((i * offset) - 1) + (offset / 2); // -1 to 1
      const radiusCalc = Math.sqrt(1 - Math.pow(yNorm, 2));
      const phiIter = i * inc;
      
      const sphereRadius = 6.5; // Large sphere
      const centerHeight = 5; // Center of screen vertically

      // Add some noise to radius for volume
      const vol = sphereRadius + (Math.random() - 0.5) * 2.0;

      target[i * 3] = Math.cos(phiIter) * radiusCalc * vol;
      target[i * 3 + 1] = yNorm * vol + centerHeight;
      target[i * 3 + 2] = Math.sin(phiIter) * radiusCalc * vol;

      // 3. Randoms
      rnd[i] = Math.random();
    }

    return {
      chaosPositions: chaos,
      targetPositions: target,
      randoms: rnd
    };
  }, [count]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
  }), []);

  useFrame((state, delta) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      // Update time
      material.uniforms.uTime.value = state.clock.elapsedTime;
      
      // Smoothly interpolate the progress uniform
      const target = mode === TreeMode.FORMED ? 1 : 0;
      // Using a simple lerp for the uniform value
      progressRef.current = THREE.MathUtils.lerp(progressRef.current, target, delta * 1.5);
      material.uniforms.uProgress.value = progressRef.current;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position" // Required by three.js, though we override in shader
          count={count}
          array={chaosPositions} // Initial state
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aChaosPos"
          count={count}
          array={chaosPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aTargetPos"
          count={count}
          array={targetPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={count}
          array={randoms}
          itemSize={1}
        />
      </bufferGeometry>
      {/* @ts-ignore */}
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};