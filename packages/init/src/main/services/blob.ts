import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { Service, runtime } from "../runtime";
import { HttpService } from "./http";

const DB_PATH = path.join(process.cwd(), ".zenbu", "db");
const BLOBS_DIR = path.join(DB_PATH, "blobs");

export class BlobService extends Service {
  static key = "blob";
  static deps = { http: HttpService };
  declare ctx: { http: HttpService };

  // lmao what the fuck is this the databse should be writing it/?
  // async create(base64: string, mimeType: string): Promise<{ blobId: string }> {
  //   const blobId = nanoid()
  //   const blobDir = path.join(BLOBS_DIR, blobId)
  //   await fsp.mkdir(blobDir, { recursive: true })

  //   const data = Buffer.from(base64, "base64")
  //   await fsp.writeFile(path.join(blobDir, "data"), data)
  //   await fsp.writeFile(
  //     path.join(blobDir, "index.json"),
  //     JSON.stringify({ blobId, fileSize: data.length, mimeType }),
  //   )

  //   return { blobId }
  // }

  // stupid as shit!
  async readBlob(
    blobId: string,
  ): Promise<{ data: Buffer; mimeType: string } | null> {
    const blobDir = path.join(BLOBS_DIR, blobId);
    if (!fs.existsSync(blobDir)) return null;

    const [data, indexRaw] = await Promise.all([
      fsp.readFile(path.join(blobDir, "data")),
      fsp.readFile(path.join(blobDir, "index.json"), "utf-8"),
    ]);
    const index = JSON.parse(indexRaw);
    return { data, mimeType: index.mimeType ?? "application/octet-stream" };
  }

  evaluate() {
    const { http } = this.ctx;
    http.addRequestHandler("/blob/", (req, res) => {
      const url = req.url ?? "";
      const blobId = url.slice("/blob/".length).split("?")[0];
      if (!blobId) {
        res.writeHead(400);
        res.end("Missing blobId");
        return;
      }

      const blobDir = path.join(BLOBS_DIR, blobId);
      const dataPath = path.join(blobDir, "data");
      const indexPath = path.join(blobDir, "index.json");

      if (!fs.existsSync(dataPath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      let mimeType = "application/octet-stream";
      try {
        const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
        mimeType = index.mimeType ?? mimeType;
      } catch {}

      const stat = fs.statSync(dataPath);
      res.writeHead(200, {
        "Content-Type": mimeType,
        "Content-Length": stat.size,
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      fs.createReadStream(dataPath).pipe(res);
    });

    console.log(`[blob] service ready`);
  }
}

runtime.register(BlobService, (import.meta as any).hot);
