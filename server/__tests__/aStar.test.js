const { Grid } = require('../src/pathfinding/grid');
const { findPath } = require('../src/pathfinding/aStar');

describe('A* pathfinding on dynamic grids', () => {
  test('recalculates optimal paths as obstacles change', () => {
    const grid = new Grid(4, 4);
    const start = { x: 0, y: 0 };
    const goal = { x: 3, y: 0 };

    const initialPath = findPath(grid, start, goal);
    expect(initialPath.map(({ x, y }) => `${x},${y}`)).toEqual(['0,0', '1,0', '2,0', '3,0']);

    grid.setObstacle(1, 0, true);
    const detourPath = findPath(grid, start, goal);

    expect(detourPath.map(({ x, y }) => `${x},${y}`)).toEqual([
      '0,0',
      '0,1',
      '1,1',
      '2,1',
      '3,1',
      '3,0'
    ]);

    grid.setObstacle(1, 0, false);
    const reopenedPath = findPath(grid, start, goal);
    expect(reopenedPath.map(({ x, y }) => `${x},${y}`)).toEqual(['0,0', '1,0', '2,0', '3,0']);
  });

  test('returns null when start or goal are blocked or out of bounds', () => {
    const grid = new Grid(2, 2);
    const start = { x: -1, y: 0 };
    const goal = { x: 1, y: 1 };

    expect(findPath(grid, start, goal)).toBeNull();

    const validStart = { x: 0, y: 0 };
    grid.setObstacle(1, 1, true);
    expect(findPath(grid, validStart, goal)).toBeNull();
  });
});
