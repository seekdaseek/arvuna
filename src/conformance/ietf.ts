// Checks of an IETF "Payment" HTTP authentication challenge against
//   draft-httpauth-payment-01 (github.com/tempoxyz/mpp-specs specs/core) and
//   draft-payment-intent-charge-00 (specs/intents).
// Section names are given as the headings appear in the draft source; the Markdown source carries no section numbers.
import { parseWwwAuthenticate, type ParsedChallenge } from "../common/challenge.ts";
import { b64urlDecode, isObject, jcs, parseJson, utf8 } from "../common/encoding.ts";
import { CHARGE, HTTPAUTH, type Observed, type RuleResult, type Status } from "./types.ts";

const RFC3339 = /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;
const KNOWN_INTENTS = new Set(["charge", "session", "subscription"]); // specs/intents and specs/methods/tempo in mpp-specs

export function paymentChallenges(o: Observed): ParsedChallenge[] {
  const h = o.headers["www-authenticate"];
  return h ? parseWwwAuthenticate(h).filter((c) => c.scheme.toLowerCase() === "payment") : [];
}

export function checkIetf(o: Observed): RuleResult[] {
  const cs = paymentChallenges(o);
  if (cs.length === 0) {
    return [{ id: "IETF-00", status: "N/A", rule: "Server offers a Payment challenge", spec: HTTPAUTH, detail: o.headers["www-authenticate"] ? `WWW-Authenticate present but no Payment scheme: ${o.headers["www-authenticate"].slice(0, 80)}` : "no WWW-Authenticate header" }];
  }
  const out: RuleResult[] = [];
  const add = (id: string, status: Status, rule: string, spec: string, detail?: string) => out.push({ id, status, rule, spec, ...(detail !== undefined ? { detail } : {}) });
  const many = cs.length > 1;

  add("IETF-01", o.status === 402 ? "PASS" : "FAIL", "Challenge is sent with status 402", `${HTTPAUTH}, Status Codes`, `status ${o.status}`);
  const cc = (o.headers["cache-control"] ?? "").toLowerCase();
  add("IETF-02", /(^|[\s,])no-store([\s,]|$)/.test(cc) ? "PASS" : "FAIL", "402 carries Cache-Control: no-store", `${HTTPAUTH}, Caching`, cc ? `Cache-Control: ${cc}` : "no Cache-Control header");

  cs.forEach((c, i) => {
    const t = many ? ` [challenge ${i + 1}]` : "";
    const id = (n: string) => `IETF-${n}${many ? "." + (i + 1) : ""}`;
    const get = (k: string) => c.map.get(k);

    add(id("03"), c.errors.length === 0 && c.duplicates.length === 0 ? "PASS" : "FAIL", `Challenge syntax is valid auth-params, no duplicate parameters${t}`, `${HTTPAUTH}, Challenge (WWW-Authenticate)`, [...c.errors, ...c.duplicates.map((d) => `duplicate "${d}"`)].join("; ") || undefined);
    add(id("04"), (get("id") ?? "") !== "" ? "PASS" : "FAIL", `id present and non-empty${t}`, `${HTTPAUTH}, Required Parameters (id)`, get("id") === undefined ? "missing" : undefined);
    add(id("05"), (get("realm") ?? "") !== "" ? "PASS" : "FAIL", `realm present${t}`, `${HTTPAUTH}, Required Parameters (realm)`, get("realm") === undefined ? "missing" : undefined);
    const method = get("method");
    add(id("06"), method !== undefined && /^[a-z]+$/.test(method) ? "PASS" : "FAIL", `method present, lowercase ASCII letters only${t}`, `${HTTPAUTH}, Method Identifier Format (payment-method-id = 1*LOWERALPHA)`, method === undefined ? "missing" : `method="${method}"`);
    const intent = get("intent");
    if (intent === undefined || !/^[a-z0-9-]+$/.test(intent)) {
      add(id("07"), "FAIL", `intent present, lowercase letters, digits and hyphen${t}`, `${HTTPAUTH}, Intent Identifiers (ABNF)`, intent === undefined ? "missing" : `intent="${intent}"`);
    } else {
      add(id("07"), KNOWN_INTENTS.has(intent) ? "PASS" : "WARN", `intent syntax valid and defined in a published intent spec${t}`, `${HTTPAUTH}, Intent Identifiers`, KNOWN_INTENTS.has(intent) ? `intent="${intent}"` : `intent="${intent}" is not one of charge, session, subscription`);
    }

    // request
    const reqRaw = get("request");
    let req: Record<string, unknown> | undefined;
    if (reqRaw === undefined) {
      add(id("08"), "FAIL", `request present, base64url without padding, JSON object${t}`, `${HTTPAUTH}, Required Parameters (request)`, "missing");
    } else {
      const bytes = b64urlDecode(reqRaw);
      const text = bytes ? utf8(bytes) : null;
      const parsed = text !== null ? parseJson(text) : ({ ok: false } as const);
      if (!bytes) add(id("08"), "FAIL", `request present, base64url without padding, JSON object${t}`, `${HTTPAUTH}, Required Parameters (request)`, reqRaw.includes("=") ? "padding characters are forbidden" : "not valid base64url");
      else if (text === null || !parsed.ok) add(id("08"), "FAIL", `request present, base64url without padding, JSON object${t}`, `${HTTPAUTH}, Required Parameters (request)`, "does not decode to UTF-8 JSON");
      else if (!isObject(parsed.value)) add(id("08"), "FAIL", `request present, base64url without padding, JSON object${t}`, `${HTTPAUTH}, Required Parameters (request)`, "JSON is not an object");
      else {
        req = parsed.value;
        add(id("08"), "PASS", `request present, base64url without padding, JSON object${t}`, `${HTTPAUTH}, Required Parameters (request)`);
        let canonical: string | undefined;
        try { canonical = jcs(parsed.value); } catch { /* unsupported value */ }
        add(id("09"), canonical === text ? "PASS" : "FAIL", `request JSON is serialised with JCS (RFC 8785)${t}`, `${HTTPAUTH}, Required Parameters (request)`, canonical === text ? undefined : `got ${text.slice(0, 70)}…, JCS form is ${canonical?.slice(0, 70)}…`);
      }
    }

    // charge intent request schema
    if (intent === "charge") {
      if (!req) {
        add(id("10"), "FAIL", `charge: request.amount is a string of base units${t}`, `${CHARGE}, Shared Fields (Required)`, "request could not be read");
        add(id("11"), "FAIL", `charge: request.currency present; ISO 4217 codes lowercase${t}`, `${CHARGE}, Currency Formats`, "request could not be read");
      } else {
        const a = req["amount"];
        add(id("10"), typeof a === "string" && /^[0-9]+$/.test(a) ? "PASS" : "FAIL", `charge: request.amount is a string of base units${t}`, `${CHARGE}, Shared Fields (Required)`, a === undefined ? "missing" : typeof a !== "string" ? `type ${typeof a}, must be a string` : /^[0-9]+$/.test(a) ? `amount="${a}"` : `amount="${a}" is not an integer string`);
        const cur = req["currency"];
        if (typeof cur !== "string" || cur === "") add(id("11"), "FAIL", `charge: request.currency present; ISO 4217 codes lowercase${t}`, `${CHARGE}, Currency Formats`, cur === undefined ? "missing" : "not a non-empty string");
        else if (/^[A-Za-z]{3}$/.test(cur) && cur !== cur.toLowerCase()) add(id("11"), "FAIL", `charge: request.currency present; ISO 4217 codes lowercase${t}`, `${CHARGE}, Currency Formats`, `currency="${cur}" looks like an ISO 4217 code but is not lowercase`);
        else if (/^[A-Za-z]+$/.test(cur) && cur !== cur.toLowerCase()) add(id("11"), "WARN", `charge: request.currency present; ISO 4217 codes lowercase${t}`, `${CHARGE}, Currency Formats`, `currency="${cur}" is not an ISO 4217-shaped code, so its format is method-defined`);
        else add(id("11"), "PASS", `charge: request.currency present; ISO 4217 codes lowercase${t}`, `${CHARGE}, Currency Formats`, `currency="${cur}"`);
        const bad: string[] = [];
        for (const k of ["recipient", "description", "externalId"]) if (req[k] !== undefined && typeof req[k] !== "string") bad.push(`${k} must be a string`);
        if (req["methodDetails"] !== undefined && !isObject(req["methodDetails"])) bad.push("methodDetails must be an object");
        add(id("12"), bad.length === 0 ? "PASS" : "FAIL", `charge: optional request fields have the right types${t}`, `${CHARGE}, Shared Fields (Optional)`, bad.join("; ") || undefined);
        add(id("13"), req["expires"] === undefined ? "PASS" : "FAIL", `charge: request does not duplicate the expiry${t}`, `${CHARGE}, Shared Fields (expiry paragraph)`, req["expires"] === undefined ? undefined : "request contains an expires field");
      }
    }

    // expires
    const exp = get("expires");
    if (exp === undefined) add(id("14"), "WARN", `expires present (SHOULD), RFC 3339, in the future${t}`, `${HTTPAUTH}, Optional Parameters (expires)`, "absent");
    else if (!RFC3339.test(exp) || Number.isNaN(Date.parse(exp))) add(id("14"), "FAIL", `expires present (SHOULD), RFC 3339, in the future${t}`, `${HTTPAUTH}, Optional Parameters (expires)`, `expires="${exp}" is not an RFC 3339 date-time`);
    else if (Date.parse(exp) <= o.at) add(id("14"), "FAIL", `expires present (SHOULD), RFC 3339, in the future${t}`, `${HTTPAUTH}, Optional Parameters (expires)`, `expires="${exp}" is already past`);
    else add(id("14"), "PASS", `expires present (SHOULD), RFC 3339, in the future${t}`, `${HTTPAUTH}, Optional Parameters (expires)`, `expires="${exp}" (${Math.round((Date.parse(exp) - o.at) / 1000)} s ahead)`);

    // opaque, header
    const op = get("opaque");
    if (op !== undefined) {
      const bytes = b64urlDecode(op);
      const text = bytes ? utf8(bytes) : null;
      const parsed = text !== null ? parseJson(text) : ({ ok: false } as const);
      const flat = parsed.ok && isObject(parsed.value) && Object.values(parsed.value).every((v) => typeof v === "string");
      let canonical = false;
      if (flat && parsed.ok) { try { canonical = jcs(parsed.value) === text; } catch { /* */ } }
      add(id("15"), flat && canonical ? "PASS" : "FAIL", `opaque is base64url of a JCS flat string-to-string JSON object${t}`, `${HTTPAUTH}, Optional Parameters (opaque)`, flat && canonical ? undefined : !flat ? "not a flat string-to-string JSON object in base64url" : "JSON is not JCS-serialised");
    }
    const hd = get("header");
    if (hd !== undefined) add(id("16"), hd === "Payment-Authorization" ? "PASS" : "FAIL", `header, if present, is exactly Payment-Authorization${t}`, `${HTTPAUTH}, Optional Parameters (header)`, `header="${hd}"`);
  });
  if (many) {
    const ids = cs.map((c) => c.map.get("id")).filter((x): x is string => !!x);
    add("IETF-17", new Set(ids).size === ids.length ? "PASS" : "FAIL", "Challenge ids are unique across multiple challenges", `${HTTPAUTH}, Multiple Payment Options`, new Set(ids).size === ids.length ? undefined : "two challenges share an id");
  }
  return out;
}
