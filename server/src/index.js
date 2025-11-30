const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { Grid } = require('./pathfinding/grid');
const { RobotManager } = require('./pathfinding/robots');

const PORT = process.env.PORT || 8080;
const GRID_SIZE = 12;

const server = createServer();
const wss = new WebSocketServer({ server });

const grid = new Grid(GRID_SIZE, GRID_SIZE);
const robots = new RobotManager(grid);

function broadcast(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}

async function sendSnapshot(socket) {
  socket.send(
    JSON.stringify({
      type: 'EventStateSnapshot',
      grid: grid.serialize(),
      robots: await robots.serialize(),
      metrics: await robots.getMetrics()
    })
  );
}

async function broadcastRobots(type = 'EventRobotPathsUpdated') {
  broadcast({ type, robots: await robots.serialize(), metrics: await robots.getMetrics() });
}

async function handleObstacleUpdate(x, y, obstacle) {
  const updatedCell = grid.setObstacle(x, y, obstacle);
  if (!updatedCell) return;

  broadcast({
    type: 'EventGridCellUpdated',
    x,
    y,
    cell: updatedCell
  });

  const pathsChanged = await robots.recalculateImpactedByCell(x, y);
  if (pathsChanged) {
    await broadcastRobots();
  }
}

async function handleMessage(raw) {
  const message = JSON.parse(raw.toString());
  const { type } = message;

  if (type === 'EventObstacleCreated' && Number.isInteger(message.x) && Number.isInteger(message.y)) {
    await handleObstacleUpdate(message.x, message.y, true);
  } else if (type === 'EventObstacleCleared' && Number.isInteger(message.x) && Number.isInteger(message.y)) {
    await handleObstacleUpdate(message.x, message.y, false);
  } else if (type === 'EventRobotTargetUpdated' && message.id && Number.isInteger(message.target?.x) && Number.isInteger(message.target?.y)) {
    await robots.updateRobotTarget(message.id, message.target);
    await broadcastRobots();
  } else if (type === 'EventRobotCreated' && message.id && message.name && Number.isInteger(message.position?.x) && Number.isInteger(message.position?.y)) {
    await robots.addRobot({
      id: message.id,
      name: message.name,
      position: message.position,
      target: message.target || message.position,
      speed: Number.isFinite(message.speed) ? message.speed : undefined
    });
    await broadcastRobots('EventRobotListUpdated');
  } else if (type === 'EventRobotRemoved' && message.id) {
    await robots.removeRobot(message.id);
    await broadcastRobots('EventRobotListUpdated');
  } else if (type === 'EventRobotSpeedUpdated' && message.id && Number.isFinite(message.speed)) {
    await robots.updateRobotSpeed(message.id, message.speed);
    await broadcastRobots('EventRobotListUpdated');
  }
}

wss.on('connection', (socket) => {
  sendSnapshot(socket);

  socket.on('message', (raw) => {
    Promise.resolve(handleMessage(raw)).catch((error) => {
      console.error('Failed to handle message', error);
    });
  });
});

Promise.all([
  robots.addRobot({ id: 'robot-1', name: 'Atlas', position: { x: 0, y: 0 }, target: { x: GRID_SIZE - 1, y: GRID_SIZE - 1 } }),
  robots.addRobot({ id: 'robot-2', name: 'Scout', position: { x: 2, y: GRID_SIZE - 2 }, target: { x: GRID_SIZE - 3, y: 1 } }),
  robots.addRobot({ id: 'robot-3', name: 'Courier', position: { x: GRID_SIZE - 1, y: 2 }, target: { x: 0, y: GRID_SIZE - 3 } })
])
  .catch((error) => {
    console.error('Failed to initialize robots', error);
  })
  .finally(() => {
    server.listen(PORT, () => {
      console.log(`WebSocket server running on ws://localhost:${PORT}`);
    });

    setInterval(async () => {
      const { moved, metricsChanged } = await robots.simulateTick(0.5);
      if (moved || metricsChanged) {
        broadcast({
          type: 'EventSimulationUpdated',
          robots: await robots.serialize(),
          metrics: await robots.getMetrics()
        });
      }
    }, 500);
  });
