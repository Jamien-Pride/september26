import { GEO } from './config.js';

// Pinhole camera looking straight across the tracks. World units are feet:
// x runs along the platform, y is height above the platform floor, z is depth away from the viewer.
export class Camera {
  constructor() {
    this.camX = 0;   // lateral offset (parallax)
    this.dEye = 0;   // eye height offset (parallax)
    this.ox = 0;     // screen-space shake
    this.oy = 0;
  }

  resize(w, h, dpr) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    // Fit the virtual frame by height, but never show less than ~900 units of width,
    // so phones get a wider (more zoomed-out) view instead of a single door.
    this.k = Math.min(h / GEO.virtualH, w / 900);
    this.f = GEO.pxPerFtAtTrain * GEO.zTrain * this.k;
    this.cx = w / 2;
    this.hy = h / 2 + (GEO.horizon - GEO.virtualH / 2) * this.k;
  }

  get eye() { return GEO.eye + this.dEye; }
  s(z) { return this.f / z; }
  sx(x, z) { return this.cx + this.ox + (x - this.camX) * this.f / z; }
  sy(y, z) { return this.hy + this.oy + (this.eye - y) * this.f / z; }

  // Base (un-parallaxed) projections, used to pre-render static layers.
  bx(x, z) { return this.cx + x * this.f / z; }
  by(y, z) { return this.hy + (GEO.eye - y) * this.f / z; }
  // Depth of a horizontal plane at height y seen at base screen row sy.
  zAtRow(sy, y) { return (GEO.eye - y) * this.f / (sy - this.hy); }

  // Map feet on a vertical plane at depth z (y up) to device pixels.
  plane(ctx, z, xOffset = 0, yOffset = 0) {
    const s = this.f / z, d = this.dpr;
    ctx.setTransform(d * s, 0, 0, -d * s,
      d * (this.cx + this.ox + (xOffset - this.camX) * s),
      d * (this.hy + this.oy + (this.eye - yOffset) * s));
  }

  // Visible x range (feet) on a plane at depth z, with padding in feet.
  xRange(z, pad = 0) {
    const s = this.f / z;
    return [this.camX - this.cx / s - pad, this.camX + (this.w - this.cx) / s + pad];
  }
}
