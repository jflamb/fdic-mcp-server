import { main } from "./index.js";

main().catch((error: unknown) => {
  console.error("Server error:", error);
  process.exit(1);
});
