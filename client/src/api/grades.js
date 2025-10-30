export async function fetchGrades(sessionId) {
  const res = await fetch(`/api/grade-breakdown?sessionId=${encodeURIComponent(sessionId)}`, { credentials:"include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.message || "Failed to fetch");
  return data;
}
export async function saveGroupMark(sessionId, team, groupMark) {
  const res = await fetch(`/api/group-marks?sessionId=${encodeURIComponent(sessionId)}`, {
    method:"POST",
    credentials:"include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ team, groupMark: Math.round(Number(groupMark)) })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.message || "Save failed");
  return true;
}
