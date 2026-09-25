#!/usr/bin/env python3
"""Site wind climate for the Cityside Park funnel.

Downloads hourly wind and writes data/site_wind.json:
  - NCEI ISD 724943 "Treasure Island" (Naval Station, 1983-1996): the only record on the island.
  - NCEI ISD 724930 Oakland airport, 1983-1996 and 2021-2025: bridges the island record to today.
  - NOAA CO-OPS wind at six nearby Bay stations, 2021-2025 (Yerba Buena Island, 9414782, has no wind sensor).

Method A: the island's own daytime observations (7, 10, 13, 16 h, weighted to cover 7 AM-6 PM).
Method B: Oakland 2021-2025 hourly, quantile-mapped to the island by season and hour.
Head height: 10 m -> 1.5 m by a log profile, z0 = 0.0002 m (open water) to 0.005 m (open shore).

Usage: python3 tools/site_wind.py [cache_dir]
"""
import bisect, collections, csv, datetime as dt, json, math, os, statistics as st, sys, time, urllib.request

CACHE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/site_wind_cache'
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'site_wind.json')
KT = 1.15078
MOUTH = 229
FAC = (0.82, 0.75)            # 10 m -> 1.5 m, open water / open shore
MULT = (1.0, 1.2, 1.3, 1.4, 1.5)
W = {7: 2, 10: 3, 13: 3, 16: 3}  # island obs hours, weighted to cover 7..17
NEAR = {7: 7, 8: 7, 9: 10, 10: 10, 11: 10, 12: 13, 13: 13, 14: 13, 15: 16, 16: 16, 17: 16}
SECS = 'N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW'.split()
COOPS = {'9414290': ('San Francisco (Crissy Field)', 24.2), '9414311': ('SF Pier 1', 53.1),
         '9414776': ('Oakland Berth 34', 25.0), '9414769': ('Oakland Middle Harbor', 22.1),
         '9414750': ('Alameda', 22.5), '9414863': ('Richmond', 23.5)}
OLD, NEW = (1983, 1984, 1985, 1986, 1987, 1992, 1993, 1995, 1996), (2021, 2022, 2023, 2024, 2025)


def get(url, path):
    if not os.path.exists(path):
        for i in range(4):
            try:
                urllib.request.urlretrieve(url, path); break
            except Exception:
                time.sleep(2 ** (i + 1))
    return path


def isd(station, years, types=('FM-15', 'SMARS', 'FM-16', 'SAO')):
    o = {}
    for y in years:
        p = get(f'https://www.ncei.noaa.gov/data/global-hourly/access/{y}/{station}.csv', f'{CACHE}/{station}_{y}.csv')
        if open(p).read(1) != '"': continue
        for r in csv.DictReader(open(p)):
            if r['REPORT_TYPE'].strip() not in types: continue
            w = r['WND'].split(',')
            if w[3] == '9999' or w[4] not in '0145': continue
            t = dt.datetime.fromisoformat(r['DATE']) - dt.timedelta(hours=8)  # UTC -> PST
            if t.minute >= 30: t += dt.timedelta(hours=1)
            o[t.replace(minute=0, second=0)] = (int(w[0]), int(w[3]) / 10 * 2.23694)
    return o


def coops(sid):
    o = {}
    for y in NEW:
        url = ('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=wind&interval=h&units=english'
               f'&time_zone=lst&format=json&application=cityside_funnel&station={sid}&begin_date={y}0101&end_date={y}1231%2023:59')
        for r in json.load(open(get(url, f'{CACHE}/{sid}_{y}.json'))).get('data', []):
            try: o[dt.datetime.fromisoformat(r['t'])] = (float(r['d']), float(r['s']) * KT)
            except ValueError: pass
    return o


def off_axis(d): return abs((d - MOUTH + 180) % 360 - 180)
def warm(m): return 4 <= m <= 9
def pct(v, q): return v[min(len(v) - 1, int(len(v) * q))]


def main():
    os.makedirs(CACHE, exist_ok=True)
    ti = isd('72494399999', range(1983, 1997))
    oak_old, oak_new = isd('72493023230', OLD), isd('72493023230', NEW)
    out = {'generated': dt.date.today().isoformat(), 'head_factor_10m_to_1p5m': FAC, 'mouth_azimuth': MOUTH}

    # Method A: island obs
    def exc_a(fac, mult, directional=False):
        num = 0
        for h, w in W.items():
            v = [(d, s) for t, (d, s) in ti.items() if t.hour == h]
            m = lambda d: mult if (not directional or (d != 999 and off_axis(d) <= 60)) else 1.0
            num += w * sum(1 for d, s in v if s * fac * m(d) > 11) / len(v)
        return num / sum(W.values())
    out['A_exceed_11mph_7to18'] = {str(m): [exc_a(f, m) for f in FAC] for m in MULT}
    out['A_exceed_11mph_7to18_only_wind_into_mouth'] = {str(m): [exc_a(f, m, True) for f in FAC] for m in MULT}

    # Method B: quantile-map Oakland today onto the island
    maps = {}
    for wm in (True, False):
        for h in W:
            a = sorted(s for t, (d, s) in ti.items() if t.hour == h and warm(t.month) == wm)
            b = sorted(oak_old[t][1] for t in ti if t in oak_old and t.hour == h and warm(t.month) == wm)
            maps[(wm, h)] = (b, a)
    def qmap(s, key):
        b, a = maps[key]; return a[min(len(a) - 1, int(bisect.bisect_left(b, s) / len(b) * len(a)))]
    syn = {t: qmap(s, (warm(t.month), NEAR.get(t.hour, 7 if t.hour < 7 else 16))) for t, (d, s) in oak_new.items()}
    day = {t: s for t, s in syn.items() if 7 <= t.hour < 18}
    out['B_exceed_11mph_7to18'] = {str(m): [sum(1 for s in day.values() if s * f * m > 11) / len(day) for f in FAC] for m in MULT}
    ny = len(syn) / 8766
    out['B_hours_per_year_over_26mph_head'] = {str(m): [round(sum(1 for s in syn.values() if s * f * m > 26) / ny) for f in FAC] for m in MULT}
    mh = collections.defaultdict(list)
    for t, s in day.items(): mh[(t.month, t.hour)].append(s)
    out['B_mean_10m_mph_by_month_hour'] = {f'{m}-{h}': round(st.mean(v), 1) for (m, h), v in sorted(mh.items())}
    mm = collections.defaultdict(list)
    for t, s in day.items(): mm[t.month].append(s)
    out['B_daytime_mean_10m_mph_by_month'] = {m: round(st.mean(v), 1) for m, v in sorted(mm.items())}

    # Island record: rose, month, hour, summer afternoons, extremes
    dday = [(d, s) for t, (d, s) in ti.items() if t.hour in W]
    c = collections.Counter(SECS[int(((d + 11.25) % 360) // 22.5)] for d, s in dday if s >= 2 and d != 999)
    out['A_rose_daytime_pct'] = {k: round(100 * c[k] / len(dday), 1) for k in SECS}
    out['A_calm_daytime_pct'] = round(100 * sum(1 for d, s in dday if s < 2 or d == 999) / len(dday), 1)
    out['A_daytime_within_45deg_of_mouth_pct'] = round(100 * sum(1 for d, s in dday if s >= 2 and d != 999 and off_axis(d) <= 45) / len(dday), 1)
    tm = collections.defaultdict(list); th = collections.defaultdict(list)
    for t, (d, s) in ti.items():
        th[t.hour].append(s)
        if t.hour in W: tm[t.month].append(s)
    out['A_daytime_mean_10m_mph_by_month'] = {m: round(st.mean(v), 1) for m, v in sorted(tm.items())}
    out['A_mean_10m_mph_by_hour'] = {h: round(st.mean(v), 1) for h, v in sorted(th.items()) if len(v) > 100}
    sa = sorted(s for t, (d, s) in ti.items() if t.month in (6, 7, 8) and t.hour in (13, 16))
    out['A_summer_afternoon_10m_mph_p10_p50_p90'] = [round(pct(sa, q), 1) for q in (.1, .5, .9)]
    sm = sorted(s for t, (d, s) in ti.items() if t.month in (6, 7, 8) and t.hour == 7)
    out['A_summer_7am_10m_mph_p50_p90'] = [round(pct(sm, q), 1) for q in (.5, .9)]
    allv = sorted(s for d, s in ti.values())
    out['A_10m_mph_p99_max'] = [round(pct(allv, .99), 1), round(allv[-1], 1)]

    # Era and site checks
    def mean_at(d): return st.mean(s for t, (_, s) in d.items() if t.hour in W)
    out['oakland_mean_mph_7_10_13_16h'] = {'1983-1996': round(mean_at(oak_old), 2), '2021-2025': round(mean_at(oak_new), 2)}
    pr = [(ti[t][1], oak_old[t][1]) for t in ti if t in oak_old and t.hour in W]
    out['ratio_to_oakland'] = {'Treasure Island 1983-1996': round(sum(a for a, _ in pr) / sum(b for _, b in pr), 2)}
    stations = {}
    for sid, (name, zft) in COOPS.items():
        co = coops(sid)
        pr = [(co[t][1], oak_new[t][1]) for t in co if t in oak_new and t.hour in W]
        out['ratio_to_oakland'][f'{name} {sid}'] = round(sum(a for a, _ in pr) / sum(b for _, b in pr), 2)
        cd = [(d, s) for t, (d, s) in co.items() if 7 <= t.hour < 18]
        fac = [math.log(1.5 / z) / math.log(zft * 0.3048 / z) for z in (0.0002, 0.005)]
        stations[sid] = {'name': name, 'sensor_ft': zft, 'hours': len(co),
                         'exceed_11mph_7to18_open': [sum(1 for d, s in cd if s * f > 11) / len(cd) for f in fac],
                         'exceed_11mph_7to18_x1.5': [sum(1 for d, s in cd if s * f * 1.5 > 11) / len(cd) for f in fac]}
    out['coops_2021_2025'] = stations
    out['n'] = {'island_obs': len(ti), 'island_daytime_obs': len(dday), 'oakland_2021_2025_daytime_hours': len(day)}
    json.dump(out, open(OUT, 'w'), indent=1)
    print(json.dumps({k: out[k] for k in ('A_exceed_11mph_7to18', 'B_exceed_11mph_7to18', 'ratio_to_oakland', 'n')}, indent=1))


if __name__ == '__main__':
    main()
