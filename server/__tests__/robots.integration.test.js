const { Grid } = require('../src/pathfinding/grid');
const { RobotManager } = require('../src/pathfinding/robots');

describe('Obstacle events and robot rerouting', () => {
  test('robots reroute around new obstacles on their path', async () => {
    const grid = new Grid(4, 4);
    const robots = new RobotManager(grid);

    await robots.addRobot({
      id: 'robot-1',
      name: 'Atlas',
      position: { x: 0, y: 0 },
      target: { x: 3, y: 0 }
    });

    const initialSnapshot = await robots.serialize();
    const initialPath = initialSnapshot[0].path.map(({ x, y }) => `${x},${y}`);
    expect(initialPath).toEqual(['0,0', '1,0', '2,0', '3,0']);

    grid.setObstacle(1, 0, true);
    const pathsChanged = await robots.recalculateImpactedByCell(1, 0);
    expect(pathsChanged).toBe(true);

    const updatedSnapshot = await robots.serialize();
    const reroutedPath = updatedSnapshot[0].path.map(({ x, y }) => `${x},${y}`);
    expect(reroutedPath).toEqual(['0,0', '0,1', '1,1', '2,1', '3,1', '3,0']);
    expect(reroutedPath).not.toContain('1,0');
  });

  test('clearing a blocking obstacle restores movement and completes the task', async () => {
    const grid = new Grid(3, 3);
    const robots = new RobotManager(grid);

    grid.setObstacle(1, 0, true);
    await robots.addRobot({
      id: 'robot-2',
      name: 'Scout',
      position: { x: 0, y: 0 },
      target: { x: 1, y: 0 }
    });

    const blockedSnapshot = await robots.serialize();
    expect(blockedSnapshot[0].path).toEqual([]);

    grid.setObstacle(1, 0, false);
    const pathsChanged = await robots.recalculateImpactedByCell(1, 0);
    expect(pathsChanged).toBe(true);

    await robots.simulateTick(1);
    const completedSnapshot = await robots.serialize();
    const { position } = completedSnapshot[0];
    const serializedMetrics = await robots.getMetrics();

    expect(position).toEqual({ x: 1, y: 0 });
    expect(serializedMetrics.completedTasks).toBeGreaterThanOrEqual(1);
    expect(serializedMetrics.lastCompletionMs).not.toBeNull();
  });
});
