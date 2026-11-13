// Tunable numbers in one place. Distances are meters, speeds meters per second, angles radians.
export const CONFIG = {
  player: {
    radius: 0.35,
    walkSpeed: 2.4,
    runSpeed: 6.2,
    accel: 12,          // how fast velocity reaches the joystick's target
    turnRate: 12,       // how fast the body turns toward the movement direction
  },
  camera: {
    fov: 60,
    distance: 3.9,
    minDistance: 0.3,  // closest the camera gets when a wall is behind the player
    targetHeight: 1.55, // the camera looks at a point this high above the feet
    startPitch: 0.2,
    pitchMin: -0.30,
    pitchMax: 1.05,
    lookSpeed: 0.0058,  // radians per pixel of drag
    autoCenterDelay: 2.2,
    autoCenterRate: 1.1,
  },
  world: {
    fallLimit: 4,       // below the ground by more than this means something broke: respawn
  },
  quality: {
    low: { pixelRatio: 1, shadows: false, shadowMapSize: 512, fogFar: 240, traffic: 4, people: 4 },
    medium: { pixelRatio: 1.5, shadows: true, shadowMapSize: 1024, fogFar: 440, traffic: 8, people: 10 },
  },
};
