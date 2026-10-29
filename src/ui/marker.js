// The destination marker in the world: a soft column of light and a pulsing ring on the ground.
// Amber for the current objective, blue for where a mission starts.
import * as THREE from 'three';
import { Tex } from '../world/textures.js';

export class Marker {
  constructor(scene, color = '#ffb547') {
    this.group = new THREE.Group();
    this.beamMat = new THREE.MeshBasicMaterial({ color, map: Tex.beam(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 26, 20, 1, true), this.beamMat);
    beam.position.y = 13;
    this.ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2), this.ringMat);
    this.ring.position.y = 0.06;
    this.group.add(beam, this.ring);
    this.group.visible = false;
    this.radius = 1.7;
    this.time = 0;
    scene.add(this.group);
  }

  set(x, y, z, radius = 1.7, color = null) {
    this.group.position.set(x, y, z);
    this.radius = radius;
    if (color) { this.beamMat.color.set(color); this.ringMat.color.set(color); }
    this.group.visible = true;
  }

  hide() { this.group.visible = false; }
  get visible() { return this.group.visible; }

  update(dt) {
    this.time += dt;
    const s = this.radius * (1 + Math.sin(this.time * 3) * 0.06);
    this.ring.scale.set(s, 1, s);
  }
}
