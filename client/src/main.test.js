import { describe, expect, beforeEach, vi, it } from 'vitest';

let mockSocket;
let sockets = [];

class MockWebSocket {
  static OPEN = 1;

  constructor() {
    this.readyState = MockWebSocket.OPEN;
    this.sent = [];
    this.listeners = { open: [], close: [] };
    sockets.push(this);
    mockSocket = this;
    queueMicrotask(() => this.listeners.open.forEach((listener) => listener({}))); // simulate immediate open
  }

  addEventListener(type, listener) {
    this.listeners[type]?.push(listener);
  }

  send(payload) {
    this.sent.push(payload);
  }

  close() {}
}

describe('layout editor interactions', () => {
  beforeEach(async () => {
    vi.resetModules();
    sockets = [];
    document.body.innerHTML = `
      <div id="grid"></div>
      <div id="status-indicator"></div>
      <div id="status-text"></div>
      <div id="robot-list"></div>
      <div id="metrics"></div>
    `;

    global.WebSocket = MockWebSocket;
    await import('./main.js');
  });

  it('toggles obstacles and emits obstacle events', async () => {
    const { handleSnapshot } = await import('./main.js');

    const snapshot = {
      type: 'EventStateSnapshot',
      grid: [
        [
          { obstacle: false, updatedAt: Date.now() },
          { obstacle: false, updatedAt: Date.now() }
        ],
        [
          { obstacle: false, updatedAt: Date.now() },
          { obstacle: false, updatedAt: Date.now() }
        ]
      ],
      robots: [],
      metrics: { completedTasks: 0, averageCompletionMs: 0, lastCompletionMs: null, collisionsAvoided: 0, congestionEvents: 0, tasksPerMinute: 0 }
    };

    handleSnapshot(snapshot);

    const targetTile = document.querySelector('[data-x="1"][data-y="0"]');
    expect(targetTile).toBeTruthy();

    targetTile.click();
    expect(targetTile.classList.contains('obstacle')).toBe(true);
    expect(mockSocket.sent).toHaveLength(1);
    expect(JSON.parse(mockSocket.sent[0]).type).toBe('EventObstacleCreated');

    targetTile.click();
    expect(targetTile.classList.contains('obstacle')).toBe(false);
    expect(JSON.parse(mockSocket.sent[1]).type).toBe('EventObstacleCleared');
  });
});
