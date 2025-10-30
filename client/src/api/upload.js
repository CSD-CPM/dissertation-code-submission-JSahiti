export async function uploadCsv({ file, paWeight, numCriteria, penaltyPercent, preview=false }) {
  const fd = new FormData();
  fd.append("file", file);
  if (paWeight !== "")        fd.append("paWeight", String(paWeight));
  if (numCriteria !== "")     fd.append("numCriteria", String(numCriteria));
  if (penaltyPercent !== "")  fd.append("penaltyPercent", String(penaltyPercent));

  const url = preview ? "/upload?preview=1" : "/upload";
  const res = await fetch(url, { method: "POST", body: fd, credentials: "include" });
  const raw = await res.text();
  let data; try { data = JSON.parse(raw); } catch { throw new Error(`Server did not return JSON (${res.status})`); }
  if (!res.ok || !data?.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
}
