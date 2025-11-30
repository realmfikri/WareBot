const { findPath } = require('./aStar');

class Mutex {
  constructor() {
    this.lock = Promise.resolve();
  }

  runExclusive(fn) {
    const next = this.lock.then(fn, fn);
    this.lock = next.then(() => undefined, () => undefined);
    return next;
  }
}

class RobotManager {
  constructor(grid) {
    this.grid = grid;
    this.robots = new Map();
    this.mutex = new Mutex();
    this.metrics = {
      startedAt: Date.now(),
      completedTasks: 0,
      totalCompletionMs: 0,
      lastCompletionMs: null,
      collisionsAvoided: 0,
      congestionEvents: 0
    };
  }

  _recalculatePath(robot) {
    const path = findPath(this.grid, robot.position, robot.target);
    robot.path = path || [];
    robot.pathIndex = this._findNextIndex(robot);
    robot.lastCalculated = Date.now();
    return robot.path;
  }

  _findNextIndex(robot) {
    if (!robot.path || robot.path.length === 0) return 0;
    const currentIndex = robot.path.findIndex((node) => node.x === robot.position.x && node.y === robot.position.y);
    if (currentIndex === -1) return 1;
    return Math.min(currentIndex + 1, robot.path.length - 1);
  }

  _markTaskStarted(robot) {
    robot.taskStartedAt = Date.now();
  }

  _markTaskCompleted(robot) {
    const completedAt = Date.now();
    const duration = robot.taskStartedAt ? completedAt - robot.taskStartedAt : 0;
    this.metrics.completedTasks += 1;
    this.metrics.totalCompletionMs += duration;
    this.metrics.lastCompletionMs = duration;
    this._markTaskStarted(robot);
  }

  addRobot(robot) {
    return this.mutex.runExclusive(() => {
      const robotState = {
        ...robot,
        speed: robot.speed ?? 1,
        path: [],
        pathIndex: 0,
        movementRemainder: 0
      };
      this._markTaskStarted(robotState);
      this._recalculatePath(robotState);
      this.robots.set(robotState.id, robotState);
      return robotState;
    });
  }

  removeRobot(id) {
    return this.mutex.runExclusive(() => this.robots.delete(id));
  }

  recalculatePath(id) {
    return this.mutex.runExclusive(() => {
      const robot = this.robots.get(id);
      if (!robot) return null;
      return this._recalculatePath(robot);
    });
  }

  recalculateAll() {
    return this.mutex.runExclusive(() => {
      this.robots.forEach((robot) => {
        this._recalculatePath(robot);
      });
    });
  }

  recalculateImpactedByCell(x, y) {
    return this.mutex.runExclusive(() => {
      let changed = false;
      this.robots.forEach((robot) => {
        const hasPath = Array.isArray(robot.path) && robot.path.length > 0;
        const intersectsPath = robot.path?.some((node) => node.x === x && node.y === y);
        const intersectsEndpoints =
          (robot.position.x === x && robot.position.y === y) ||
          (robot.target.x === x && robot.target.y === y);

        if (!hasPath || intersectsPath || intersectsEndpoints) {
          this._recalculatePath(robot);
          changed = true;
        }
      });
      return changed;
    });
  }

  updateRobotTarget(id, target) {
    return this.mutex.runExclusive(() => {
      const robot = this.robots.get(id);
      if (!robot) return null;
      robot.target = target;
      this._markTaskStarted(robot);
      return this._recalculatePath(robot);
    });
  }

  updateRobotSpeed(id, speed) {
    return this.mutex.runExclusive(() => {
      const robot = this.robots.get(id);
      if (!robot) return null;
      robot.speed = speed;
      return robot;
    });
  }

  _serializeMetrics() {
    const averageCompletionMs = this.metrics.completedTasks
      ? this.metrics.totalCompletionMs / this.metrics.completedTasks
      : 0;
    const elapsedMinutes = (Date.now() - this.metrics.startedAt) / 60000;
    const tasksPerMinute = elapsedMinutes > 0 ? this.metrics.completedTasks / elapsedMinutes : 0;

    return {
      startedAt: this.metrics.startedAt,
      completedTasks: this.metrics.completedTasks,
      averageCompletionMs,
      lastCompletionMs: this.metrics.lastCompletionMs,
      collisionsAvoided: this.metrics.collisionsAvoided,
      congestionEvents: this.metrics.congestionEvents,
      tasksPerMinute
    };
  }

  async getMetrics() {
    return this.mutex.runExclusive(() => this._serializeMetrics());
  }

  _resolveNextStep(robot) {
    if (!robot.path || robot.path.length === 0) {
      this._recalculatePath(robot);
    }

    const nextNode = robot.path?.[robot.pathIndex];
    if (!nextNode) {
      this._recalculatePath(robot);
      return robot.path?.[robot.pathIndex];
    }

    return nextNode;
  }

  simulateTick(deltaSeconds = 1) {
    return this.mutex.runExclusive(() => {
      let moved = false;
      let metricsChanged = false;
      const occupied = new Map();

      this.robots.forEach((robot) => {
        occupied.set(`${robot.position.x},${robot.position.y}`, robot.id);
      });

      this.robots.forEach((robot) => {
        let stepBudget = (robot.speed ?? 1) * deltaSeconds + (robot.movementRemainder ?? 0);
        const steps = Math.floor(stepBudget);
        robot.movementRemainder = stepBudget - steps;

        for (let i = 0; i < steps; i += 1) {
          if (robot.position.x === robot.target.x && robot.position.y === robot.target.y) {
            break;
          }

          const nextNode = this._resolveNextStep(robot);
          if (!nextNode) break;

          const nextKey = `${nextNode.x},${nextNode.y}`;
          const currentKey = `${robot.position.x},${robot.position.y}`;

          if (occupied.has(nextKey)) {
            this.metrics.collisionsAvoided += 1;
            this.metrics.congestionEvents += 1;
            metricsChanged = true;
            break;
          }

          occupied.delete(currentKey);
          occupied.set(nextKey, robot.id);

          robot.position = { ...nextNode };
          robot.pathIndex = Math.min(robot.pathIndex + 1, (robot.path?.length || 1) - 1);
          moved = true;

          if (robot.position.x === robot.target.x && robot.position.y === robot.target.y) {
            this._markTaskCompleted(robot);
            metricsChanged = true;
            this._recalculatePath(robot);
            break;
          }
        }
      });

      return { moved, metricsChanged, metrics: this._serializeMetrics() };
    });
  }

  serialize() {
    return this.mutex.runExclusive(() =>
      Array.from(this.robots.values()).map((robot) => ({
        ...robot,
        path: robot.path?.map((node) => ({ ...node })) || []
      }))
    );
  }
}

module.exports = { RobotManager };
