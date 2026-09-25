import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import dns from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";

function privateAddress(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const normalized = ip.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

async function validatePublicUrl(value: string | URL) {
  const url = value instanceof URL ? value : new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Enter a normal public http or https webpage address.");
  if (!url.hostname || url.username || url.password) throw new Error("This webpage address cannot be opened. Check the address and try again.");
  if (["localhost", "0.0.0.0"].includes(url.hostname.toLowerCase())) throw new Error("For security, local or private network addresses cannot be opened.");

  if (net.isIP(url.hostname)) {
    if (privateAddress(url.hostname)) throw new Error("For security, local or private network addresses cannot be opened.");
  } else {
    const records = await dns.lookup(url.hostname, { all: true });
    if (!records.length || records.some(record => privateAddress(record.address))) {
      throw new Error("For security, this address points to a private network and cannot be opened.");
    }
  }
  return url;
}

async function fetchPublicSource(initial: URL, signal: AbortSignal) {
  let current = initial;
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    current = await validatePublicUrl(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": "DecisionInsuranceSourceReader/0.1",
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5"
      }
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, finalUrl: current };
    }

    const location = response.headers.get("location");
    if (!location) throw new Error("The website redirected to an invalid destination.");
    if (redirectCount === 5) throw new Error("The website redirected too many times.");
    current = new URL(location, current);
  }
  throw new Error("The webpage could not be reached.");
}

function compactText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: NextRequest) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const body = await request.json();
    const requested = await validatePublicUrl(String(body.url ?? ""));
    const { response, finalUrl } = await fetchPublicSource(requested, controller.signal);

    if (!response.ok) throw new Error(`The website returned an error (${response.status}).`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("This address does not return a readable webpage.");
    }

    const raw = await response.text();
    if (raw.length > 2_500_000) throw new Error("The webpage is larger than the current source limit.");

    if (contentType.includes("text/plain")) {
      return NextResponse.json({
        title: finalUrl.hostname,
        text: compactText(raw),
        canonicalUrl: finalUrl.toString(),
        retrievedAt: new Date().toISOString()
      });
    }

    const $ = cheerio.load(raw);
    $("script,style,noscript,svg,canvas,iframe,form,button,nav,footer").remove();
    const title = compactText($("meta[property='og:title']").attr("content") || $("title").text() || finalUrl.hostname);
    const canonical = $("link[rel='canonical']").attr("href");
    const root = $("article").first().length ? $("article").first() : $("main").first().length ? $("main").first() : $("body");

    root.find("h1,h2,h3,h4,p,li,blockquote,pre,td,th").each((_, el) => {
      $(el).after("\n\n");
    });
    const text = compactText(root.text());
    if (text.length < 120) throw new Error("The webpage did not contain enough readable text. Try another page, upload a file, or paste the relevant text.");

    let canonicalUrl = finalUrl.toString();
    if (canonical) {
      try {
        canonicalUrl = (await validatePublicUrl(new URL(canonical, finalUrl))).toString();
      } catch {
        canonicalUrl = finalUrl.toString();
      }
    }

    return NextResponse.json({ title, text, canonicalUrl, retrievedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The webpage could not be read.";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    clearTimeout(timer);
  }
}
