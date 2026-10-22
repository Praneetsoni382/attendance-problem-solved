import express, { type Request, type Response } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import apiRouter from "./artifacts/api-server/src/routes/index";
import { startFinalizationJob } from "./artifacts/api-server/src/lib/attendwise-store";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static assets
app.use("/attached_assets", express.static(path.resolve(__dirname, "attached_assets")));

// API Router
app.use("/api", apiRouter);

// Start background task for auto-finalizing expired sessions
startFinalizationJob();

async function startServer() {
  if (isProd) {
    const distPath = path.resolve(__dirname, "artifacts/attendwise/dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.use((_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    }
  } else {
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, "artifacts/attendwise/vite.config.ts"),
      root: path.resolve(__dirname, "artifacts/attendwise"),
      server: {
        middlewareMode: true,
        host: "0.0.0.0",
        port: PORT,
        allowedHosts: true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Fallback for SPA routing in development
    app.use(async (req: Request, res: Response, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        return next();
      }
      const url = req.originalUrl;
      try {
        const templatePath = path.resolve(__dirname, "artifacts/attendwise/index.html");
        let template = fs.readFileSync(templatePath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AttendWise full-stack server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
