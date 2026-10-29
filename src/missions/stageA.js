// Stage A objective: walk from Nehorai's house to the lookout at the end of the street and use the viewer.
// It exists to exercise movement, the objective marker and the context (interact) button.
import * as THREE from 'three';
import { Tex } from '../world/textures.js';

export class StageA {
  constructor(scene, world, hud, followCam) {
    this.world = world;
    this.hud = hud;
    this.cam = followCam;
    this.state = 'walk';            // walk → arrived → done
    const L = world.lookout;
    this.target = new THREE.Vector3(L.x, L.y, L.z);

    // a soft amber column and a pulsing ring mark the destination
    this.marker = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({ color: '#ffb547', map: Tex.beam(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 26, 20, 1, true), beamMat);
    beam.position.y = 13;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.9, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0.8, depthWrite: false }));
    this.ring.position.y = 0.05;
    this.marker.add(beam, this.ring);
    this.marker.position.copy(this.target);
    scene.add(this.marker);
    this.time = 0;
    hud.setObjective('ללכת לתצפית בסוף הרחוב');
  }

  nearViewer(p) {
    const t = this.world.telescope;
    return Math.hypot(p.x - t.x, p.z - t.z) < 2.6;
  }

  update(dt, player, camera) {
    this.time += dt;
    const s = 1 + Math.sin(this.time * 3) * 0.08;
    this.ring.scale.set(s, 1, s);
    const p = player.pos;
    if (this.state === 'walk') {
      const dx = this.target.x - p.x, dz = this.target.z - p.z, dist = Math.hypot(dx, dz);
      // bearing of the target relative to where the camera looks, for the HUD arrow
      const camYaw = Math.atan2(-(camera.position.x - p.x), -(camera.position.z - p.z));
      const bearing = Math.atan2(dx, dz) - camYaw;
      this.hud.setDistance(dist, -bearing);
      if (dist < this.world.plaza.r) { // stepped onto the lookout plaza
        this.state = 'arrived';
        this.hud.setDistance(null);
        this.hud.setObjective('להסתכל במשקפת התצפית');
        this.hud.toast('הגעת לתצפית');
      }
    }
    this.hud.setInteract(this.state === 'arrived' && this.nearViewer(p) && !this.cam.override ? 'להסתכל' : null);
  }

  interact(player) {
    if (this.state !== 'arrived' || !this.nearViewer(player.pos)) return false;
    const t = this.world.telescope;
    const from = new THREE.Vector3(t.x + t.dx * 0.5, t.y + 1.4, t.z + t.dz * 0.5); // looking out through the viewer
    const look = new THREE.Vector3(t.x + t.dx * 400, t.y - 40, t.z + t.dz * 400);
    this.cam.shot(from, look, 5.5);
    this.hud.caption('מכאן רואים את מישור החוף עד הים. בשלבים הבאים: נסיעה לחדרה דרך גן שמואל.', 5500);
    this.state = 'done';
    this.marker.visible = false;
    setTimeout(() => {
      this.hud.setObjective('שלב א הושלם. אפשר להמשיך להסתובב ברחוב.');
      this.hud.toast('שלב א הושלם');
    }, 5600);
    return true;
  }
}
