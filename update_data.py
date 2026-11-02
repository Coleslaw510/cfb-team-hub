#!/usr/bin/env python3
"""Rebuild data/teams.json for the CFB Team Hub (FBS, one season).

Sources (all public, no keys):
* ESPN standings (conference membership, overall / conference / home / away records, streak):
    site.api.espn.com/apis/v2/sports/football/college-football/standings
* ESPN FPI (power index, offense/defense/special teams components, efficiencies, SOS, SOR, game control, projections):
    sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/<S>/powerindex
* ESPN team schedules and results: site.api.espn.com/.../teams/<id>/schedule?season=<S>
* ESPN polls (AP, Coaches, CFP when published): site.api.espn.com/.../rankings
* NCAA.com official FBS team statistics (scoring, yardage, 3rd down, red zone, turnovers, sacks, penalties ...)
* SP+ (Bill Connelly, ESPN): the weekly "SP+ rankings for all FBS teams" article.

Usage:  python3 update_data.py [--season 2026] [--offline]
"""
import argparse, json, os, re, sys, time, math, unicodedata, datetime as dt, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup

UA = {"User-Agent": "Mozilla/5.0 cfb-team-hub"}
SITE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football"
CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football"
NCAA = "https://www.ncaa.com/stats/football/fbs/current/team"
SP_URL = "https://www.espn.com/college-football/story/_/id/49868647/2026-college-football-sp+-rankings-all-138-fbs-teams"
OFFLINE = False

def fetch(url, path, max_age_h=3, binary=False):
    if os.path.exists(path) and (OFFLINE or time.time() - os.path.getmtime(path) < max_age_h * 3600):
        return open(path, "rb").read()
    last = None
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                data = r.read()
            if len(data) < 50: raise RuntimeError(f"empty body ({r.status})")
            os.makedirs(os.path.dirname(path), exist_ok=True); open(path, "wb").write(data); return data
        except Exception as e:
            last = e; time.sleep(2 * (i + 1))
    if os.path.exists(path):
        print(f"  using cached {path} ({last})", file=sys.stderr); return open(path, "rb").read()
    raise RuntimeError(f"download failed {url}: {last}")

def jget(url, path, **kw): return json.loads(fetch(url, path, **kw))

def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower().replace("&", " and ")
    s = re.sub(r"\(([a-z]+)\)", r" \1 ", s)
    s = re.sub(r"[.'’]", "", s); s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    rep = {"st": "state", "n": "north", "s": "south", "w": "west", "e": "east", "c": "central", "so": "southern", "va": "virginia",
           "fla": "florida", "intl": "international", "miss": "mississippi", "ga": "georgia", "ky": "kentucky", "tenn": "tennessee",
           "la": "louisiana", "ill": "illinois", "mich": "michigan", "car": "carolina", "ala": "alabama", "ark": "arkansas", "u": "university"}
    return " ".join(rep.get(w, w) for w in s.split())

# names that other sources spell differently from ESPN's team.location (normalized form -> ESPN id), filled in from build logs
ALIAS = {
    "miami fl": "2390", "miami": "2390", "miami oh": "193", "miami ohio": "193", "ole miss": "145", "mississippi": "145",
    "app state": "2026", "appalachian state": "2026", "uconn": "41", "connecticut": "41", "umass": "113", "massachusetts": "113",
    "lsu": "99", "smu": "2567", "tcu": "2628", "ucf": "2116", "byu": "252", "usc": "30", "southern california": "30", "ucla": "26",
    "unlv": "2439", "utep": "2638", "utsa": "2636", "uab": "5", "fiu": "2229", "florida international": "2229", "fau": "2226",
    "florida atlantic": "2226", "jmu": "256", "james madison": "256", "niu": "2459", "northern illinois": "2459", "wku": "98",
    "western kentucky": "98", "ulm": "2433", "louisiana monroe": "2433", "ul monroe": "2433", "louisiana": "309", "louisiana lafayette": "309",
    "ul lafayette": "309", "southern miss": "2572", "southern mississippi": "2572", "hawaii": "62", "san jose state": "23",
    "texas am": "245", "texas and am": "245", "nc state": "152", "north carolina state": "152", "pitt": "221", "pittsburgh": "221",
    "army": "349", "army west point": "349", "navy": "2426", "air force": "2005", "georgia tech": "59", "virginia tech": "259",
    "middle tennessee": "2393", "mtsu": "2393", "middle tennessee state": "2393", "central michigan": "2117", "eastern michigan": "2199",
    "western michigan": "2711", "ball state": "2050", "bowling green": "189", "kent state": "2309", "sam houston": "2534",
    "sam houston state": "2534", "kennesaw state": "338", "jacksonville state": "55", "liberty": "2335", "coastal carolina": "324",
    "georgia southern": "290", "georgia state": "2247", "south alabama": "6", "troy": "2653", "texas state": "326", "old dominion": "295",
    "marshall": "276", "arkansas state": "2032", "new mexico state": "166", "nmsu": "166", "fresno state": "278", "boise state": "68",
    "colorado state": "36", "utah state": "328", "san diego state": "21", "sdsu": "21", "wyoming": "2751", "nevada": "2440",
    "new mexico": "167", "north texas": "249", "unt": "249", "rice": "242", "tulane": "2655", "tulsa": "202", "memphis": "235",
    "east carolina": "151", "ecu": "151", "temple": "218", "charlotte": "2429", "south florida": "58", "usf": "58",
    "florida state": "52", "fsu": "52", "delaware": "48", "missouri state": "2623", "north dakota state": "2449", "ndsu": "2449",
    "sacramento state": "16", "sac state": "16", "ul": "309",
    "boston coll": "103", "boston college": "103", "coastal caro": "324", "kennesaw": "338", "wash state": "265", "washington state": "265", "north mex state": "166",
}

def team_index(teams):
    ix = {}
    for t in teams.values():
        for k in (t["loc"], t["short"], t["name"], t["abbr"], t["display"]):
            if k: ix.setdefault(norm(k), t["id"])
    for k, v in ALIAS.items():
        if v in teams: ix[norm(k)] = v
    return ix

def match(ix, name):
    n = norm(name)
    if n in ix: return ix[n]
    n2 = re.sub(r"\buniversity\b|\bof\b|\bthe\b", "", n).strip(); n2 = re.sub(r"\s+", " ", n2)
    return ix.get(n2)

# ---------------------------------------------------------------------------------------------------------------
NCAA_STATS = {  # NCAA stat id -> {our_key: column header, or (numerator, denominator) columns}
    27: {"ppg": "PPG"}, 28: {"opp_ppg": "Avg"},
    21: {"ypg": "YPG", "ypp": "Yds/Play"}, 22: {"opp_ypg": "YPG", "opp_ypp": "Yds/Play"},
    25: {"pass_ypg": "YPG"}, 695: {"opp_pass_ypg": "YPG"}, 23: {"rush_ypg": "YPG", "ypc": "Yds/Rush"}, 24: {"opp_rush_ypg": "YPG", "opp_ypc": "Yds/Rush"},
    29: {"to_margin": "Margin", "to_margin_pg": "Avg", "takeaways": "Turn Gain", "giveaways": "Turn Lost"},
    699: {"third_pct": "Pct"}, 701: {"opp_third_pct": "Pct"}, 700: {"fourth_pct": "Pct"},
    703: {"rz_pct": "Pct", "rz_att": "RZAtt"}, 704: {"opp_rz_pct": "Pct"},
    466: {"sacks": "Sacks", "sacks_pg": "Avg"}, 468: {"sacks_allowed": "Opp Sacks", "sacks_allowed_pg": "Avg"},
    467: {"tfl_pg": "TFLPG"}, 697: {"pen_pg": "PenPerGame"}, 698: {"pen_yds_pg": "YPG"},
    465: {"pass_eff": "Pass Eff"}, 40: {"opp_pass_eff": "Pass Eff"}, 705: {"top": ("TOP", "G")}, 98: {"net_punt": "Net Yds"},
}

def ncaa_table(sid):
    rows, hdr = [], None
    for page in range(1, 6):
        url = f"{NCAA}/{sid}" + (f"/p{page}" if page > 1 else "")
        try: html = fetch(url, f"raw/ncaa/{sid}_p{page}.html", max_age_h=6)
        except Exception as e:
            if page == 1: raise
            break
        s = BeautifulSoup(html, "lxml"); t = s.find("table")
        if not t: break
        h = [th.get_text(strip=True) for th in t.find_all("th")]; hdr = hdr or h
        got = [[td.get_text(strip=True) for td in tr.find_all("td")] for tr in t.find_all("tr")[1:]]
        got = [g for g in got if len(g) == len(h)]
        if not got: break
        rows += got
        if not s.select_one(f'a[href$="/team/{sid}/p{page + 1}"]'): break
        time.sleep(0.6)
    return hdr, rows

def num(x):
    x = x.replace(",", "").strip()
    if re.fullmatch(r"\d+:\d+", x): m, s_ = x.split(":"); return int(m) + int(s_) / 60
    try: return float(x)
    except ValueError: return None

def parse_sp(html, teams, ix):
    s = BeautifulSoup(html, "lxml")
    h1 = s.find("h1"); title = h1.get_text(" ", strip=True) if h1 else ""
    ts = s.select_one("span.timestamp") or s.find("time")
    when = ts.get_text(" ", strip=True) if ts else ""
    m = re.search(r'"datePublished"\s*:\s*"([^"]+)"', html.decode("utf-8", "ignore") if isinstance(html, bytes) else html)
    mod = re.search(r'"dateModified"\s*:\s*"([^"]+)"', html.decode("utf-8", "ignore") if isinstance(html, bytes) else html)
    out, unmatched = {}, []
    for tr in s.find_all("tr"):
        c = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
        if len(c) < 5: continue
        mt = re.match(r"(\d+)\.\s*(.+?)\s*\((\d+)-(\d+)\)$", c[0])
        if not mt: continue
        rk, name = int(mt.group(1)), mt.group(2)
        def vr(x):
            m_ = re.match(r"(-?[\d.]+)\s*\((\d+)\)", x); return (float(m_.group(1)), int(m_.group(2))) if m_ else (None, None)
        tid = match(ix, name)
        if not tid: unmatched.append(name); continue
        o, d, st = vr(c[2]), vr(c[3]), vr(c[4])
        out[tid] = dict(rk=rk, r=float(c[1]), o=o[0], ork=o[1], d=d[0], drk=d[1], st=st[0], strk=st[1], chg=c[5] if len(c) > 5 else None)
    return dict(title=title, when=when, published=m.group(1) if m else None, modified=mod.group(1) if mod else None, url=SP_URL), out, unmatched

def main():
    global OFFLINE
    ap = argparse.ArgumentParser(); ap.add_argument("--season", type=int, default=2026); ap.add_argument("--offline", action="store_true")
    a = ap.parse_args(); S = a.season; OFFLINE = a.offline
    os.makedirs("raw", exist_ok=True); os.makedirs("data", exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc)

    # ---- teams, conferences, records (standings) ----
    st = jget(f"https://site.api.espn.com/apis/v2/sports/football/college-football/standings?season={S}&group=80&level=3", "raw/standings.json")
    teams = {}
    for conf in st["children"]:
        entries = conf["standings"]["entries"] if "standings" in conf else [e for c in conf.get("children", []) for e in c["standings"]["entries"]]
        for e in entries:
            t = e["team"]; sv = {}
            for x in e["stats"]:
                sv[x.get("type")] = x.get("summary") or x.get("displayValue")
            tid = str(t["id"])
            teams[tid] = dict(id=tid, display=t.get("displayName"), loc=t.get("location"), name=t.get("name"), short=t.get("shortDisplayName"),
                              abbr=t.get("abbreviation"), conf=conf.get("abbreviation") or conf["name"], confName=conf["name"],
                              rec=dict(o=sv.get("total"), c=sv.get("vsconf"), h=sv.get("homerecord"), a=sv.get("awayrecord"), stk=sv.get("streak"),
                                       pf=num(sv.get("pointsfor") or "") , pa=num(sv.get("pointsagainst") or ""),
                                       ap=sv.get("vsaprankedteams")))
    print(f"{len(teams)} FBS teams in {len(st['children'])} conferences")
    # team meta (logos, colors)
    tl = jget(f"{SITE}/teams?limit=1000", "raw/teams_list.json")
    for sp_ in tl["sports"][0]["leagues"][0]["teams"]:
        t = sp_["team"]; tid = str(t["id"])
        if tid in teams:
            teams[tid].update(color=t.get("color"), alt=t.get("alternateColor"), logo=(t.get("logos") or [{}])[0].get("href"),
                              dark=next((l["href"] for l in t.get("logos", []) if "dark" in l.get("rel", [])), None))
    for tid, t in teams.items():  # ESPN CDN logo paths by team id as a fallback
        t.setdefault("logo", f"https://a.espncdn.com/i/teamlogos/ncaa/500/{tid}.png"); t["logo"] = t["logo"] or f"https://a.espncdn.com/i/teamlogos/ncaa/500/{tid}.png"
        t["dark"] = t.get("dark") or f"https://a.espncdn.com/i/teamlogos/ncaa/500-dark/{tid}.png"
    ix = team_index(teams)

    # ---- FPI ----
    pi = jget(f"{CORE}/seasons/{S}/powerindex?limit=300", "raw/powerindex.json")
    fpi_updated = None
    for it in pi["items"]:
        tid = re.search(r"/teams/(\d+)", it["team"]["$ref"]).group(1)
        if tid not in teams: continue
        v = {x["name"]: x.get("value") for x in it.get("predictives", []) + it.get("efficiencies", [])}
        fpi_updated = it.get("lastUpdated") or fpi_updated
        teams[tid]["fpi"] = dict(
            fpi=v.get("fpi"), rk=v.get("fpirank"), chg=v.get("rankchange7days"), off=v.get("epaoffense"), dfn=v.get("epadefense"), st=v.get("epaspecialteams"),
            eff=v.get("totefficiency"), effrk=v.get("totefficiencyrank"), offeff=v.get("offefficiency"), offeffrk=v.get("offefficiencyrank"),
            defeff=v.get("defefficiency"), defeffrk=v.get("defefficiencyrank"), steff=v.get("stefficiency"), steffrk=v.get("stefficiencyrank"),
            sor=v.get("accomplishment"), sorrk=v.get("accomplishmentrank"), sosrk=v.get("avgsosrank"), remsosrk=v.get("sosremainingrank"),
            gc=v.get("gamecontrol"), gcrk=v.get("gamecontrolrank"), projw=v.get("projectedw"), projl=v.get("projectedl"),
            winout=v.get("probwinout"), winconf=v.get("probwinconf"), playoff=v.get("probmakeplayoffs"), title=v.get("probwintitle"),
            six=v.get("prob6wins"), apcfp=v.get("APRank/CFPRank"))
    # FPI component ranks (ESPN publishes the values; ranks among FBS computed here)
    for key in ("off", "dfn", "st"):
        vals = sorted([t["fpi"][key] for t in teams.values() if t.get("fpi") and t["fpi"].get(key) is not None], reverse=True)
        for t in teams.values():
            if t.get("fpi") and t["fpi"].get(key) is not None: t["fpi"][key + "rk"] = 1 + sum(1 for x in vals if x > t["fpi"][key] + 1e-9)
    print("FPI:", sum(1 for t in teams.values() if t.get("fpi")), "teams; updated", fpi_updated)

    # ---- polls ----
    rk = jget(f"{SITE}/rankings?season={S}", "raw/rankings.json")
    polls = {}
    for r in rk.get("rankings", []):
        code = {"ap": "ap", "usa": "coaches", "cfp": "cfp"}.get(r.get("type"), r.get("type"))
        polls[code] = dict(name=r.get("name"), headline=r.get("headline"), date=r.get("date"), week=(r.get("occurrence") or {}).get("displayValue"))
        for x in r.get("ranks", []):
            tid = str(x["team"]["id"])
            if tid in teams: teams[tid].setdefault("poll", {})[code] = x["current"]
    print("polls:", list(polls))

    # ---- schedules ----
    def sched(tid):
        return tid, jget(f"{SITE}/teams/{tid}/schedule?season={S}&seasontype=2", f"raw/sched/{tid}.json")
    with ThreadPoolExecutor(8) as ex: scheds = dict(ex.map(sched, teams))
    # postseason (conference title games, bowls, CFP) when they exist
    def sched_post(tid):
        try: return tid, jget(f"{SITE}/teams/{tid}/schedule?season={S}&seasontype=3", f"raw/sched/{tid}_post.json")
        except Exception: return tid, {"events": []}
    with ThreadPoolExecutor(8) as ex: posts = dict(ex.map(sched_post, teams))
    last_final = None
    for tid, sc in scheds.items():
        games = []
        for e in sc.get("events", []) + posts.get(tid, {}).get("events", []):
            c = e["competitions"][0]; comp = c["competitors"]
            me = next((x for x in comp if str(x["team"]["id"]) == tid), None); op = next((x for x in comp if str(x["team"]["id"]) != tid), None)
            if not me or not op: continue
            done = c["status"]["type"].get("completed"); stname = c["status"]["type"].get("name")
            g = dict(id=e["id"], d=e["date"], wk=(e.get("week") or {}).get("number"), st=e.get("seasonType", {}).get("type"),
                     o=str(op["team"]["id"]), on=op["team"].get("displayName"), os=op["team"].get("shortDisplayName") or op["team"].get("location"),
                     ol=((op["team"].get("logos") or [{}])[0]).get("href"), ha="n" if c.get("neutralSite") else ("h" if me["homeAway"] == "home" else "a"),
                     cg=bool(c.get("conferenceCompetition")), done=bool(done), tbd=c.get("timeValid") is False, canc=stname in ("STATUS_CANCELED", "STATUS_POSTPONED"),
                     orank=(op.get("curatedRank") or {}).get("current"), note=(e.get("competitions")[0].get("notes") or [{}])[0].get("headline") if c.get("notes") else None)
            if g["orank"] == 99: g["orank"] = None
            if done:
                us, them = num((me.get("score") or {}).get("displayValue", "")), num((op.get("score") or {}).get("displayValue", ""))
                g.update(us=us, them=them, res="W" if me.get("winner") else ("L" if op.get("winner") else "T"))
                last_final = max(last_final or e["date"], e["date"])
            games.append(g)
        games.sort(key=lambda g: g["d"]); teams[tid]["sched"] = games

    # ---- NCAA team stats ----
    stats_src = {}
    for sid, cols in NCAA_STATS.items():
        try: hdr, rows = ncaa_table(sid)
        except Exception as e: print("NCAA stat", sid, "failed:", e, file=sys.stderr); continue
        ti = hdr.index("Team"); gi = hdr.index("G") if "G" in hdr else None; miss = []
        for r in rows:
            tid = match(ix, r[ti])
            if not tid: miss.append(r[ti]); continue
            for key, col in cols.items():
                if isinstance(col, tuple):
                    n_, d_ = num(r[hdr.index(col[0])]), num(r[hdr.index(col[1])])
                    teams[tid].setdefault("s", {})[key] = round(n_ / d_, 2) if n_ is not None and d_ else None
                elif col in hdr: teams[tid].setdefault("s", {})[key] = num(r[hdr.index(col)])
                else: print(f"  NCAA {sid}: no column {col}", file=sys.stderr)
            if gi is not None: teams[tid].setdefault("s", {})["g_ncaa"] = num(r[gi])
        stats_src[sid] = dict(rows=len(rows), unmatched=miss, hdr=hdr)
        if miss: print(f"  NCAA {sid}: unmatched {miss}", file=sys.stderr)
    # derived from ESPN results: point differential per game
    for t in teams.values():
        fin = [g for g in t["sched"] if g["done"] and g["st"] == 2]
        t["g"] = len(fin)
        if fin:
            t.setdefault("s", {})["margin_pg"] = round(sum(g["us"] - g["them"] for g in fin) / len(fin), 2)

    # ---- SP+ ----
    sp_meta, sp_unmatched = None, []
    try:
        html = fetch(SP_URL, "raw/sp_plus.html", max_age_h=6)
        sp_meta, sp, sp_unmatched = parse_sp(html, teams, ix)
        for tid, v in sp.items(): teams[tid]["sp"] = v
        print(f"SP+: {len(sp)} teams matched; unmatched: {sp_unmatched}")
    except Exception as e:
        print("SP+ unavailable:", e, file=sys.stderr)

    # ---- stat ranks / percentiles among FBS ----
    STATS = [  # key, label, higher_is_better, fmt, category, description
        ("ppg", "Points / game", 1, "f1", "Scoring"), ("opp_ppg", "Points allowed / game", 0, "f1", "Scoring"), ("margin_pg", "Point margin / game", 1, "f1", "Scoring"),
        ("ypg", "Total yards / game", 1, "f1", "Offense"), ("ypp", "Yards / play", 1, "f2", "Offense"), ("pass_ypg", "Pass yards / game", 1, "f1", "Offense"),
        ("rush_ypg", "Rush yards / game", 1, "f1", "Offense"), ("ypc", "Yards / carry", 1, "f2", "Offense"), ("pass_eff", "Passing efficiency", 1, "f1", "Offense"),
        ("third_pct", "3rd-down conversion %", 1, "pct", "Offense"), ("fourth_pct", "4th-down conversion %", 1, "pct", "Offense"),
        ("rz_pct", "Red-zone scoring %", 1, "pct", "Offense"), ("sacks_allowed_pg", "Sacks allowed / game", 0, "f2", "Offense"),
        ("opp_ypg", "Yards allowed / game", 0, "f1", "Defense"), ("opp_ypp", "Yards / play allowed", 0, "f2", "Defense"),
        ("opp_pass_ypg", "Pass yards allowed / game", 0, "f1", "Defense"), ("opp_rush_ypg", "Rush yards allowed / game", 0, "f1", "Defense"),
        ("opp_ypc", "Yards / carry allowed", 0, "f2", "Defense"), ("opp_pass_eff", "Pass efficiency allowed", 0, "f1", "Defense"),
        ("opp_third_pct", "Opp. 3rd-down %", 0, "pct", "Defense"), ("opp_rz_pct", "Opp. red-zone scoring %", 0, "pct", "Defense"),
        ("sacks", "Sacks", 1, "int", "Defense"), ("sacks_pg", "Sacks / game", 1, "f2", "Defense"), ("tfl_pg", "Tackles for loss / game", 1, "f2", "Defense"),
        ("to_margin", "Turnover margin", 1, "int", "Turnovers"), ("takeaways", "Takeaways", 1, "int", "Turnovers"), ("giveaways", "Giveaways", 0, "int", "Turnovers"),
        ("pen_pg", "Penalties / game", 0, "f2", "Discipline"), ("pen_yds_pg", "Penalty yards / game", 0, "f1", "Discipline"),
        ("top", "Time of possession (min)", None, "mmss", "Other"), ("net_punt", "Net punting avg", 1, "f2", "Other"),
    ]
    for key, label, hb, fmt, cat in STATS:
        pool = [t for t in teams.values() if t.get("s", {}).get(key) is not None]
        n = len(pool)
        if hb is None or not n: continue
        sg = 1 if hb else -1
        for t in pool:
            x = t["s"][key] * sg; better = sum(1 for u in pool if u["s"][key] * sg > x + 1e-9); worse = sum(1 for u in pool if u["s"][key] * sg < x - 1e-9)
            t.setdefault("r", {})[key] = [better + 1, round(100 * (worse + 0.5 * (n - better - worse - 1)) / (n - 1)) if n > 1 else 100]
    for key in ("ppg", "opp_ppg"):  # for convert NCAA pct stats (.433) to percent
        pass
    for t in teams.values():
        for k in ("third_pct", "fourth_pct", "rz_pct", "opp_third_pct", "opp_rz_pct"):
            v = t.get("s", {}).get(k)
            if v is not None and v <= 1.0: t["s"][k] = round(v * 100, 1)

    # ---- path difficulty ----
    fpi_of = {tid: t["fpi"]["fpi"] for tid, t in teams.items() if t.get("fpi") and t["fpi"].get("fpi") is not None}
    rk_of = {tid: int(t["fpi"]["rk"]) for tid, t in teams.items() if t.get("fpi") and t["fpi"].get("rk")}
    floor = min(fpi_of.values()); NFBS = len(rk_of)
    HFA = 2.5  # points, applied only to classify game difficulty by site (documented in the glossary)
    tiers = [(1, 10, "Elite"), (11, 25, "Very hard"), (26, 50, "Hard"), (51, 85, "Medium"), (86, 115, "Easy"), (116, 10 ** 6, "Very easy")]
    sorted_fpi = sorted(fpi_of.values(), reverse=True)
    def equiv_rank(v): return 1 + sum(1 for x in sorted_fpi if x > v + 1e-9)
    for tid, t in teams.items():
        for g in t["sched"]:
            o = g["o"]; fbs = o in teams
            g["fbs"] = fbs
            if fbs and o in fpi_of:
                ot = teams[o]; g.update(ofpi=fpi_of[o], ork=rk_of.get(o), ooffrk=ot["fpi"].get("offrk"), odefrk=ot["fpi"].get("dfnrk"), orec=ot["rec"]["o"],
                                        olog=ot.get("logo"))
                adj = fpi_of[o] + (HFA if g["ha"] == "a" else -HFA if g["ha"] == "h" else 0)
            else:
                adj = floor + (HFA if g["ha"] == "a" else -HFA if g["ha"] == "h" else 0)
            g["adj"] = round(adj, 2); er = equiv_rank(adj); g["erk"] = er
            g["diff"] = "FCS" if not fbs else next(lbl for lo, hi, lbl in tiers if lo <= er <= hi)
        reg = [g for g in t["sched"] if g["st"] == 2 and not g["canc"]]
        played = [g for g in reg if g["done"]]; rem = [g for g in reg if not g["done"]]
        def avg(xs): return round(sum(xs) / len(xs), 2) if xs else None
        def rec_vs(cut):
            gs = [g for g in played if g.get("ork") and g["ork"] <= cut]; w = sum(1 for g in gs if g["res"] == "W"); return [w, len(gs) - w]
        t["path"] = dict(
            played=len(played), rem=len(rem), fcs=sum(1 for g in played if not g["fbs"]), fcs_rem=sum(1 for g in rem if not g["fbs"]),
            avg_ork=avg([g["ork"] if g["fbs"] and g.get("ork") else NFBS + 1 for g in played]),
            avg_ork_rem=avg([g["ork"] if g["fbs"] and g.get("ork") else NFBS + 1 for g in rem]),
            avg_ofpi=avg([g["adj"] for g in played]), avg_ofpi_rem=avg([g["adj"] for g in rem]),
            t25=sum(1 for g in played if g.get("ork") and g["ork"] <= 25), t25_rem=sum(1 for g in rem if g.get("ork") and g["ork"] <= 25),
            v25=rec_vs(25), v50=rec_vs(50))
    pool = [t for t in teams.values() if t["path"]["avg_ofpi"] is not None]
    for key, out in (("avg_ofpi", "tough_rk"), ("avg_ofpi_rem", "tough_rem_rk")):
        vals = sorted([t["path"][key] for t in pool if t["path"][key] is not None], reverse=True)
        for t in pool:
            if t["path"][key] is not None: t["path"][out] = 1 + sum(1 for x in vals if x > t["path"][key] + 1e-9)

    meta = dict(season=S, built=now.strftime("%Y-%m-%dT%H:%M:%SZ"), fpi_updated=fpi_updated, last_final=last_final, polls=polls,
                sp=sp_meta, sp_unmatched=sp_unmatched, n_teams=len(teams), hfa=HFA, fcs_floor=floor, tiers=[[lo, hi, l] for lo, hi, l in tiers],
                stats=[dict(k=k, l=l, hb=hb, f=f, c=c) for k, l, hb, f, c in STATS],
                ncaa={str(k): dict(rows=v["rows"], unmatched=v["unmatched"]) for k, v in stats_src.items()},
                sources=dict(standings="https://www.espn.com/college-football/standings", fpi="https://www.espn.com/college-football/fpi",
                             sp=SP_URL, ncaa="https://www.ncaa.com/stats/football/fbs", polls="https://www.espn.com/college-football/rankings"))
    def clean(o):
        if isinstance(o, dict): return {k: clean(v) for k, v in o.items()}
        if isinstance(o, list): return [clean(v) for v in o]
        if isinstance(o, float): return None if not math.isfinite(o) else round(o, 3)
        return o
    out = dict(meta=meta, teams=sorted(teams.values(), key=lambda t: (t.get("fpi") or {}).get("rk") or 999))
    json.dump(clean(out), open("data/teams.json", "w"), separators=(",", ":"), allow_nan=False)
    print(f"wrote data/teams.json: {len(teams)} teams; last final game {last_final}; FPI {fpi_updated}")

if __name__ == "__main__":
    main()
