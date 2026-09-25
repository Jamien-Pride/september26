#!/usr/bin/env python3
"""Validation case: open hemispherical cup, concave side facing the wind, in uniform flow.

Reference: Hoerner, Fluid-Dynamic Drag (1965), open hemisphere concave to the flow, CD about 1.42
(convex about 0.38), on frontal area. Same mesher, solver and schemes as the funnel cases.
Usage: python3 make_cup.py <case_dir> [level] [convex]
"""
import math, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
case = sys.argv[1]; level = sys.argv[2] if len(sys.argv) > 2 else '5'
convex = len(sys.argv) > 3 and sys.argv[3] == 'convex'
subprocess.run([sys.executable, os.path.join(HERE, 'make_case.py'), case, '0', level], check=True, stdout=subprocess.DEVNULL)
R, ZC, U = 1.2, 10.0, 10.0
tris = []
nt, npol = 96, 24
def P(th, ph):  # ph from 0 (pole) to 90 deg (rim)
    t, p = math.radians(th), math.radians(ph)
    # concave: pole downwind (+X), rim upwind at x = 0; convex: pole upwind
    return ((R if not convex else -R) * math.cos(p), R * math.sin(p) * math.cos(t), ZC + R * math.sin(p) * math.sin(t))
for i in range(nt):
    for j in range(npol):
        a, b, c, d = P(360*i/nt, 90*j/npol), P(360*(i+1)/nt, 90*j/npol), P(360*(i+1)/nt, 90*(j+1)/npol), P(360*i/nt, 90*(j+1)/npol)
        tris += [(a, b, c), (a, c, d)]
with open(os.path.join(case, 'constant/triSurface/funnel.stl'), 'w') as f:
    f.write('solid cup\n')
    for tri in tris:
        f.write(' facet normal 0 0 0\n  outer loop\n' + ''.join('   vertex %.6f %.6f %.6f\n' % v for v in tri) + '  endloop\n endfacet\n')
    f.write('endsolid cup\n')
def edit(rel, fn):
    p = os.path.join(case, rel); t = open(p).read(); open(p, 'w').write(fn(t))
edit('system/snappyHexMeshDict', lambda t: t.replace('min (-5 -5 0); max (5 5 5.2)', f'min (-3 -3 {ZC-3}); max (4 3 {ZC+3})')
     .replace('min (-8 -8 0); max (20 8 8)', f'min (-6 -6 {ZC-6}); max (20 6 {ZC+6})'))
k0, e0 = 1.5 * (0.01 * U) ** 2, 0.09 ** 0.75 * (1.5 * (0.01 * U) ** 2) ** 1.5 / 0.5
edit('0/U', lambda t: re.sub(r'inlet \{[^}]*\}', f'inlet {{ type fixedValue; value uniform ({U} 0 0); }}', t).replace('ground { type noSlip; }', 'ground { type slip; }'))
edit('0/k', lambda t: re.sub(r'uniform [0-9.]+;', f'uniform {k0};', t))
edit('0/epsilon', lambda t: re.sub(r'uniform [0-9.]+;', f'uniform {e0};', t))
edit('0/k', lambda t: re.sub(r'inlet \{[^}]*\}', f'inlet {{ type fixedValue; value uniform {k0}; }}', t).replace('ground { type kqRWallFunction', 'ground { type slip; } groundX { type kqRWallFunction'))
edit('0/epsilon', lambda t: re.sub(r'inlet \{[^}]*\}', f'inlet {{ type fixedValue; value uniform {e0}; }}', t).replace('ground { type epsilonWallFunction', 'ground { type slip; } groundX { type epsilonWallFunction'))
edit('0/nut', lambda t: re.sub(r'ground \{[^}]*\}', 'ground { type calculated; value uniform 0; }', t))
edit('0/p', lambda t: t)
A = math.pi * R * R
open(os.path.join(case, 'case.json'), 'w').write('{"delta": %d, "level": %s, "Af_m2": %.5f, "zc_m": %.2f, "U_centroid": %.3f, "cup": "%s"}\n' % (
    180 if convex else 0, level, A, ZC, U, 'convex' if convex else 'concave'))
print(case, 'cup', 'convex' if convex else 'concave', 'A =', round(A, 4))
