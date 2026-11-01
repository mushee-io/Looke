/** Bound authentication JSON request bodies even when Content-Length is absent or false. */
export async function parseBoundedJson(request, maxBytes = 16384) {
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(request.headers.get("content-type") ?? "")) {
    throw new Error("Expected application/json");
  }
  const encoding = request.headers.get("content-encoding");
  if (encoding !== null && encoding.trim().toLowerCase() !== "identity") {
    throw new Error("Unsupported Content-Encoding");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("Invalid body limit");
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^(0|[1-9][0-9]*)$/.test(declaredLength)) throw new Error("Invalid Content-Length");
    // Preflight is only an optimization: the streamed byte limit remains authoritative.
    if (BigInt(declaredLength) > BigInt(maxBytes)) throw new Error("JSON body too large");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing JSON body");
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) throw new Error("JSON body too large");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Expected a JSON object");
  }
  return payload;
}
