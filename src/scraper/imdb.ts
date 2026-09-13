/**
 * IMDb ratings straight from IMDb's daily dataset (title.ratings.tsv.gz, free for non-commercial use).
 * The file is ~7 MB compressed; it is downloaded at most once a day and streamed, keeping only the ids we need.
 */
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

const URL = "https://datasets.imdbws.com/title.ratings.tsv.gz";
const FILE = path.join(process.cwd(), "data", "imdb-ratings.tsv.gz");
const DAY = 86_400_000;

async function ensureFile(): Promise<string> {
  try {
    const st = await stat(FILE);
    if (Date.now() - st.mtimeMs < DAY && st.size > 1_000_000) return FILE;
  } catch { /* download */ }
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`IMDb dataset HTTP ${res.status}`);
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, Buffer.from(await res.arrayBuffer()));
  return FILE;
}

/** { tt1234567: { rating, votes } } for the requested ids. */
export async function loadImdbRatings(ids: Set<string>): Promise<Map<string, { rating: number; votes: number }>> {
  const out = new Map<string, { rating: number; votes: number }>();
  if (!ids.size) return out;
  const file = await ensureFile();
  const rl = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of rl) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const id = line.slice(0, tab);
    if (!ids.has(id)) continue;
    const [, rating, votes] = line.split("\t");
    out.set(id, { rating: Number(rating), votes: Number(votes) });
    if (out.size === ids.size) break;
  }
  rl.close();
  return out;
}
