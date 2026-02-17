import { runIncremental } from "./ingest";

(async () => {
  try {
    await runIncremental();
    process.exit(0);
  } catch (err) {
    console.error("Daily sync error:", err);
    process.exit(1);
  }
})();
