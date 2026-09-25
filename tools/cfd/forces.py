#!/usr/bin/env python3
"""Integrate pressure (and wall shear, if written) on the funnel's baffle patches.

Reads ASCII OpenFOAM mesh and field files directly (serial case or processor* dirs), because the
forces function object fails in the Debian OpenFOAM v1912 build. Force on the shell = sum over
its boundary faces of rho * p * Sf (Sf points out of the fluid, into the shell), plus shear.

Usage: forces.py <case_dir> [time]   -> prints JSON with force, moment about the pad centre, Cf
"""
import glob, json, math, os, re, sys

RHO = 1.225
NUM = r'[-+0-9.eE]+'


def read_list(path, kind):
    t = open(path).read()
    t = t[t.index('}', t.index('FoamFile')) + 1:]
    m = re.search(r'\n(\d+)\s*\n\(', t)
    n, body = int(m.group(1)), t[m.end():]
    if kind == 'vec':
        v = re.findall(r'\((%s) (%s) (%s)\)' % (NUM, NUM, NUM), body[:body.rindex(')')])[:n]
        return [tuple(map(float, x)) for x in v]
    if kind == 'faces':
        return [tuple(map(int, f.split())) for f in re.findall(r'\d+\(([\d ]+)\)', body)[:n]]


def patches(d):
    t = open(os.path.join(d, 'constant/polyMesh/boundary')).read()
    out = {}
    for name, blk in re.findall(r'\n\s*(\w+)\s*\n\s*\{([^}]*)\}', t):
        nf = re.search(r'nFaces\s+(\d+)', blk); sf = re.search(r'startFace\s+(\d+)', blk)
        if nf and sf: out[name] = (int(sf.group(1)), int(nf.group(1)))
    return out


def internal_scalar(path):
    t = open(path).read()
    i = t.index('internalField'); m = re.search(r'nonuniform\s+List<scalar>\s*\n?(\d+)\s*\n?\(', t[i:])
    body = t[i + m.end():]
    return [float(x) for x in body[:body.index(')')].split()]


def read_labels(path):
    t = open(path).read()
    t = t[t.index('}', t.index('FoamFile')) + 1:]
    m = re.search(r'\n(\d+)\s*\n\(', t)
    return [int(x) for x in t[m.end():t.index(')', m.end())].split()]


def patch_field(path, patch, n, vector=False):
    t = open(path).read()
    i = t.index('boundaryField'); j = t.index(patch, i)
    blk = t[j:]
    blk = blk[:blk.index('}')]
    m = re.search(r'value\s+(uniform\s+(\([^)]*\)|%s)|nonuniform\s+List<\w+>\s*\n?(\d+)\s*\n?\()' % NUM, blk)
    if m is None: return None
    if m.group(1).startswith('uniform'):
        v = m.group(2) or m.group(1).split()[1]
        val = tuple(map(float, v.strip('()').split())) if vector else float(v)
        return [val] * n
    body = blk[m.end():]
    if vector:
        return [tuple(map(float, x)) for x in re.findall(r'\((%s) (%s) (%s)\)' % (NUM, NUM, NUM), body)[:n]]
    return [float(x) for x in re.findall(NUM, body[:body.index(')')])[:n]]


def integrate(d, time):
    pts = read_list(os.path.join(d, 'constant/polyMesh/points'), 'vec')
    faces = read_list(os.path.join(d, 'constant/polyMesh/faces'), 'faces')
    P = patches(d)
    F = [0.0, 0.0, 0.0]; M = [0.0, 0.0, 0.0]; area = 0.0; cache = {}
    for name in ('funnel', 'funnel_slave'):
        if name not in P: continue
        s0, n = P[name]
        if n == 0: continue
        p = patch_field(os.path.join(d, time, 'p'), name, n)
        if p is None:  # zeroGradient: face value = owner cell value
            if cache.get('pin') is None:
                cache['pin'] = internal_scalar(os.path.join(d, time, 'p'))
                cache['own'] = read_labels(os.path.join(d, 'constant/polyMesh/owner'))
            p = [cache['pin'][cache['own'][s0 + k]] for k in range(n)]
        tau = None
        if os.path.exists(os.path.join(d, time, 'wallShearStress')):
            tau = patch_field(os.path.join(d, time, 'wallShearStress'), name, n, vector=True)
        for k in range(n):
            f = faces[s0 + k]; v = [pts[i] for i in f]
            c = [sum(x[a] for x in v) / len(v) for a in range(3)]
            S = [0.0, 0.0, 0.0]
            for a in range(len(v)):
                p1, p2 = v[a], v[(a + 1) % len(v)]
                S[0] += 0.5 * ((p1[1] - c[1]) * (p2[2] - c[2]) - (p1[2] - c[2]) * (p2[1] - c[1]))
                S[1] += 0.5 * ((p1[2] - c[2]) * (p2[0] - c[0]) - (p1[0] - c[0]) * (p2[2] - c[2]))
                S[2] += 0.5 * ((p1[0] - c[0]) * (p2[1] - c[1]) - (p1[1] - c[1]) * (p2[0] - c[0]))
            dF = [RHO * p[k] * S[a] for a in range(3)]
            if tau:  # wallShearStress = force per area on the fluid; the shell feels the opposite
                mag = math.sqrt(sum(x * x for x in S)); dF = [dF[a] - RHO * tau[k][a] * mag for a in range(3)]
            area += math.sqrt(sum(x * x for x in S))
            for a in range(3): F[a] += dF[a]
            M[0] += c[1] * dF[2] - c[2] * dF[1]; M[1] += c[2] * dF[0] - c[0] * dF[2]; M[2] += c[0] * dF[1] - c[1] * dF[0]
    return F, M, area


def main():
    case = sys.argv[1]
    procs = sorted(glob.glob(os.path.join(case, 'processor*'))) or [case]
    times = sorted((t for t in os.listdir(procs[0]) if re.fullmatch(r'[0-9.]+', t) and t != '0'), key=float)
    time = sys.argv[2] if len(sys.argv) > 2 else times[-1]
    F = [0.0] * 3; M = [0.0] * 3; A = 0.0
    for d in procs:
        f, m, a = integrate(d, time)
        F = [F[i] + f[i] for i in range(3)]; M = [M[i] + m[i] for i in range(3)]; A += a
    info = json.load(open(os.path.join(case, 'case.json')))
    q = 0.5 * RHO * info['U_centroid'] ** 2
    out = {'time': float(time), 'delta': info['delta'], 'Fx_N': F[0], 'Fy_N': F[1], 'Fz_N': F[2],
           'Fh_N': math.hypot(F[0], F[1]), 'Mh_Nm': math.hypot(M[0], M[1]),
           'Cf_x': F[0] / (q * info['Af_m2']), 'Cf_h': math.hypot(F[0], F[1]) / (q * info['Af_m2']),
           'lever_m': math.hypot(M[0], M[1]) / max(1e-9, math.hypot(F[0], F[1])), 'wetted_area_m2': A / 2}
    print(json.dumps(out))


if __name__ == '__main__':
    main()
