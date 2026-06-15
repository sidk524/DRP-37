const { createSessionSyncHub } = require("../src/sessionSyncHub");

// Minimal fake socket that records sent frames and lets us emit lifecycle events.
class FakeSocket {
    constructor() {
        this.OPEN = 1;
        this.readyState = 1;
        this.sent = [];
        this.listeners = {};
        this.closed = null;
    }

    on(event, handler) {
        this.listeners[event] = handler;
        return this;
    }

    emit(event, payload) {
        this.listeners[event]?.(payload);
    }

    send(data) {
        this.sent.push(JSON.parse(data));
    }

    close(code, reason) {
        this.closed = { code, reason };
        this.readyState = 3;
    }

    ping() {}

    terminate() {
        this.readyState = 3;
    }

    messages() {
        return this.sent;
    }
}

const connect = async (hub, socket, { token = "valid", deviceId, platform } = {}) => {
    await hub.handleConnection(socket, {
        url: `/api/session/sync?access_token=${token}`,
        headers: { host: "localhost" }
    });
    if (deviceId) {
        socket.emit("message", JSON.stringify({ type: "hello", deviceId, platform }));
    }
};

describe("session sync hub", () => {
    const makeHub = (snapshot = { id: "session-1" }) =>
        createSessionSyncHub({
            verifyToken: async (token) => (token === "valid" ? "user-1" : null),
            getSnapshot: async () => snapshot
        });

    it("sends a snapshot to a freshly connected client", async () => {
        const hub = makeHub({ id: "session-1", mode: "reflect" });
        const socket = new FakeSocket();
        await connect(hub, socket);

        expect(socket.messages()).toHaveLength(1);
        expect(socket.messages()[0]).toMatchObject({
            type: "session.sync",
            session: { id: "session-1", mode: "reflect" }
        });
        expect(hub.getConnectedCount("user-1")).toBe(1);
    });

    it("closes unauthorized connections with 4401", async () => {
        const hub = makeHub();
        const socket = new FakeSocket();
        await connect(hub, socket, { token: "bad" });

        expect(socket.closed?.code).toBe(4401);
        expect(hub.getConnectedCount("user-1")).toBe(0);
    });

    it("broadcasts to connected clients and suppresses the origin device", async () => {
        const hub = makeHub();
        const android = new FakeSocket();
        const windows = new FakeSocket();
        await connect(hub, android, { deviceId: "android-1", platform: "android" });
        await connect(hub, windows, { deviceId: "windows-1", platform: "windows" });

        // Clear the initial snapshot frames.
        android.sent.length = 0;
        windows.sent.length = 0;

        hub.broadcastSession("user-1", { id: "session-2" }, { excludeDeviceId: "windows-1" });

        expect(android.messages()).toHaveLength(1);
        expect(android.messages()[0]).toMatchObject({
            type: "session.sync",
            originDeviceId: "windows-1",
            session: { id: "session-2" }
        });
        expect(windows.messages()).toHaveLength(0);
    });

    it("drops a connection when its socket closes", async () => {
        const hub = makeHub();
        const socket = new FakeSocket();
        await connect(hub, socket, { deviceId: "android-1" });
        expect(hub.getConnectedCount("user-1")).toBe(1);

        socket.emit("close");
        expect(hub.getConnectedCount("user-1")).toBe(0);
    });

    it("replies to a ping with a pong", async () => {
        const hub = makeHub();
        const socket = new FakeSocket();
        await connect(hub, socket);
        socket.sent.length = 0;

        socket.emit("message", JSON.stringify({ type: "ping" }));
        expect(socket.messages()).toEqual([{ type: "pong" }]);
    });

    it("broadcasts arbitrary accountability events to connected clients", async () => {
        const hub = makeHub();
        const socket = new FakeSocket();
        await connect(hub, socket, { deviceId: "android-1" });
        socket.sent.length = 0;

        hub.broadcastEvent("user-1", { type: "accountability.unread", unreadCount: 3 });

        expect(socket.messages()).toEqual([{ type: "accountability.unread", unreadCount: 3 }]);
    });
});
