
const ALLOWED_ORIGIN = "https://jtnzx2fwqg-svg.github.io";
const SUPADATA_API = "https://api.supadata.ai/v1/transcript";

function jsonResponse(data, status = 200, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };

  if (origin === ALLOWED_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN;
    headers["Vary"] = "Origin";
  }

  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (origin && origin !== ALLOWED_ORIGIN) {
      return jsonResponse({ error: "Origin not allowed" }, 403);
    }

    if (request.method === "OPTIONS") {
      if (origin !== ALLOWED_ORIGIN) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405, origin);
    }

    if (!env.SUPADATA_API_KEY) {
      return jsonResponse({ error: "API key is not configured" }, 500, origin);
    }

    const incoming = new URL(request.url);

    try {
      let upstream;

      const jobId = incoming.searchParams.get("jobId");

      if (jobId) {
        if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) {
          return jsonResponse({ error: "Invalid jobId" }, 400, origin);
        }

        upstream = await fetch(
          `${SUPADATA_API}/${encodeURIComponent(jobId)}`,
          {
            headers: { "x-api-key": env.SUPADATA_API_KEY },
          }
        );
      } else {
        const videoUrl = incoming.searchParams.get("url");

        if (!videoUrl) {
          return jsonResponse(
            { error: "Missing url parameter" },
            400,
            origin
          );
        }

        let parsed;
        try {
          parsed = new URL(videoUrl);
        } catch {
          return jsonResponse({ error: "Invalid video URL" }, 400, origin);
        }

        const allowedHosts = [
          "youtube.com",
          "www.youtube.com",
          "m.youtube.com",
          "youtu.be",
          "www.youtube-nocookie.com",
        ];

        if (
          parsed.protocol !== "https:" ||
          !allowedHosts.includes(parsed.hostname)
        ) {
          return jsonResponse(
            { error: "Only supported YouTube URLs are allowed" },
            400,
            origin
          );
        }

        const apiUrl = new URL(SUPADATA_API);
        apiUrl.searchParams.set("url", videoUrl);
        apiUrl.searchParams.set("lang", "ja");
        apiUrl.searchParams.set("mode", "native");

        upstream = await fetch(apiUrl.toString(), {
          headers: { "x-api-key": env.SUPADATA_API_KEY },
        });
      }

      const body = await upstream.text();

      return new Response(body, {
        status: upstream.status,
        headers: {
          "Content-Type":
            upstream.headers.get("Content-Type") ||
            "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          ...(origin === ALLOWED_ORIGIN
            ? {
                "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
                "Vary": "Origin",
              }
            : {}),
        },
      });
    } catch {
      return jsonResponse(
        { error: "Unable to contact the transcript service" },
        502,
        origin
      );
    }
  },
};
