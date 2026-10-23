import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

let cachedPackages;

export async function getCharacterPackages() {
  if (!cachedPackages) cachedPackages = loadCharacterPackages();
  return cachedPackages;
}

export function publicCharacters(packages) {
  return [...packages.values()].map(item => item.publicData);
}

async function loadCharacterPackages() {
  const charactersDirectory = resolve(process.cwd(), "characters");
  const packages = new Map();
  const entries = await readdir(charactersDirectory, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = join(charactersDirectory, entry.name);
    let config;
    try {
      config = JSON.parse(await readFile(join(directory, "character.json"), "utf8"));
    } catch {
      continue;
    }

    validateCharacterConfig(config);
    const systemPrompt = await readReferencedText(directory, config.promptFile);
    const boundaries = await readReferencedText(directory, config.boundaryFile);
    const knowledgeParts = await Promise.all((config.knowledgeFiles || []).map(file => readReferencedText(directory, file)));
    const examples = JSON.parse(await readReferencedText(directory, config.exampleFile));
    if (!Array.isArray(examples)) throw new Error(`${config.id} 的 examples.json 必须是数组`);

    packages.set(config.id, {
      config,
      systemPrompt,
      boundaries,
      knowledge: knowledgeParts.join("\n\n"),
      examples,
      publicData: {
        id: config.id,
        name: config.name,
        sigil: [...config.name][0] || "人",
        role: config.summary,
        source: config.source,
        era: config.era,
        greeting: config.greeting,
        status: config.type === "historical" ? "来自历史的人物回声" : "人物档案已连接"
      }
    });
  }

  if (packages.size === 0) throw new Error("没有可用的人物包");
  return packages;
}

async function readReferencedText(directory, declaredName) {
  if (!declaredName || typeof declaredName !== "string") throw new Error("人物包引用文件名无效");
  const entries = await readdir(directory);
  const targetName = entries.find(name => normalizeHyphens(name) === normalizeHyphens(declaredName));
  if (!targetName) throw new Error(`人物包缺少引用文件：${declaredName}`);
  const targetPath = resolve(directory, targetName);
  if (relative(directory, targetPath).startsWith("..")) throw new Error("人物包引用路径越界");
  return readFile(targetPath, "utf8");
}

function validateCharacterConfig(config) {
  if (!config || typeof config !== "object") throw new Error("character.json 内容无效");
  for (const key of ["id", "name", "summary", "greeting", "promptFile", "exampleFile", "boundaryFile"]) {
    if (typeof config[key] !== "string" || !config[key].trim()) throw new Error(`character.json 缺少 ${key}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.id)) throw new Error(`人物 ID 不合法：${config.id}`);
}

function normalizeHyphens(value) {
  return value.normalize("NFKC").replace(/[‐‑‒–—−]/g, "-").toLowerCase();
}
