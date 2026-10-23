import { getCharacterPackages, publicCharacters } from "./_lib/characters.mjs";

export default async request => {
  if (request.method !== "GET") return json({ error: "不支持的请求方法" }, 405);

  try {
    const packages = await getCharacterPackages();
    return json({ characters: publicCharacters(packages) });
  } catch (error) {
    console.error("人物包加载失败", error);
    return json({ error: "人物资料加载失败" }, 500);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
