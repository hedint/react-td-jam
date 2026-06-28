import type { EnemyId, EnemyState } from "@entities/game-session/model/types";

type EnemyLabelCandidate = Pick<EnemyState, "id" | "enemyId">;

export function updateFirstEnemyLabelAssignments(
  livingEnemies: readonly EnemyLabelCandidate[],
  labeledEnemyInstanceIds: Map<EnemyId, string>,
): ReadonlySet<string> {
  const visibleLabelInstanceIds = new Set<string>();

  livingEnemies.forEach((enemy) => {
    if (!labeledEnemyInstanceIds.has(enemy.enemyId)) {
      labeledEnemyInstanceIds.set(enemy.enemyId, enemy.id);
    }

    if (labeledEnemyInstanceIds.get(enemy.enemyId) === enemy.id) {
      visibleLabelInstanceIds.add(enemy.id);
    }
  });

  return visibleLabelInstanceIds;
}
