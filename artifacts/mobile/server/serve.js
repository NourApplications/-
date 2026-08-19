/**
 * Standalone production server for Expo static builds.
 *
 * Serves the output of build.js (static-build/) with two special routes:
 * - GET / or /manifest with expo-platform header → platform manifest JSON
 * - GET / without expo-platform → landing page HTML
 * Everything else falls through to static file serving from ./static-build/.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const TEMPLATE_PATH = path.resolve(__dirname, "templates", "landing-page.html");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

// Rate limiting: max requests per IP per window for large static assets
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 30;
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  return entry.count > RATE_MAX_REQUESTS;
}

// Periodically clean up stale rate limit entries
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS;
  for (const [ip, entry] of rateLimitMap) {
    if (entry.windowStart < cutoff) rateLimitMap.delete(ip);
  }
}, RATE_WINDOW_MS);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

// Versioned bundle paths (content-addressed) get long-lived immutable cache.
// Manifest and other routes get a short cache.
function getCacheControl(urlPath) {
  // Expo bundles are content-addressed (path contains a numeric hash segment)
  if (urlPath.includes("/_expo/static/") || urlPath.includes("/static/js/")) {
    return "public, max-age=31536000, immutable";
  }
  if (urlPath.endsWith(".woff") || urlPath.endsWith(".woff2") || urlPath.endsWith(".ttf")) {
    return "public, max-age=31536000, immutable";
  }
  // Short-lived cache for everything else (images, icons, etc.)
  return "public, max-age=3600";
}

function getAppName() {
  try {
    const appJsonPath = path.resolve(__dirname, "..", "app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

async function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");

  let stat;
  try {
    stat = await fs.promises.stat(manifestPath);
  } catch {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Manifest not found for platform: ${platform}` }));
    return;
  }

  const etag = `"${stat.mtime.getTime().toString(16)}-${stat.size.toString(16)}"`;
  const manifest = await fs.promises.readFile(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "cache-control": "public, max-age=60",
    "etag": etag,
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

function serveLandingPage(req, res, landingPageTemplate, appName) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=60",
  });
  res.end(html);
}

async function serveStaticFile(urlPath, req, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  if (stat.isDirectory()) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const cacheControl = getCacheControl(urlPath);
  const etag = `"${stat.mtime.getTime().toString(16)}-${stat.size.toString(16)}"`;
  const lastModified = stat.mtime.toUTCString();

  // Conditional GET — avoid re-sending bytes the client already has
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304);
    res.end();
    return;
  }
  if (!req.headers["if-none-match"] && req.headers["if-modified-since"]) {
    const since = new Date(req.headers["if-modified-since"]);
    if (stat.mtime <= since) {
      res.writeHead(304);
      res.end();
      return;
    }
  }

  res.writeHead(200, {
    "content-type": contentType,
    "content-length": stat.size,
    "cache-control": cacheControl,
    "etag": etag,
    "last-modified": lastModified,
  });

  // Stream the file — never buffer large assets into memory
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500);
    }
    res.end();
  });
  stream.pipe(res);
}

const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
const appName = getAppName();

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  // Rate limit all requests — applied before any route dispatch so manifest
  // probing and bundle downloads are both covered.
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    res.writeHead(429, { "retry-after": "60", "content-type": "text/plain" });
    res.end("Too Many Requests");
    return;
  }

  if (pathname === "/robots.txt") {
    const host = req.headers["x-forwarded-host"] || req.headers["host"];
    const forwardedProto = req.headers["x-forwarded-proto"];
    const protocol = forwardedProto || "https";
    const origin = `${protocol}://${host}`;
    const body = [
      "User-agent: *",
      "Allow: /",
      "",
      `Sitemap: ${origin}/sitemap.xml`,
    ].join("\n");
    res.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    });
    res.end(body);
    return;
  }

  if (pathname === "/sitemap.xml") {
    const host = req.headers["x-forwarded-host"] || req.headers["host"];
    const forwardedProto = req.headers["x-forwarded-proto"];
    const protocol = forwardedProto || "https";
    const origin = `${protocol}://${host}`;
    const today = new Date().toISOString().slice(0, 10);
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      "  <url>",
      `    <loc>${origin}/</loc>`,
      `    <lastmod>${today}</lastmod>`,
      "    <changefreq>monthly</changefreq>",
      "    <priority>1.0</priority>",
      "  </url>",
      "  <url>",
      `    <loc>${origin}/privacy</loc>`,
      `    <lastmod>${today}</lastmod>`,
      "    <changefreq>yearly</changefreq>",
      "    <priority>0.5</priority>",
      "  </url>",
      "</urlset>",
    ].join("\n");
    res.writeHead(200, {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
    });
    res.end(body);
    return;
  }

  if (pathname === "/privacy") {
    const body = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>سياسة الخصوصية — أذكار الصباح والمساء</title>
  <style>
    body { font-family: system-ui, -apple-system, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px 16px; color: #1a1a1a; line-height: 1.8; }
    h1 { color: #1a5c38; font-size: 1.6rem; margin-bottom: 8px; }
    h2 { color: #1a5c38; font-size: 1.1rem; margin-top: 32px; }
    p, li { font-size: 1rem; }
    ul { padding-right: 24px; }
    .updated { color: #666; font-size: 0.9rem; margin-bottom: 32px; }
    a { color: #1a5c38; }
  </style>
</head>
<body>
  <h1>سياسة الخصوصية</h1>
  <p class="updated">تاريخ آخر تحديث: يونيو 2026</p>

  <p>
    مرحبًا بك في تطبيق <strong>أذكار الصباح والمساء</strong>. نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.
    توضح هذه السياسة كيفية تعاملنا مع أي معلومات تتعلق باستخدامك للتطبيق.
  </p>

  <h2>البيانات التي نجمعها</h2>
  <p>
    لا يجمع التطبيق أي بيانات شخصية تُعرِّف هويتك. جميع تقدمك وإعداداتك وتسجيلاتك الصوتية تُخزَّن <strong>محليًا على جهازك فقط</strong>
    ولا تُرسَل إلى أي خادم خارجي.
  </p>

  <h2>ميزة تحويل النص إلى كلام (TTS)</h2>
  <p>
    عند استخدام ميزة الاستماع، يُرسَل نص الذكر إلى خادمنا لتوليد الصوت فقط. لا يتم تخزين هذا النص أو ربطه بأي هوية مستخدم.
  </p>

  <h2>الأذونات</h2>
  <ul>
    <li><strong>الميكروفون:</strong> يُستخدم فقط لتسجيل أذكارك الصوتية داخل التطبيق، ويبقى التسجيل على جهازك.</li>
    <li><strong>التخزين:</strong> لحفظ التسجيلات الصوتية وإعدادات التطبيق على جهازك.</li>
  </ul>

  <h2>مشاركة البيانات مع أطراف ثالثة</h2>
  <p>
    لا نبيع أي بيانات ولا نشاركها مع أطراف ثالثة لأغراض تجارية. لا يحتوي التطبيق على إعلانات.
  </p>

  <h2>الأطفال</h2>
  <p>
    التطبيق مناسب لجميع الأعمار. نظرًا لأننا لا نجمع أي بيانات شخصية، فلا توجد مخاوف خاصة بالأطفال.
  </p>

  <h2>التغييرات على هذه السياسة</h2>
  <p>
    قد نحدّث هذه السياسة من وقت لآخر. سيتم إشعارك بأي تغييرات جوهرية عبر تحديث التطبيق.
  </p>

  <h2>التواصل معنا</h2>
  <p>
    إذا كان لديك أي سؤال حول سياسة الخصوصية، يمكنك التواصل معنا عبر صفحة التطبيق على متجر Google Play.
  </p>
</body>
</html>`;
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=86400",
    });
    res.end(body);
    return;
  }

  if (pathname === "/llms.txt") {
    const body = [
      `# ${appName}`,
      "> أذكار الصباح والمساء — a mobile app for daily Islamic morning and evening remembrances (adhkar). The app plays and tracks dhikr recitations, supports text-to-speech, and stores user progress locally on-device.",
      "",
      "## Public Pages",
      "- [Home](/): Landing page with app download links and QR code for Expo Go.",
      "- [Privacy Policy](/privacy): Privacy policy describing data handling practices.",
      "",
      "## App",
      "- Native mobile app (iOS and Android) built with Expo / React Native.",
      "- Download via App Store or Google Play (see landing page for links).",
    ].join("\n");
    res.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    });
    res.end(body);
    return;
  }

  if (pathname === "/" || pathname === "/manifest") {
    const platform = req.headers["expo-platform"];
    if (platform === "ios" || platform === "android") {
      serveManifest(platform, res).catch(() => {
        if (!res.headersSent) { res.writeHead(500); res.end(); }
      });
      return;
    }

    if (pathname === "/") {
      return serveLandingPage(req, res, landingPageTemplate, appName);
    }
  }

  serveStaticFile(pathname, req, res).catch(() => {
    if (!res.headersSent) { res.writeHead(500); res.end(); }
  });
});

// Drop connections that don't complete their request headers within 10 s.
// This guards against slow-loris style attacks that would otherwise hold
// event-loop resources open indefinitely.
server.headersTimeout = 10_000;
// Give each request at most 30 s to finish (covers large bundle transfers on
// slow links while bounding the maximum time any connection can consume).
server.requestTimeout = 30_000;

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving static Expo build on port ${port}`);
});
