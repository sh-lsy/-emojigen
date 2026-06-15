export const runtime = "nodejs";

export async function GET() {
  const serverBase = process.env.OPENAI_BASE_URL || "https://token.sensenova.cn/v1";
  const hasServerKey = !!(
    process.env.OPENAI_API_KEY || process.env.EMOJIGEN_API_KEY
  );

  return Response.json({
    serverBase,
    hasServerKey,
  });
}
