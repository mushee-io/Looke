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
  // Reject a UTF-8 BOM explicitly: TextDecoder strips it by default, which can hide noncanonical input.
  if (length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new Error("JSON UTF-8 BOM not permitted");
  }
  const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Expected a JSON object");
  }
  // Reject deeply nested authentication data without recursive traversal.
  const pending = [{ value: payload, depth: 1 }];
  let visited = 0;
  const maxNodes = 2048;
  const maxProperties = 2048;
  let properties = 0;
  while (pending.length) {
    const { value, depth } = pending.pop();
    if (++visited > maxNodes) throw new Error("JSON structure too complex");
    if (depth > 32) throw new Error("JSON nesting too deep");
    for (const [key, child] of Object.entries(value)) {
      if (++properties > maxProperties) throw new Error("JSON has too many properties");
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        throw new Error("Forbidden JSON property");
      }
      if (child !== null && typeof child === "object") {
        // Count queued containers too, so wide payloads fail before large traversal queues form.
        if (visited + pending.length >= maxNodes) throw new Error("JSON structure too complex");
        pending.push({ value: child, depth: depth + 1 });
      }
    }
  }
  return payload;
}
