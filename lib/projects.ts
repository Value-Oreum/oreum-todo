import { type Task } from "./domain.ts";
export const projectKey = (name: string) =>
  name.trim().normalize("NFKC").toLocaleLowerCase("ko-KR");
export function projectGroups(tasks: Task[], includeDeleted = false) {
  const groups = new Map<
    string,
    { key: string; name: string; tasks: Task[] }
  >();
  for (const task of tasks) {
    if ((!includeDeleted && task.deleted) || !task.company.trim()) continue;
    const key = projectKey(task.company);
    if (!groups.has(key))
      groups.set(key, { key, name: task.company.trim(), tasks: [] });
    groups.get(key)!.tasks.push(task);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      tasks: group.tasks.sort(
        (a, b) =>
          (a.history[0]?.at || a.updated_at).localeCompare(
            b.history[0]?.at || b.updated_at,
          ) || a.id.localeCompare(b.id),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
