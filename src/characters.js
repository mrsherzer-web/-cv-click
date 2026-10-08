// Low-poly humanoids wearing the real faces from the photos (feather-masked onto the head),
// with procedural jerseys: Noam's red/black SEMENYO 24, Ori's light-blue Coventry shirt, etc.
import * as THREE from 'three';
import { faceTexture, jerseyTex, glowSprite } from './textures.js';

export const NOAM_EYES = [[0.335, 0.512], [0.655, 0.512]];
export const NOAM_SCARE_EYES = [[0.37, 0.455], [0.62, 0.455]];

const skinMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });

export function makeHumanoid({ faceImg, shirt = 'noam', shorts = '#b0141a', skin = '#c99a7c', hair = '#1c1410', height = 1.78, possessedFace = null, eyes = null, backpack = false }) {
  const root = new THREE.Group();
  const s = height / 1.78;
  const parts = {};
  const sk = skinMat(skin);
  const shirtMats = [
    new THREE.MeshStandardMaterial({ map: jerseyTex(shirt, 'side'), roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ map: jerseyTex(shirt, 'side'), roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ map: jerseyTex(shirt, 'side'), roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ map: jerseyTex(shirt, 'side'), roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ map: jerseyTex(shirt, 'front'), roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ map: jerseyTex(shirt, 'back'), roughness: 0.85 }),
  ];
  const sleeveMat = shirtMats[0];
  const shortsMat = new THREE.MeshStandardMaterial({ color: shorts, roughness: 0.9 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.95 });
  const cast = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  const hips = new THREE.Group(); hips.position.y = 0.9 * s; root.add(hips); parts.hips = hips;
  const shortsMesh = cast(new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.24 * s, 0.24 * s), shortsMat));
  shortsMesh.position.y = 0.02 * s; hips.add(shortsMesh);

  const leg = (side) => {
    const thigh = new THREE.Group(); thigh.position.set(side * 0.1 * s, 0, 0); hips.add(thigh);
    const tm = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.075 * s, 0.32 * s, 4, 8), shortsMat));
    tm.position.y = -0.2 * s; thigh.add(tm);
    const knee = new THREE.Group(); knee.position.y = -0.43 * s; thigh.add(knee);
    const shin = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.06 * s, 0.32 * s, 4, 8), sk));
    shin.position.y = -0.2 * s; knee.add(shin);
    const shoe = cast(new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.08 * s, 0.26 * s), shoeMat));
    shoe.position.set(0, -0.43 * s, 0.05 * s); knee.add(shoe);
    return { thigh, knee };
  };
  parts.legL = leg(-1); parts.legR = leg(1);

  const torso = new THREE.Group(); torso.position.y = 0.1 * s; hips.add(torso); parts.torso = torso;
  const chest = cast(new THREE.Mesh(new THREE.BoxGeometry(0.44 * s, 0.56 * s, 0.25 * s), shirtMats));
  chest.position.y = 0.28 * s; torso.add(chest);
  if (backpack) {
    const bp = cast(new THREE.Mesh(new THREE.BoxGeometry(0.34 * s, 0.42 * s, 0.16 * s), new THREE.MeshStandardMaterial({ color: '#4f6b2a', roughness: 0.9 })));
    bp.position.set(0, 0.3 * s, -0.2 * s); torso.add(bp);
  }
  const neck = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.055 * s, 0.1 * s, 10), sk));
  neck.position.y = 0.6 * s; torso.add(neck);

  const head = new THREE.Group(); head.position.y = 0.64 * s; head.scale.setScalar(1.22); torso.add(head); parts.head = head;
  const skull = cast(new THREE.Mesh(new THREE.SphereGeometry(0.118 * s, 20, 16), hairMat));
  skull.scale.set(0.95, 1.08, 1.02); skull.position.y = 0.1 * s; head.add(skull);
  const jaw = cast(new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 16, 12), sk));
  jaw.position.set(0, 0.05 * s, 0.015 * s); jaw.scale.set(0.92, 1, 0.95); head.add(jaw);
  // face photo wrapped on a front cap of a sphere
  const phiLen = Math.PI * 0.72;
  const faceGeo = new THREE.SphereGeometry(0.125 * s, 24, 18, Math.PI / 2 - phiLen / 2, phiLen, Math.PI * 0.08, Math.PI * 0.62);
  const faceMats = {};
  if (faceImg) {
    faceMats.normal = new THREE.MeshStandardMaterial({ map: faceTexture(faceImg), transparent: true, alphaTest: 0.05, roughness: 0.7 });
    if (possessedFace || eyes) faceMats.possessed = new THREE.MeshStandardMaterial({ map: faceTexture(possessedFace || faceImg, { possessed: true, eyes }), transparent: true, alphaTest: 0.05, roughness: 0.7, emissive: 0x330000, emissiveIntensity: 0.4 });
  }
  const face = new THREE.Mesh(faceGeo, faceMats.normal || sk);
  face.position.y = 0.075 * s;
  face.scale.set(1, 1.18, 1.0);
  head.add(face);
  parts.face = face;
  // glowing eyes (possessed)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a10 });
  const eyesGrp = new THREE.Group();
  const glowMat = new THREE.SpriteMaterial({ map: glowSprite('255,40,20'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  for (const ex of [-0.04, 0.04]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.011 * s, 8, 6), eyeMat);
    e.position.set(ex * s, 0.085 * s, 0.122 * s); eyesGrp.add(e);
    const glow = new THREE.Sprite(glowMat);
    glow.position.copy(e.position).add(new THREE.Vector3(0, 0, 0.01)); glow.scale.set(0.07, 0.07, 1);
    eyesGrp.add(glow);
  }
  eyesGrp.visible = false; head.add(eyesGrp);
  parts.eyes = eyesGrp;

  const arm = (side) => {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 0.27 * s, 0.52 * s, 0); torso.add(shoulder);
    const sleeve = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.068 * s, 0.12 * s, 4, 8), sleeveMat));
    sleeve.position.y = -0.08 * s; shoulder.add(sleeve);
    const upper = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.05 * s, 0.18 * s, 4, 8), sk));
    upper.position.y = -0.17 * s; shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.3 * s; shoulder.add(elbow);
    const fore = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.045 * s, 0.22 * s, 4, 8), sk));
    fore.position.y = -0.14 * s; elbow.add(fore);
    const hand = cast(new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 10, 8), sk));
    hand.position.y = -0.3 * s; hand.scale.set(0.8, 1.1, 0.6); elbow.add(hand);
    return { shoulder, elbow, hand };
  };
  parts.armL = arm(-1); parts.armR = arm(1);

  let phase = 0;
  const api = {
    root, parts, faceMats,
    possessed: false,
    setPossessed(on) {
      api.possessed = on;
      if (faceMats.possessed) face.material = on ? faceMats.possessed : faceMats.normal;
      eyesGrp.visible = on;
    },
    // speed in m/s; mode: 'walk' | 'run' | 'idle' | 'sit' | 'lie' | 'reach' | 'creep'
    animate(dt, speed, mode = 'walk', t = 0) {
      const L = parts.legL, R = parts.legR, AL = parts.armL, AR = parts.armR;
      if (mode === 'lie') {
        hips.position.y = 0.0; hips.rotation.x = -Math.PI / 2;
        L.thigh.rotation.x = R.thigh.rotation.x = 0; L.knee.rotation.x = R.knee.rotation.x = 0;
        AL.shoulder.rotation.set(0, 0, -0.15); AR.shoulder.rotation.set(0, 0, 0.15);
        AL.elbow.rotation.x = AR.elbow.rotation.x = -0.4;
        torso.rotation.set(0, 0, 0);
        const br = Math.sin(t * 1.4) * 0.015;
        torso.scale.set(1 + br, 1, 1 + br);
        head.rotation.set(0.2, 0.5, 0);
        return;
      }
      torso.scale.set(1, 1, 1);
      hips.rotation.x = 0;
      if (mode === 'sit') {
        hips.position.y = 0.47 * s;
        L.thigh.rotation.x = R.thigh.rotation.x = -Math.PI / 2;
        L.knee.rotation.x = R.knee.rotation.x = Math.PI / 2;
        AL.shoulder.rotation.set(-0.8, 0, 0.1); AR.shoulder.rotation.set(-0.8, 0, -0.1);
        AL.elbow.rotation.x = AR.elbow.rotation.x = -0.7;
        torso.rotation.set(0.1 + Math.sin(t * 1.2) * 0.02, 0, 0);
        head.rotation.set(0.15, 0, 0);
        return;
      }
      hips.position.y = 0.9 * s;
      const run = mode === 'run';
      const stride = run ? 1.0 : mode === 'creep' ? 0.35 : 0.6;
      phase += dt * speed * (run ? 2.6 : 3.4);
      const sw = Math.sin(phase) * stride * Math.min(1, speed / 1.2);
      L.thigh.rotation.x = sw; R.thigh.rotation.x = -sw;
      L.knee.rotation.x = Math.max(0, -Math.sin(phase + 0.6)) * stride * 1.4 * Math.min(1, speed);
      R.knee.rotation.x = Math.max(0, Math.sin(phase + 0.6)) * stride * 1.4 * Math.min(1, speed);
      const armSw = sw * (run ? 1.1 : 0.7);
      if (mode === 'reach') {
        AL.shoulder.rotation.set(-1.45, 0, 0.12); AR.shoulder.rotation.set(-1.45, 0, -0.12);
        AL.elbow.rotation.x = AR.elbow.rotation.x = -0.2;
      } else if (mode === 'creep') {
        AL.shoulder.rotation.set(-0.35 - armSw * 0.4, 0, 0.25); AR.shoulder.rotation.set(-0.35 + armSw * 0.4, 0, -0.25);
        AL.elbow.rotation.x = AR.elbow.rotation.x = -0.6;
      } else {
        AL.shoulder.rotation.set(-armSw, 0, 0.08); AR.shoulder.rotation.set(armSw, 0, -0.08);
        AL.elbow.rotation.x = AR.elbow.rotation.x = run ? -1.2 : -0.25;
      }
      hips.position.y = 0.9 * s + Math.abs(Math.cos(phase)) * (run ? 0.05 : 0.025);
      torso.rotation.set(run ? 0.25 : mode === 'creep' ? 0.35 : 0.04, Math.sin(phase) * 0.06, 0);
      if (mode !== 'reach') head.rotation.set(mode === 'creep' ? -0.2 : 0, 0, 0);
      if (speed < 0.05) { // idle breathing
        L.thigh.rotation.x = R.thigh.rotation.x = 0; L.knee.rotation.x = R.knee.rotation.x = 0;
        if (mode !== 'reach') { AL.shoulder.rotation.set(0, 0, 0.08); AR.shoulder.rotation.set(0, 0, -0.08); AL.elbow.rotation.x = AR.elbow.rotation.x = -0.1; }
        torso.rotation.x = 0.02 + Math.sin(t * 1.6) * 0.012;
      }
    },
  };
  return api;
}

// The cursed horned mask (DIMONA DEMONS logo come to life)
export function makeMask() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: '#8f0d10', roughness: 0.35, emissive: '#3a0000', emissiveIntensity: 0.6 });
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), red);
  face.rotation.x = Math.PI / 2; face.scale.set(1, 0.6, 1.25); g.add(face);
  const hornMat = new THREE.MeshStandardMaterial({ color: '#e7c6b8', roughness: 0.6 });
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 10), hornMat);
    horn.position.set(sx * 0.08, 0.13, -0.02); horn.rotation.z = -sx * 0.45; g.add(horn);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd000 }));
    eye.position.set(sx * 0.045, 0.03, 0.075); g.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.02), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  mouth.position.set(0, -0.05, 0.08); g.add(mouth);
  return g;
}
