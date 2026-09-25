#!/usr/bin/env python3
"""Build an OpenFOAM (v1912) case for the funnel's 3D wind load.

The funnel is a zero-thickness shell (the oblique cone between the 18 ft mouth rim and the
7 ft throat rim, js/sculpture.js) cut by the ground. Wind blows along +X. delta = angle
between the wind's source direction and the mouth axis: 0 = straight into the mouth,
180 = into the throat from behind.

Usage: python3 make_case.py <case_dir> <delta_deg> [level]   (level: surface refinement, default 5)
"""
import math, os, sys

FT = 0.3048
RM, RT = 9 * FT, 3.5 * FT            # rim radii
YM, YT = 5 * FT, 3 * FT              # rim centre heights
ZM, ZT = 4 * FT, -4 * FT             # mouth / throat planes (local, +z = mouth facing)
AF = 175 * FT * FT                   # solid area facing the wind (mouth minus throat), 16.26 m2
ZC = 7 * FT                          # centroid height of AF
UREF, ZREF, Z0 = 10.0, 10.0, 0.005   # 10 m/s at 10 m, Exposure D roughness length (m)
KAPPA, CMU = 0.41, 0.09
USTAR = KAPPA * UREF / math.log((ZREF + Z0) / Z0)
UC = USTAR / KAPPA * math.log((ZC + Z0) / Z0)   # wind speed at the centroid height


def cone_point(theta, s):
    c, sn = math.cos(math.radians(theta)), math.sin(math.radians(theta))
    r = RM + (RT - RM) * s
    return (r * c, YM + (YT - YM) * s + r * sn, ZM + (ZT - ZM) * s)


def to_world(p, delta):
    x, y, z = p
    X, Y, Z = -z, -x, y                     # local z (mouth facing) -> upwind (-X) at delta = 0
    d = math.radians(delta)
    return (X * math.cos(d) - Y * math.sin(d), X * math.sin(d) + Y * math.cos(d), Z)


def write_stl(path, delta, nt=144, ns=24):
    tris = []
    for i in range(nt):
        for j in range(ns):
            t0, t1 = 360 * i / nt, 360 * (i + 1) / nt
            s0, s1 = j / ns, (j + 1) / ns
            a, b, c, d = (to_world(cone_point(t, s), delta) for t, s in ((t0, s0), (t1, s0), (t1, s1), (t0, s1)))
            tris += [(a, b, c), (a, c, d)]
    with open(path, 'w') as f:
        f.write('solid funnel\n')
        for tri in tris:
            f.write(' facet normal 0 0 0\n  outer loop\n')
            for v in tri: f.write('   vertex %.6f %.6f %.6f\n' % v)
            f.write('  endloop\n endfacet\n')
        f.write('endsolid funnel\n')


HDR = 'FoamFile\n{\n    version 2.0;\n    format ascii;\n    class %s;\n    object %s;\n}\n'


def w(case, rel, cls, obj, body):
    p = os.path.join(case, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w').write(HDR % (cls, obj) + body)


def main():
    case, delta = sys.argv[1], float(sys.argv[2])
    level = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    os.makedirs(os.path.join(case, 'constant/triSurface'), exist_ok=True)
    write_stl(os.path.join(case, 'constant/triSurface/funnel.stl'), delta)
    X0, X1, Y0, Y1, H = -24.0, 56.0, -24.0, 24.0, 24.0
    nx, ny, nz = 64, 38, 19
    w(case, 'system/blockMeshDict', 'dictionary', 'blockMeshDict', f'''
convertToMeters 1;
vertices ( ({X0} {Y0} 0) ({X1} {Y0} 0) ({X1} {Y1} 0) ({X0} {Y1} 0) ({X0} {Y0} {H}) ({X1} {Y0} {H}) ({X1} {Y1} {H}) ({X0} {Y1} {H}) );
blocks ( hex (0 1 2 3 4 5 6 7) ({nx} {ny} {nz}) simpleGrading (1 1 1) );
boundary (
  inlet  {{ type patch; faces ((0 4 7 3)); }}
  outlet {{ type patch; faces ((1 2 6 5)); }}
  ground {{ type wall;  faces ((0 3 2 1)); }}
  top    {{ type patch; faces ((4 5 6 7)); }}
  sides  {{ type patch; faces ((0 1 5 4) (3 7 6 2)); }}
);
''')
    w(case, 'system/snappyHexMeshDict', 'dictionary', 'snappyHexMeshDict', f'''
castellatedMesh true; snap true; addLayers false;
geometry {{
  funnel.stl {{ type triSurfaceMesh; name funnel; }}
  near {{ type searchableBox; min (-5 -5 0); max (5 5 5.2); }}
  wake {{ type searchableBox; min (-8 -8 0); max (20 8 8); }}
  far  {{ type searchableBox; min (-14 -13 0); max (40 13 12); }}
}};
castellatedMeshControls {{
  maxLocalCells 4000000; maxGlobalCells 12000000; minRefinementCells 10;
  maxLoadUnbalance 0.10; nCellsBetweenLevels 3; resolveFeatureAngle 30; allowFreeStandingZoneFaces true;
  features ();
  refinementSurfaces {{
    funnel {{ level ({level} {level}); faceZone funnelZone; faceType baffle; patchInfo {{ type wall; }} }}
  }};
  refinementRegions {{
    near {{ mode inside; levels ((1E15 {level - 2})); }}
    wake {{ mode inside; levels ((1E15 2)); }}
    far  {{ mode inside; levels ((1E15 1)); }}
  }};
  locationInMesh (-20.1 0.13 10.07);
}};
snapControls {{ nSmoothPatch 3; tolerance 2.0; nSolveIter 50; nRelaxIter 5; nFeatureSnapIter 10;
  implicitFeatureSnap true; explicitFeatureSnap false; multiRegionFeatureSnap false; }};
addLayersControls {{ relativeSizes true; layers {{}}; expansionRatio 1.2; finalLayerThickness 0.5; minThickness 0.1;
  nGrow 0; featureAngle 60; nRelaxIter 3; nSmoothSurfaceNormals 1; nSmoothNormals 3; nSmoothThickness 10;
  maxFaceThicknessRatio 0.5; maxThicknessToMedialRatio 0.3; minMedialAxisAngle 90; nBufferCellsNoExtrude 0; nLayerIter 50; }};
meshQualityControls {{ #includeEtc "caseDicts/mesh/generation/meshQualityDict.cfg" }};
mergeTolerance 1e-6;
''')
    w(case, 'system/controlDict', 'dictionary', 'controlDict', f'''
application simpleFoam; startFrom latestTime; startTime 0; stopAt endTime; endTime 3000; deltaT 1;
writeControl timeStep; writeInterval 100; purgeWrite 10; writeFormat ascii; writePrecision 8;
writeCompression off; timeFormat general; timePrecision 6; runTimeModifiable true;
functions {{}}
''')
    w(case, 'system/fvSchemes', 'dictionary', 'fvSchemes', '''
ddtSchemes { default steadyState; }
gradSchemes { default Gauss linear; grad(U) cellLimited Gauss linear 1; }
divSchemes { default none; div(phi,U) bounded Gauss linearUpwind grad(U);
  div(phi,k) bounded Gauss upwind; div(phi,epsilon) bounded Gauss upwind;
  div((nuEff*dev2(T(grad(U))))) Gauss linear; }
laplacianSchemes { default Gauss linear limited corrected 0.5; }
interpolationSchemes { default linear; }
snGradSchemes { default limited corrected 0.5; }
wallDist { method meshWave; }
''')
    w(case, 'system/fvSolution', 'dictionary', 'fvSolution', '''
solvers {
  p { solver GAMG; smoother GaussSeidel; tolerance 1e-7; relTol 0.05; }
  "(U|k|epsilon)" { solver smoothSolver; smoother symGaussSeidel; tolerance 1e-8; relTol 0.1; }
}
SIMPLE { nNonOrthogonalCorrectors 1; consistent true; residualControl { p 1e-5; U 1e-6; "(k|epsilon)" 1e-6; } }
relaxationFactors { equations { U 0.7; ".*" 0.7; } fields { p 0.3; } }
''')
    w(case, 'system/decomposeParDict', 'dictionary', 'decomposeParDict', 'numberOfSubdomains 4; method hierarchical; hierarchicalCoeffs { n (2 2 1); order xyz; }\n')
    w(case, 'constant/transportProperties', 'dictionary', 'transportProperties', 'transportModel Newtonian; nu 1.5e-05;\n')
    w(case, 'constant/turbulenceProperties', 'dictionary', 'turbulenceProperties',
      'simulationType RAS; RAS { RASModel realizableKE; turbulence on; printCoeffs on; }\n')
    abl = f'''flowDir (1 0 0); zDir (0 0 1); Uref {UREF}; Zref {ZREF}; z0 uniform {Z0}; zGround uniform 0; kappa {KAPPA}; Cmu {CMU};'''
    walls = 'ground { type %s; } "funnel.*" { type %s; }'
    w(case, '0/U', 'volVectorField', 'U', f'''
dimensions [0 1 -1 0 0 0 0]; internalField uniform ({UREF} 0 0);
boundaryField {{
  inlet {{ type atmBoundaryLayerInletVelocity; {abl} value uniform ({UREF} 0 0); }}
  outlet {{ type inletOutlet; inletValue uniform (0 0 0); value uniform ({UREF} 0 0); }}
  top {{ type slip; }} sides {{ type slip; }}
  {walls % ('noSlip', 'noSlip')}
}}
''')
    w(case, '0/p', 'volScalarField', 'p', '''
dimensions [0 2 -2 0 0 0 0]; internalField uniform 0;
boundaryField { inlet { type zeroGradient; } outlet { type fixedValue; value uniform 0; }
  top { type slip; } sides { type slip; } ground { type zeroGradient; } "funnel.*" { type zeroGradient; } }
''')
    k0 = USTAR ** 2 / math.sqrt(CMU)
    w(case, '0/k', 'volScalarField', 'k', f'''
dimensions [0 2 -2 0 0 0 0]; internalField uniform {k0:.5f};
boundaryField {{ inlet {{ type atmBoundaryLayerInletK; {abl} value uniform {k0:.5f}; }}
  outlet {{ type inletOutlet; inletValue uniform {k0:.5f}; value uniform {k0:.5f}; }}
  top {{ type slip; }} sides {{ type slip; }}
  ground {{ type kqRWallFunction; value uniform {k0:.5f}; }} "funnel.*" {{ type kqRWallFunction; value uniform {k0:.5f}; }} }}
''')
    e0 = USTAR ** 3 / (KAPPA * (ZREF + Z0))
    w(case, '0/epsilon', 'volScalarField', 'epsilon', f'''
dimensions [0 2 -3 0 0 0 0]; internalField uniform {e0:.6f};
boundaryField {{ inlet {{ type atmBoundaryLayerInletEpsilon; {abl} value uniform {e0:.6f}; }}
  outlet {{ type inletOutlet; inletValue uniform {e0:.6f}; value uniform {e0:.6f}; }}
  top {{ type slip; }} sides {{ type slip; }}
  ground {{ type epsilonWallFunction; value uniform {e0:.6f}; }} "funnel.*" {{ type epsilonWallFunction; value uniform {e0:.6f}; }} }}
''')
    w(case, '0/nut', 'volScalarField', 'nut', f'''
dimensions [0 2 -1 0 0 0 0]; internalField uniform 0;
boundaryField {{ inlet {{ type calculated; value uniform 0; }} outlet {{ type calculated; value uniform 0; }}
  top {{ type calculated; value uniform 0; }} sides {{ type calculated; value uniform 0; }}
  ground {{ type nutkAtmRoughWallFunction; z0 uniform {Z0}; value uniform 0; }}
  "funnel.*" {{ type nutkWallFunction; value uniform 0; }} }}
''')
    open(os.path.join(case, 'case.json'), 'w').write(
        '{"delta": %g, "level": %d, "Af_m2": %.4f, "zc_m": %.4f, "U_centroid": %.4f, "ustar": %.4f}\n' % (delta, level, AF, ZC, UC, USTAR))
    print(f'{case}: delta {delta}, U(zc) = {UC:.3f} m/s, u* = {USTAR:.3f}')


if __name__ == '__main__':
    main()
