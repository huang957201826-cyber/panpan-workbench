/** 只保留当前可见/过滤后的任务选择；图片节点不参与任务选择裁剪 */
export function pruneTaskSelection(selected: Iterable<string>, visibleTasks: Array<{ id: string }>) {
  const visible = new Set(visibleTasks.map((task) => task.id))
  const next = new Set<string>()
  for (const id of selected) {
    if (visible.has(id)) next.add(id)
  }
  return next
}

export function pickSelectedTasks<T extends { id: string }>(tasks: T[], selected: Iterable<string>) {
  const ids = new Set(selected)
  return tasks.filter((task) => ids.has(task.id))
}
