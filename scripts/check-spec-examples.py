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
  3. the request echoed inside every credential must be one of the shown requests;
  4. for the Taler method specification: every shown JSON that contains a Taler Pay URI must agree with it,
     using the rule of LSD 0006 (order id = path segment between the last two slashes after dropping the
     query; merchant base URL = https:// + host + prefix path + "/"):
       methodDetails.orderId and methodDetails.merchantBaseUrl, x402 payTo, and PAYMENT-RESPONSE transaction;
     and, for version 02 of that specification: methodDetails.exchanges is a non-empty list of {url, masterPub};
     every taler x402 network is "taler:" + the first 32 characters of the masterPub of a listed exchange;
     extra.paymentFlow is "upfront"; the PAYMENT-SIGNATURE payload is {orderId, hContract} with orderId equal to
     the identifier derived from accepted.extra.talerPayUri and hContract a 103-character Crockford Base32 hash;
     and, for version 03 and later: the payload may also carry merchantSig (103-character Crockford Base32);
     methodDetails.talerAmount and extra.talerAmount are present, are Taler amounts (CURRENCY:VALUE[.FRACTION], at most 11
     ASCII letters, integer part at most 2^52, at most 8 fraction digits), and agree with amount (a decimal integer of units of
     10^-8) and with currency / asset (case-insensitively); the test vector of the merchant payment signature is internally
     consistent (the signed message is size 72, purpose 1104, then the decoded contract hash) and, where an OpenSSL with
     Ed25519 is found, the signature verifies under the key and fails with one bit of the message changed.

usage: check-spec-examples.py [--lenient-jcs] FILE...      exit status 1 if there is any mismatch"""
import base64, json, os, re, shutil, subprocess, sys, tempfile

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

    # 4. Taler Pay URI derivation (only fires for specs that show taler://pay/ URIs in their JSON)
    def derive(uri):
        rest = uri.split("?", 1)[0]
        assert rest.startswith("taler://pay/"), uri
        segs = rest[len("taler://pay/"):].split("/")
        return segs[-2], "https://" + "/".join(segs[:-2]) + "/"

    mver = re.search(r"^docname: draft-taler-charge-(\d+)\s*$", text, re.M)
    taler_ver = int(mver.group(1)) if mver else 0   # the -02 rules below apply to version 02 and later
    uris_checked = 0
    TALER_AMOUNT = re.compile(r"([A-Za-z]{1,11}):(\d+)(?:\.(\d{1,8}))?")

    def check_amount(pos, amount, cur, ta, where):
        """-03: amount (units of 10^-8) and the Taler amount string describe the same value and currency."""
        mm = TALER_AMOUNT.fullmatch(ta) if isinstance(ta, str) else None
        if not mm or int(mm.group(2)) > 2 ** 52:
            mismatch(pos, f"{where}.talerAmount {ta!r} is not a Taler amount"); return
        atoms = int(mm.group(2)) * 10 ** 8 + int((mm.group(3) or "").ljust(8, "0") or "0")
        if not (isinstance(amount, str) and re.fullmatch(r"0|[1-9]\d*", amount)) or int(amount) != atoms:
            mismatch(pos, f"{where}: amount {amount!r} is not {ta!r} in units of 10^-8 ({atoms})")
        if not (isinstance(cur, str) and cur.lower() == mm.group(1).lower()):
            mismatch(pos, f"{where}: currency {cur!r} differs from the currency of {ta!r}")
    derived_orders = set()
    masters = set()
    for m0 in re.finditer(r"~~~json\n(.*?)\n~~~", text, re.S):
        try:
            o0 = json.loads(m0.group(1))
        except Exception:
            continue
        stack = [o0]
        while stack:
            x = stack.pop()
            if isinstance(x, dict):
                md0 = x.get("methodDetails")
                if isinstance(md0, dict) and isinstance(md0.get("exchanges"), list):
                    masters.update(e["masterPub"] for e in md0["exchanges"] if isinstance(e, dict) and isinstance(e.get("masterPub"), str))
                stack.extend(x.values())
            elif isinstance(x, list):
                stack.extend(x)
    for m in re.finditer(r"~~~json\n(.*?)\n~~~", text, re.S):
        try:
            obj = json.loads(m.group(1))
        except Exception:
            continue
        def walk(o):
            if isinstance(o, dict):
                yield o
                for v in o.values():
                    yield from walk(v)
            elif isinstance(o, list):
                for v in o:
                    yield from walk(v)
        for d in walk(obj):
            md = d.get("methodDetails") if isinstance(d.get("methodDetails"), dict) else None
            if md and isinstance(md.get("talerPayUri"), str):
                oid, base = derive(md["talerPayUri"]); uris_checked += 1; derived_orders.add(oid)
                if md.get("orderId") != oid:
                    mismatch(m.start(), f"methodDetails.orderId {md.get('orderId')!r} != order id {oid!r} derived from the Taler Pay URI")
                if md.get("merchantBaseUrl") != base:
                    mismatch(m.start(), f"methodDetails.merchantBaseUrl {md.get('merchantBaseUrl')!r} != {base!r} derived from the Taler Pay URI")
            if taler_ver >= 3 and md and isinstance(md.get("talerPayUri"), str):
                check_amount(m.start(), d.get("amount"), d.get("currency"), md.get("talerAmount"), "request")
            if taler_ver >= 2 and md and "exchanges" in md:
                exl = md["exchanges"]
                okx = isinstance(exl, list) and len(exl) > 0 and all(
                    isinstance(e, dict) and set(e) == {"url", "masterPub"} and isinstance(e["masterPub"], str) and len(e["masterPub"]) == 52 for e in exl)
                if not okx:
                    mismatch(m.start(), "methodDetails.exchanges must be a non-empty list of {url, masterPub} with 52-character master keys")
                else:
                    masters.update(e["masterPub"] for e in exl)
            ex = d.get("extra") if isinstance(d.get("extra"), dict) else None
            if ex and isinstance(ex.get("talerPayUri"), str):
                oid, base = derive(ex["talerPayUri"]); uris_checked += 1; derived_orders.add(oid)
                if d.get("payTo") != base:
                    mismatch(m.start(), f"payTo {d.get('payTo')!r} != {base!r} derived from the Taler Pay URI")
                if taler_ver >= 3:
                    check_amount(m.start(), d.get("amount"), d.get("asset"), ex.get("talerAmount"), "x402 requirement")
                if taler_ver >= 2 and ex.get("paymentFlow") != "upfront":
                    mismatch(m.start(), f"extra.paymentFlow is {ex.get('paymentFlow')!r}, must be 'upfront'")
                net = d.get("network")
                if taler_ver >= 2 and not (isinstance(net, str) and net.startswith("taler:")):
                    mismatch(m.start(), f"network {net!r} is not a taler network")
                elif taler_ver >= 2 and masters and net[len("taler:"):] not in {k[:32] for k in masters}:
                    mismatch(m.start(), f"network {net!r} is not taler: + the first 32 characters of a listed exchange's masterPub")
            pl = d.get("payload") if isinstance(d.get("payload"), dict) else None
            acc = d.get("accepted") if isinstance(d.get("accepted"), dict) else None
            if taler_ver >= 2 and acc and pl is not None and isinstance(acc.get("extra"), dict) and isinstance(acc["extra"].get("talerPayUri"), str):
                oid, _ = derive(acc["extra"]["talerPayUri"])
                allowed = {"orderId", "hContract"} | ({"merchantSig"} if taler_ver >= 3 else set())
                if not ({"orderId", "hContract"} <= set(pl) <= allowed):
                    mismatch(m.start(), f"x402 payload fields are {sorted(pl)}, must be ['hContract', 'orderId']" + (" plus optionally merchantSig" if taler_ver >= 3 else ""))
                else:
                    if pl["orderId"] != oid:
                        mismatch(m.start(), f"payload.orderId {pl['orderId']!r} != {oid!r} derived from accepted.extra.talerPayUri")
                    if not (isinstance(pl["hContract"], str) and re.fullmatch(r"[0-9A-Z]{103}", pl["hContract"])):
                        mismatch(m.start(), "payload.hContract is not a 103-character Crockford Base32 hash")
    # merchantSig in a payload fragment (no "accepted"): Crockford Base32 of 64 bytes
    if taler_ver >= 3:
        for m in re.finditer(r"~~~json\n(.*?)\n~~~", text, re.S):
            try:
                o2 = json.loads(m.group(1))
            except Exception:
                continue
            if isinstance(o2, dict) and "merchantSig" in o2:
                n += 1
                if not re.fullmatch(r"[0-9A-HJKMNP-TV-Z]{103}", str(o2["merchantSig"])) or not re.fullmatch(r"[0-9A-HJKMNP-TV-Z]{103}", str(o2.get("hContract"))):
                    mismatch(m.start(), "merchantSig and hContract must be 103-character Crockford Base32")
        # the test vector block
        mv = re.search(r"merchant_pub \(Crockford Base32, 32 bytes\):\n  (\S+)\n  hex: (\S+)\n\nh_contract_terms \(Crockford Base32, 64 bytes\):\n  (\S+)\n\n"
                       r"signed message \(72 bytes, hex\):\n  (\S+)\s+size = 72\n  (\S+)\s+purpose = 1104\n  (\S+)\n  (\S+)\s+h_contract_terms\n\n"
                       r"merchantSig \(Crockford Base32, 64 bytes\):\n  (\S+)\n  hex: (\S+)\n", text)
        if not mv:
            mismatch(0, "the merchantSig test vector block was not found")
        else:
            A = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
            def crock(t, nbytes):
                bits = "".join(format(A.index(c), "05b") for c in t)
                if len(t) != -(-nbytes * 8 // 5) or "1" in bits[nbytes * 8:]:
                    raise ValueError("not canonical Crockford Base32 of %d bytes" % nbytes)
                return bytes(int(bits[i * 8:i * 8 + 8], 2) for i in range(nbytes))
            try:
                pub, h, sig = crock(mv.group(1), 32), crock(mv.group(3), 64), crock(mv.group(8), 64)
            except Exception as e:
                mismatch(mv.start(), f"vector: {e}"); pub = h = sig = b""
            if pub:
                msg = (72).to_bytes(4, "big") + (1104).to_bytes(4, "big") + h
                n += 1
                if pub.hex() != mv.group(2) or sig.hex() != mv.group(9):
                    mismatch(mv.start(), "vector: hex of the key or signature does not match its Crockford form")
                if mv.group(4) != "00000048" or mv.group(5) != "00000450" or (mv.group(6) + mv.group(7)) != h.hex():
                    mismatch(mv.start(), "vector: the signed message is not size 72, purpose 1104, then the decoded contract hash")
                ossl = next((c for c in ("/opt/homebrew/bin/openssl", "/usr/local/bin/openssl", shutil.which("openssl")) if c and os.path.exists(c)
                             and "OpenSSL 3" in subprocess.run([c, "version"], capture_output=True, text=True).stdout), None)
                if ossl:
                    with tempfile.TemporaryDirectory() as td:
                        def verify(message):
                            open(td + "/pub.pem", "w").write("-----BEGIN PUBLIC KEY-----\n" + base64.b64encode(bytes.fromhex("302a300506032b6570032100") + pub).decode() + "\n-----END PUBLIC KEY-----\n")
                            open(td + "/m", "wb").write(message); open(td + "/s", "wb").write(sig)
                            return subprocess.run([ossl, "pkeyutl", "-verify", "-pubin", "-inkey", td + "/pub.pem", "-rawin", "-in", td + "/m", "-sigfile", td + "/s"], capture_output=True).returncode == 0
                        flipped = bytearray(msg); flipped[71] ^= 1
                        if not verify(msg):
                            mismatch(mv.start(), "vector: the signature does not verify (Ed25519, OpenSSL)")
                        if verify(bytes(flipped)):
                            mismatch(mv.start(), "vector: the signature verifies for a changed message")
                    print(f"{path}: merchantSig vector verified with {ossl} (valid; invalid after one bit change)")
                else:
                    print(f"{path}: no OpenSSL 3 found, the merchantSig signature itself was not verified (layout checked only)")
    for m in re.finditer(r"~~~json\n(.*?)\n~~~", text, re.S):
        try:
            obj = json.loads(m.group(1))
        except Exception:
            continue
        if isinstance(obj, dict) and "transaction" in obj and "success" in obj and derived_orders:
            if obj["transaction"] not in derived_orders:
                mismatch(m.start(), f"transaction {obj['transaction']!r} is not an order id derived from a shown Taler Pay URI")
    if uris_checked:
        print(f"{path}: {uris_checked} Taler Pay URI(s) checked against the LSD 0006 derivation rule")

    print(f"{path}: {len(shown)} shown request(s), {n} encoded values checked, mismatches: {bad}")
    total_bad += bad
sys.exit(1 if total_bad else 0)
