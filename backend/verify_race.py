import concurrent.futures as cf, requests, sqlite3, re
BASE = "http://localhost:8080"

def session_token(sid):
    # Capture the raw session cookie value from Set-Cookie (the cookie is Secure, so
    # requests won't auto-resend it over http; send it by hand as a header).
    r = requests.post(f"{BASE}/api/auth/signup", json={"sid": sid, "password": "testpass123"})
    if r.status_code != 200:
        r = requests.post(f"{BASE}/api/auth/session", json={"sid": sid, "password": "testpass123"})
    m = re.search(r"session=([^;]+)", r.headers.get("set-cookie", ""))
    tok = m.group(1) if m else None
    if tok:
        requests.post(f"{BASE}/api/auth/consent", json={"agreed": True},
                      headers={"Cookie": f"session={tok}"})
    return tok

def count(sid, etype, topic):
    c = sqlite3.connect("research_events.db")
    n = c.execute("SELECT COUNT(*) FROM events WHERE participant_id=? AND event_type=? AND IFNULL(topic_id,'')=?",
                  (sid, etype, topic)).fetchone()[0]
    c.close(); return n

N = 40
def run(sid, path, body, etype, topic, label):
    tok = session_token(sid)
    hdr = {"Cookie": f"session={tok}", "Content-Type": "application/json"}
    def fire(_):
        return requests.post(f"{BASE}{path}", json=body, headers=hdr).status_code
    with cf.ThreadPoolExecutor(max_workers=N) as ex:
        codes = list(ex.map(fire, range(N)))
    rows = count(sid, etype, topic)
    n500 = sum(1 for c in codes if c >= 500)
    ok = rows == 1 and n500 == 0
    print(f"{label}: {N} concurrent")
    print(f"  200={codes.count(200)} 409={codes.count(409)} 400={codes.count(400)} 500={n500} other={sorted(set(c for c in codes if c not in (200,409,400)))}")
    print(f"  rows for ({etype},{topic}): {rows}  (MUST be 1)   500s: {n500} (MUST be 0)   -> {'PASS' if ok else 'FAIL'}\n")
    return ok

r1 = run("24E77103A", "/api/research/event", {"event_type":"topic_complete","topic_id":"memory"},
         "topic_complete", "memory", "TEST 1 once-only event race (DB index backstop, off-event-loop)")
ans = {f"A{i}":"a" for i in range(1,7)}
r2 = run("24E77104A", "/api/topics/memory/check/A", {"answers":ans},
         "topic_pretest", "memory", "TEST 2 check-endpoint race (the one-submission guarantee)")
print("OVERALL:", "PASS" if r1 and r2 else "FAIL")
