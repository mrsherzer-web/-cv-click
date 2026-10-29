// Shared materials. Most use vertex colors so one material can tint many merged pieces.
import * as THREE from 'three';
import { Tex } from './textures.js';

let cached = null;

export function materials() {
  if (cached) return cached;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, vertexColors: true, ...o });
  cached = {
    ground: std({ map: Tex.ground(), roughness: 0.95 }),
    asphalt: std({ map: Tex.asphalt(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    pavers: std({ map: Tex.pavers(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    curbGray: std({ map: Tex.curb(false) }),
    curbPainted: std({ map: Tex.curb(true) }),
    plaster: std({ map: Tex.plaster(), roughness: 0.92 }),
    stone: std({ map: Tex.stone(), roughness: 0.95 }),
    tiles: std({ map: Tex.roofTiles(), roughness: 0.8 }),
    shutter: std({ map: Tex.shutter(), roughness: 0.55 }),
    door: std({ map: Tex.door(), roughness: 0.7 }),
    solar: std({ map: Tex.solar(), roughness: 0.3, metalness: 0.3 }),
    paint: std({ roughness: 0.6 }),                  // plain colored metal and plastic, tint via vertex color
    bump: std({ map: Tex.bump(), roughness: 0.7 }),
    // instanced meshes take their tint from instance colors, not vertex colors
    bark: std({ roughness: 1, vertexColors: false }),
    foliage: std({ roughness: 0.9, vertexColors: false }),
    glass: new THREE.MeshStandardMaterial({ color: '#1f2933', roughness: 0.12, metalness: 0.6 }),
  };
  return cached;
}

// convenience for tints in sRGB hex
export const tint = (hex) => new THREE.Color(hex);
