import { createServer } from "http";
import { runBackfill, runDeletedCheck, runIncremental } from "./ingest";

type SyncMode = "incremental" | "backfill" | "check_deleted";

type SyncState = {
  running: boolean;
  mode: SyncMode | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  lastExit: "success" | "error" | null;
};

const port = Number(process.env.SYNC_SERVER_PORT || 8787);
const apiToken = (process.env.SYNC_API_TOKEN || "").trim();

if (!apiToken) {
  throw new Error("Missing env var SYNC_API_TOKEN");
}

const state: SyncState = {
  running: false,
  mode: null,
  startedAt: null,
  finishedAt: null,
  lastError: null,
  lastExit: null
};

function sendJson(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readBearerToken(req: any) {
  const authHeader = String(req.headers.authorization || "");
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

function isAuthorized(req: any) {
  const token = readBearerToken(req);
  return token.length > 0 && token === apiToken;
}

function runSyncInBackground(mode: SyncMode) {
  if (state.running) return false;

  state.running = true;
  state.mode = mode;
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.lastError = null;
  state.lastExit = null;

  const task =
    mode === "backfill"
      ? runBackfill()
      : mode === "check_deleted"
      ? runDeletedCheck()
      : runIncremental();

  task
    .then(() => {
      state.running = false;
      state.finishedAt = new Date().toISOString();
      state.lastExit = "success";
      state.lastError = null;
    })
    .catch((err) => {
      state.running = false;
      state.finishedAt = new Date().toISOString();
      state.lastExit = "error";
      state.lastError = err instanceof Error ? err.message : String(err);
      console.error("[sync-server] sync failed:", err);
    });

  return true;
}

const server = createServer((req, res) => {
  const method = req.method || "GET";
  const url = req.url || "/";

  if (method === "GET" && url === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  if (method === "GET" && url === "/sync/status") {
    sendJson(res, 200, state);
    return;
  }

  if (method === "POST" && url === "/sync/start") {
    let bodyRaw = "";
    req.on("data", (chunk) => {
      bodyRaw += chunk;
      if (bodyRaw.length > 1024 * 64) {
        req.destroy();
      }
    });
    req.on("end", () => {
      let mode: SyncMode = "incremental";
      try {
        const body = bodyRaw ? JSON.parse(bodyRaw) : {};
        if (body?.mode === "backfill") mode = "backfill";
        if (body?.mode === "check_deleted") mode = "check_deleted";
      } catch {}

      if (state.running) {
        sendJson(res, 409, {
          error: "Parser is already running",
          ...state
        });
        return;
      }

      runSyncInBackground(mode);
      sendJson(res, 202, {
        ok: true,
        ...state
      });
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[sync-server] listening on 0.0.0.0:${port}`);
});
