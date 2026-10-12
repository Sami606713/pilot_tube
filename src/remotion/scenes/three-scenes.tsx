import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import type { Scene3D } from "../../lib/studio/types";

/** Seeded random, so every render of a scene is identical. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SceneProps = { frame: number; total: number; accent: THREE.Color };

function Chip({ frame, accent }: SceneProps) {
  const traces = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 28 }, (_, i) => {
      const side = i % 4;
      const offset = (r() - 0.5) * 1.3;
      const len = 0.5 + r() * 0.55;
      return { side, offset, len, phase: r() * Math.PI * 2 };
    });
  }, []);
  const pulse = 0.8 + Math.sin(frame / 7) * 0.4;
  return (
    <group scale={0.78} rotation={[0.95 + Math.sin(frame / 60) * 0.05, frame * 0.006 + 0.5, 0]}>
      <mesh>
        <boxGeometry args={[3.2, 0.22, 3.2]} />
        <meshStandardMaterial color="#2a2f3a" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <boxGeometry args={[1.5, 0.12, 1.5]} />
        <meshStandardMaterial color="#1b1f28" emissive={accent} emissiveIntensity={0.9 * pulse} metalness={0.5} roughness={0.25} />
      </mesh>
      {traces.map((t, i) => {
        const glow = 0.6 + 0.9 * Math.max(0, Math.sin(frame / 5 - t.phase));
        const along = 0.75 + t.len / 2;
        const pos: [number, number, number] =
          t.side === 0 ? [along, 0.12, t.offset] : t.side === 1 ? [-along, 0.12, t.offset] : t.side === 2 ? [t.offset, 0.12, along] : [t.offset, 0.12, -along];
        const size: [number, number, number] = t.side < 2 ? [t.len, 0.02, 0.035] : [0.035, 0.02, t.len];
        return (
          <mesh key={i} position={pos}>
            <boxGeometry args={size} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={glow * 1.6} />
          </mesh>
        );
      })}
      {Array.from({ length: 40 }, (_, i) => {
        const side = i % 4;
        const k = Math.floor(i / 4) / 9 - 0.5;
        const pos: [number, number, number] = side === 0 ? [1.7, -0.02, k * 2.8] : side === 1 ? [-1.7, -0.02, k * 2.8] : side === 2 ? [k * 2.8, -0.02, 1.7] : [k * 2.8, -0.02, -1.7];
        return (
          <mesh key={`p${i}`} position={pos}>
            <boxGeometry args={[0.14, 0.05, 0.14]} />
            <meshStandardMaterial color="#c9a227" metalness={1} roughness={0.25} />
          </mesh>
        );
      })}
      <pointLight position={[0, 2.2, 0]} color={accent} intensity={14 * pulse} distance={9} />
      <pointLight position={[2.5, 3, 2.5]} color="#ffffff" intensity={10} distance={12} />
    </group>
  );
}

function Servers({ frame, total, accent }: SceneProps) {
  const racks = useMemo(() => Array.from({ length: 18 }, (_, i) => i), []);
  const z = interpolate(frame, [0, total], [5, -3]);
  return (
    <group position={[0, -0.6, -z]}>
      {racks.map((i) =>
        [-1.7, 1.7].map((x) => (
          <group key={`${i}${x}`} position={[x, 1.4, -i * 1.6]}>
            <mesh>
              <boxGeometry args={[1, 3, 1.3]} />
              <meshStandardMaterial color="#0b0d12" metalness={0.7} roughness={0.4} />
            </mesh>
            {Array.from({ length: 9 }, (_, k) => {
              const on = (i * 7 + k * 3 + Math.floor(frame / 5) + (x > 0 ? 2 : 0)) % 6 !== 0;
              return (
                <mesh key={k} position={[x > 0 ? -0.51 : 0.51, 1.2 - k * 0.3, 0.3 - (k % 3) * 0.2]}>
                  <boxGeometry args={[0.02, 0.05, 0.12]} />
                  <meshStandardMaterial color={k % 4 === 0 ? "#ffffff" : accent} emissive={k % 4 === 0 ? "#ffffff" : accent} emissiveIntensity={on ? 2.2 : 0.1} />
                </mesh>
              );
            })}
          </group>
        )),
      )}
      <gridHelper args={[60, 60, accent, "#1a1d24"]} position={[0, -0.05, -14]} />
      <pointLight position={[0, 2.5, -4]} color={accent} intensity={4} distance={14} />
    </group>
  );
}

function Network({ frame, accent }: SceneProps) {
  const { nodes, edges } = useMemo(() => {
    const n = 70;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      pts.push(new THREE.Vector3(Math.cos(th) * r * 2.2, y * 2.2, Math.sin(th) * r * 2.2));
    }
    const seg: number[] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (pts[i].distanceTo(pts[j]) < 1.05) seg.push(...pts[i].toArray(), ...pts[j].toArray());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    return { nodes: pts, edges: geo };
  }, []);
  return (
    <group rotation={[0.3, frame * 0.012, 0]}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={accent} transparent opacity={0.45} />
      </lineSegments>
      {nodes.map((p, i) => {
        const s = 0.05 + 0.05 * Math.max(0, Math.sin(frame / 6 + i * 1.7));
        return (
          <mesh key={i} position={p} scale={s / 0.05}>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshStandardMaterial color="#ffffff" emissive={accent} emissiveIntensity={1.5} />
          </mesh>
        );
      })}
    </group>
  );
}

function Globe({ frame, total, accent }: SceneProps) {
  const arcs = useMemo(() => {
    const r = rng(11);
    const onSphere = () => {
      const u = r() * Math.PI * 2;
      const v = Math.acos(2 * r() - 1);
      return new THREE.Vector3(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)).multiplyScalar(2);
    };
    return Array.from({ length: 9 }, () => {
      const a = onSphere();
      const b = onSphere();
      const mid = a.clone().add(b).normalize().multiplyScalar(2 + a.distanceTo(b) * 0.45);
      return { curve: new THREE.QuadraticBezierCurve3(a, mid, b), delay: r() * 0.5 };
    });
  }, []);
  const progress = frame / Math.max(1, total);
  return (
    <group rotation={[0.35, frame * 0.008, 0]}>
      <mesh>
        <icosahedronGeometry args={[2, 4]} />
        <meshBasicMaterial color={accent} wireframe transparent opacity={0.5} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.97, 48, 48]} />
        <meshStandardMaterial color="#0a1220" emissive={accent} emissiveIntensity={0.12} metalness={0.3} roughness={0.8} />
      </mesh>
      {arcs.map((a, i) => {
        // WebGL lines are always 1px: tubes stay visible at 1080p. Each arc draws itself along its path.
        const t = interpolate(progress, [a.delay * 0.6, a.delay * 0.6 + 0.45], [0.02, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const pts = a.curve.getPoints(48).slice(0, Math.max(2, Math.round(48 * t) + 1));
        const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.022, 6, false);
        const head = pts[pts.length - 1];
        return (
          <group key={i}>
            <mesh geometry={geo}>
              <meshBasicMaterial color={i % 3 === 0 ? "#ffffff" : accent} />
            </mesh>
            <mesh position={head}>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Particles({ frame, accent }: SceneProps) {
  const base = useMemo(() => {
    const r = rng(23);
    return Array.from({ length: 1400 }, () => ({ a: r() * Math.PI * 2, rad: 0.6 + r() * 2.6, z: r() * 40 }));
  }, []);
  const positions = new Float32Array(base.length * 3);
  base.forEach((p, i) => {
    const z = ((p.z + frame * 0.22) % 40) - 34;
    positions[i * 3] = Math.cos(p.a + frame * 0.004) * p.rad;
    positions[i * 3 + 1] = Math.sin(p.a + frame * 0.004) * p.rad;
    positions[i * 3 + 2] = z;
  });
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={accent} size={0.07} sizeAttenuation transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

function Core({ frame, accent }: SceneProps) {
  const pulse = 1 + Math.sin(frame / 8) * 0.06;
  return (
    <group>
      <mesh scale={pulse} rotation={[frame * 0.01, frame * 0.013, 0]}>
        <icosahedronGeometry args={[0.9, 1]} />
        <meshStandardMaterial color="#ffffff" emissive={accent} emissiveIntensity={1.6} flatShading metalness={0.2} roughness={0.3} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[frame * 0.012 * (i + 1) + i, frame * 0.009 * (i % 2 ? -1 : 1), i * 0.9]}>
          <torusGeometry args={[1.5 + i * 0.42, 0.02, 12, 120]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} />
        </mesh>
      ))}
      {Array.from({ length: 10 }, (_, i) => {
        const a = frame * 0.03 + (i / 10) * Math.PI * 2;
        const r = 1.9 + (i % 3) * 0.35;
        return (
          <mesh key={`o${i}`} position={[Math.cos(a) * r, Math.sin(a * 1.3) * 0.6, Math.sin(a) * r]}>
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
          </mesh>
        );
      })}
      <pointLight color={accent} intensity={8} distance={10} />
    </group>
  );
}

/** R3F only reads the camera prop once; this moves it every frame. */
function CameraRig({ y, z, lookY, lookZ }: { y: number; z: number; lookY: number; lookZ: number }) {
  const camera = useThree((s) => s.camera);
  camera.position.set(0, y, z);
  camera.lookAt(0, lookY, lookZ);
  return null;
}

const SCENES: Record<Scene3D, (p: SceneProps) => React.ReactElement> = { chip: Chip, servers: Servers, network: Network, globe: Globe, particles: Particles, core: Core };

/** A 3D scene on a dark, accent-lit backdrop; camera slowly pushes in. */
export function ThreeScene({ scene, accent, frames }: { scene: Scene3D; accent: string; frames: number }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const color = useMemo(() => new THREE.Color(accent), [accent]);
  const Comp = SCENES[scene] ?? Particles;
  const servers = scene === "servers";
  const camZ = interpolate(frame, [0, frames], [servers ? 4 : 7.2, servers ? 4 : 6.2]);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, ${accent}33 0%, #07080c 55%, #020203 100%)` }}>
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 0, 7], fov: 50 }} gl={{ antialias: true, alpha: true }}>
        <CameraRig y={servers ? 1.1 : 0} z={camZ} lookY={servers ? 0.9 : 0} lookZ={servers ? -10 : 0} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <directionalLight position={[-4, -2, -3]} intensity={0.4} color={color} />
        {servers && <fog attach="fog" args={["#05060a", 4, 26]} />}
        <Comp frame={frame} total={frames} accent={color} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
}
