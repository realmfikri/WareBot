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

robots.addRobot({ id: 'robot-1', name: 'Atlas', position: { x: 0, y: 0 }, target: { x: GRID_SIZE - 1, y: GRID_SIZE - 1 } });
robots.addRobot({ id: 'robot-2', name: 'Scout', position: { x: 2, y: GRID_SIZE - 2 }, target: { x: GRID_SIZE - 3, y: 1 } });
robots.addRobot({ id: 'robot-3', name: 'Courier', position: { x: GRID_SIZE - 1, y: 2 }, target: { x: 0, y: GRID_SIZE - 3 } });

function broadcast(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}

function sendSnapshot(socket) {
  socket.send(
    JSON.stringify({
      type: 'EventStateSnapshot',
      grid: grid.serialize(),
      robots: robots.serialize()
    })
  );
}

function handleObstacleUpdate(x, y, obstacle) {
  const updatedCell = grid.setObstacle(x, y, obstacle);
  if (!updatedCell) return;

  broadcast({
    type: 'EventGridCellUpdated',
    x,
    y,
    cell: updatedCell
  });

  const pathsChanged = robots.recalculateImpactedByCell(x, y);
  if (pathsChanged) {
    broadcast({ type: 'EventRobotPathsUpdated', robots: robots.serialize() });
  }
}

function handleMessage(raw) {
  const message = JSON.parse(raw.toString());
  const { type } = message;

  if (type === 'EventObstacleCreated' && Number.isInteger(message.x) && Number.isInteger(message.y)) {
    handleObstacleUpdate(message.x, message.y, true);
  } else if (type === 'EventObstacleCleared' && Number.isInteger(message.x) && Number.isInteger(message.y)) {
    handleObstacleUpdate(message.x, message.y, false);
  } else if (type === 'EventRobotTargetUpdated' && message.id && Number.isInteger(message.target?.x) && Number.isInteger(message.target?.y)) {
    robots.updateRobotTarget(message.id, message.target);
    broadcast({ type: 'EventRobotPathsUpdated', robots: robots.serialize() });
  }
}

wss.on('connection', (socket) => {
  sendSnapshot(socket);

  socket.on('message', (raw) => {
    try {
      handleMessage(raw);
    } catch (error) {
      console.error('Failed to handle message', error);
    }
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
