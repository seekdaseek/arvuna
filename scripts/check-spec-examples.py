#!/usr/bin/env python3
"""Check that every encoded example in a specification decodes to the JSON shown under it.

Checks, for each file given:
  1. every `request` value (request="..." or "request": "...") must be base64url without padding,
     JCS-serialised JSON, and equal to the JSON shown as "Decoded `request`";
  2. every encoded header example followed by a "Decoded ...:" JSON block must decode to exactly that JSON:
       Authorization / Payment-Authorization: Payment <base64url>   (credentials)
       Payment-Receipt: <base64url>
       PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE: <base64>   (x402, standard base64)
     and its encoding must be the JCS serialisation (--lenient-jcs turns that off, for specs that do not use JCS here);
  3. the request echoed inside every credential must be one of the shown requests.

usage: check-spec-examples.py [--lenient-jcs] FILE...      exit status 1 if there is any mismatch"""
import base64, json, re, sys

args = [a for a in sys.argv[1:] if not a.startswith("--")]
lenient = "--lenient-jcs" in sys.argv
if not args:
    sys.exit(__doc__)

jcs = lambda o: json.dumps(o, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
dec_url = lambda x: base64.urlsafe_b64decode(x + "=" * (-len(x) % 4)).decode()
dec_std = lambda x: base64.b64decode(x + "=" * (-len(x) % 4)).decode()
enc_url = lambda o: base64.urlsafe_b64encode(jcs(o).encode()).rstrip(b"=").decode()
enc_std = lambda o: base64.b64encode(jcs(o).encode()).decode()

total_bad = 0
for path in args:
    text = open(path).read()
    line_of = lambda pos: text.count("\n", 0, pos) + 1
    bad = n = 0

    def mismatch(pos, msg):
        global bad
        bad += 1
        print(f"MISMATCH {path}:{line_of(pos)}: {msg}")

    shown = [json.loads(m.group(1)) for m in re.finditer(r"Decoded `request`[^\n]*:\n\n~~~json\n(.*?)\n~~~", text, re.S)]
    shown_enc = {enc_url(o): o for o in shown}

    # 1. request values
    for m in re.finditer(r'request(?:=|": )"([A-Za-z0-9_-]{20,})"', text):
        n += 1
        try:
            obj = json.loads(dec_url(m.group(1)))
        except Exception as e:
            mismatch(m.start(), f"request is not decodable ({e})"); continue
        if m.group(1) not in shown_enc:
            mismatch(m.start(), f"request decodes to {jcs(obj)}, which is not a shown JSON, or is not its JCS/base64url form")

    # 2. encoded headers followed by their decoded JSON
    head = (r"(?:(?:Authorization|Payment-Authorization): Payment (?P<cred>[A-Za-z0-9_-]{30,})"
            r"|Payment-Receipt: (?P<rcpt>[A-Za-z0-9_-]{20,})"
            r"|(?P<xname>PAYMENT-REQUIRED|PAYMENT-SIGNATURE|PAYMENT-RESPONSE): (?P<x>[A-Za-z0-9+/=]{20,}))")
    for m in re.finditer(head + r"\n(?:~~~\n)?\s*(?:[^\n~]*\n)*?\s*(?:~~~\n\n)?Decoded[^\n]*:\n\n~~~json\n(?P<shown>.*?)\n~~~", text, re.S):
        value = m.group("cred") or m.group("rcpt") or m.group("x")
        std = m.group("x") is not None
        n += 1
        try:
            got = json.loads((dec_std if std else dec_url)(value))
        except Exception as e:
            mismatch(m.start(), f"not decodable ({e})"); continue
        want = json.loads(m.group("shown"))
        if got != want:
            mismatch(m.start(), f"decodes to {jcs(got)}, but the JSON shown is {jcs(want)}")
        elif not lenient and value != (enc_std if std else enc_url)(want):
            mismatch(m.start(), "decodes correctly but is not the JCS serialisation of the JSON shown")

    # 3. requests echoed inside credentials
    for m in re.finditer(r"Payment (eyJ[A-Za-z0-9_-]{30,})", text):
        try:
            inner = json.loads(dec_url(m.group(1)))["challenge"]["request"]
        except Exception:
            continue
        n += 1
        if inner not in shown_enc:
            mismatch(m.start(), f"credential embeds a request that decodes to {dec_url(inner)}")

    print(f"{path}: {len(shown)} shown request(s), {n} encoded values checked, mismatches: {bad}")
    total_bad += bad
sys.exit(1 if total_bad else 0)
