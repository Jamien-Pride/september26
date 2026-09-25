// Local site frame. Origin = centre of the sculpture pad at Cityside Park,
// Treasure Island. Units are metres. +x = east, +y = up, +z = south (so north is -z).
// The origin elevation (y = 0) is the park grade, ~3.6 m above NAVD88.

export const SITE = {
  lat: 37.81958,
  lon: -122.37321,
  groundElevation: 3.64, // m above NAVD88 (from USGS/Terrarium DEM)
  // Mean sea level in San Francisco Bay sits ~0.9 m above NAVD88.
  meanSeaLevelNavd: 0.9,
  // Direction the sculpture's mouth faces in the proposal: square to the path,
  // opening onto the lawn.
  padFacing: 229.4,
};

const LAT0 = SITE.lat * Math.PI / 180;
export const M_PER_DEG_LAT = 111132.954 - 559.822 * Math.cos(2 * LAT0);
export const M_PER_DEG_LON = 111412.84 * Math.cos(LAT0);

export function toLocal(lat, lon) {
  return { x: (lon - SITE.lon) * M_PER_DEG_LON, z: -(lat - SITE.lat) * M_PER_DEG_LAT };
}

// Elevation above NAVD88 -> scene y.
export const elevToY = (e) => e - SITE.groundElevation;

// Unit vector (x,z) on the ground for a compass bearing in degrees.
export function bearingVec(deg) {
  const r = deg * Math.PI / 180;
  return { x: Math.sin(r), z: -Math.cos(r) };
}

// The Cityside Park landscape plan is drawn with the bay at the bottom. Its "down"
// axis points WSW (242.4°, perpendicular to Treasure Island's straight west
// seawall, measured from the DEM) and its "right" axis points SSE (152.4°).
// Plan pixels are ~0.25 m. (570, 640) is the red-circled art location.
export const PLAN = {
  scale: 0.25,
  originPx: [570, 640],
  right: bearingVec(152.4),
  down: bearingVec(242.4),
};

// Plan metres (u right, v down/toward water) -> world x,z
export function planToWorld(u, v) {
  return {
    x: u * PLAN.right.x + v * PLAN.down.x,
    z: u * PLAN.right.z + v * PLAN.down.z,
  };
}
export function planPxToWorld(px, py) {
  return planToWorld((px - PLAN.originPx[0]) * PLAN.scale, (py - PLAN.originPx[1]) * PLAN.scale);
}
export function worldToPlan(x, z) {
  // R and D are orthonormal
  return {
    u: x * PLAN.right.x + z * PLAN.right.z,
    v: x * PLAN.down.x + z * PLAN.down.z,
  };
}
