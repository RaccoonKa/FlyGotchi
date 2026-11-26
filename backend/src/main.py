from __future__ import annotations

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("flygotchi.brain")

# Resolve paths strictly via pathlib.Path for Linux/Windows/WSL2 compatibility
SRC_DIR = Path(__file__).resolve().parent
APP_DIR = SRC_DIR.parent
DEFAULT_DATA_DIR = (
    APP_DIR.parent / "data" if (APP_DIR.parent / "data").exists() else APP_DIR / "data"
)
DATA_DIR = Path(os.environ.get("FLYGOTCHI_DATA_DIR", str(DEFAULT_DATA_DIR)))

TICK_RATE_HZ = 20
TICK_INTERVAL_SEC = 1.0 / TICK_RATE_HZ
ARENA_WIDTH = 800.0
ARENA_HEIGHT = 600.0
ARENA_MARGIN = 36.0


class NeuralClusters(BaseModel):
    vision: float = Field(ge=0.0, le=1.0)
    motor: float = Field(ge=0.0, le=1.0)
    hunger: float = Field(ge=0.0, le=1.0)


class BrainState(BaseModel):
    tick: int
    x: float
    y: float
    angle: float
    hunger: float = Field(ge=0.0, le=1.0)
    state: Literal["foraging", "resting", "startled", "feeding"]
    clusters: NeuralClusters
    arena: dict[str, float]


class ClientCommand(BaseModel):
    action: Literal["feed", "poke", "stimulate_vision"]
    x: float | None = None
    y: float | None = None


class ConnectomeSimulator:
    """20 Hz placeholder connectome simulator for Drosophila melanogaster."""

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self._rng = np.random.default_rng()
        self._lock = asyncio.Lock()

        self.tick = 0
        self.x = ARENA_WIDTH / 2.0
        self.y = ARENA_HEIGHT / 2.0
        self.angle = float(self._rng.uniform(0.0, 2.0 * np.pi))
        self.speed = 65.0

        self.hunger = 0.25
        self.vision_excitation = 0.15
        self.motor_excitation = 0.35
        self._startle_ticks = 0
        self._feed_ticks = 0

    async def step(self) -> BrainState:
        """Advance simulation by one tick (50 ms)."""
        async with self._lock:
            self.tick += 1

            # Metabolic hunger increases slowly over time
            self.hunger = float(np.clip(self.hunger + 0.0012, 0.0, 1.0))

            # Decay transient sensory & motor spikes
            self.vision_excitation = float(np.clip(self.vision_excitation * 0.90 + 0.015, 0.05, 1.0))
            self.motor_excitation = float(np.clip(self.motor_excitation * 0.92, 0.05, 1.0))

            if self._feed_ticks > 0:
                self._feed_ticks -= 1
                state_label: Literal["foraging", "resting", "startled", "feeding"] = "feeding"
                target_speed = 12.0
            elif self._startle_ticks > 0:
                self._startle_ticks -= 1
                state_label = "startled"
                target_speed = 240.0
            elif self.hunger > 0.72:
                state_label = "foraging"
                target_speed = 115.0 + 40.0 * self.hunger
            else:
                # Alternate organically between wandering and brief grooming/resting pauses
                wave = np.sin(self.tick * 0.05)
                if wave < -0.65:
                    state_label = "resting"
                    target_speed = 8.0
                else:
                    state_label = "foraging"
                    target_speed = 70.0

            # Smooth speed & wandering heading updates
            self.speed = float(0.85 * self.speed + 0.15 * target_speed)
            turn_noise = float(self._rng.normal(0.0, 0.18 if state_label != "resting" else 0.03))
            self.angle = float((self.angle + turn_noise) % (2.0 * np.pi))

            dx = float(np.cos(self.angle) * self.speed * TICK_INTERVAL_SEC)
            dy = float(np.sin(self.angle) * self.speed * TICK_INTERVAL_SEC)
            next_x = self.x + dx
            next_y = self.y + dy

            # Soft boundary reflection + optic-lobe spike near arena walls
            bounced = False
            if next_x < ARENA_MARGIN:
                next_x = ARENA_MARGIN
                self.angle = float(np.pi - self.angle)
                bounced = True
            elif next_x > ARENA_WIDTH - ARENA_MARGIN:
                next_x = ARENA_WIDTH - ARENA_MARGIN
                self.angle = float(np.pi - self.angle)
                bounced = True

            if next_y < ARENA_MARGIN:
                next_y = ARENA_MARGIN
                self.angle = float(-self.angle)
                bounced = True
            elif next_y > ARENA_HEIGHT - ARENA_MARGIN:
                next_y = ARENA_HEIGHT - ARENA_MARGIN
                self.angle = float(-self.angle)
                bounced = True

            if bounced:
                self.vision_excitation = float(np.clip(self.vision_excitation + 0.30, 0.0, 1.0))

            self.x = float(next_x)
            self.y = float(next_y)
            self.angle = float(self.angle % (2.0 * np.pi))

            # Combine baseline dynamics with small neural firing jitter
            vision_level = float(
                np.clip(self.vision_excitation + self._rng.normal(0.0, 0.025), 0.0, 1.0)
            )
            motor_level = float(
                np.clip(
                    max(self.motor_excitation, self.speed / 240.0) + self._rng.normal(0.0, 0.025),
                    0.0,
                    1.0,
                )
            )
            hunger_cluster = float(
                np.clip(self.hunger * 0.9 + 0.05 + self._rng.normal(0.0, 0.015), 0.0, 1.0)
            )

            return BrainState(
                tick=self.tick,
                x=round(self.x, 2),
                y=round(self.y, 2),
                angle=round(self.angle, 4),
                hunger=round(self.hunger, 4),
                state=state_label,
                clusters=NeuralClusters(
                    vision=round(vision_level, 4),
                    motor=round(motor_level, 4),
                    hunger=round(hunger_cluster, 4),
                ),
                arena={"width": ARENA_WIDTH, "height": ARENA_HEIGHT},
            )

    async def apply_command(self, cmd: ClientCommand) -> None:
        """Apply external sensory or metabolic stimulus to the simulated brain."""
        async with self._lock:
            if cmd.action == "feed":
                self.hunger = float(np.clip(self.hunger - 0.35, 0.0, 1.0))
                self._feed_ticks = 30  # 1.5s feeding pause
                self._startle_ticks = 0
                self.motor_excitation = 0.15
                logger.info("Command feed applied -> hunger=%.2f", self.hunger)

            elif cmd.action == "poke":
                self.vision_excitation = 0.98
                self.motor_excitation = 0.95
                self._startle_ticks = 25  # 1.25s escape burst
                self._feed_ticks = 0

                if cmd.x is not None and cmd.y is not None:
                    # Steer away from the stimulus point if coordinates were provided
                    away_x = self.x - cmd.x
                    away_y = self.y - cmd.y
                    if float(np.hypot(away_x, away_y)) > 1.0:
                        self.angle = float(np.arctan2(away_y, away_x))
                else:
                    self.angle = float((self.angle + np.pi * 0.75) % (2.0 * np.pi))

                logger.info(
                    "Command poke applied at (x=%s, y=%s)",
                    cmd.x,
                    cmd.y,
                )

            elif cmd.action == "stimulate_vision":
                self.vision_excitation = 0.98
                self.motor_excitation = float(np.clip(self.motor_excitation + 0.45, 0.0, 1.0))
                self._startle_ticks = 15
                self.angle = float((self.angle + self._rng.uniform(-1.2, 1.2)) % (2.0 * np.pi))
                logger.info("Command stimulate_vision applied")

    def snapshot(self) -> BrainState:
        return BrainState(
            tick=self.tick,
            x=round(self.x, 2),
            y=round(self.y, 2),
            angle=round(self.angle, 4),
            hunger=round(self.hunger, 4),
            state="foraging",
            clusters=NeuralClusters(
                vision=round(self.vision_excitation, 4),
                motor=round(self.motor_excitation, 4),
                hunger=round(self.hunger, 4),
            ),
            arena={"width": ARENA_WIDTH, "height": ARENA_HEIGHT},
        )


class ConnectionManager:
    """Tracks connected WebSocket clients and broadcasts telemetry frames."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        logger.info("WebSocket client connected (active=%d)", len(self._connections))

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)
        logger.info("WebSocket client disconnected (active=%d)", len(self._connections))

    async def broadcast_json(self, payload: dict[str, Any]) -> None:
        if not self._connections:
            return
        message = json.dumps(payload)
        stale: list[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_text(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)


DATA_DIR.mkdir(parents=True, exist_ok=True)
simulator = ConnectomeSimulator(data_dir=DATA_DIR)
manager = ConnectionManager()


async def simulation_loop() -> None:
    """Background 20 Hz simulation loop broadcasting state to all clients."""
    logger.info("Starting connectome simulation loop at %d Hz", TICK_RATE_HZ)
    try:
        while True:
            state = await simulator.step()
            await manager.broadcast_json(state.model_dump())
            await asyncio.sleep(TICK_INTERVAL_SEC)
    except asyncio.CancelledError:
        logger.info("Simulation loop stopped")
        raise


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(simulation_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="FlyGotchi Connectome Brain API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "tick": simulator.tick,
        "data_dir": str(DATA_DIR),
        "data_dir_exists": DATA_DIR.exists(),
    }


@app.websocket("/ws/brain")
async def brain_websocket(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        await websocket.send_json(simulator.snapshot().model_dump())
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                cmd = ClientCommand.model_validate(data)
            except (json.JSONDecodeError, ValidationError) as exc:
                await websocket.send_json({"error": "invalid_command", "detail": str(exc)})
                continue
            await simulator.apply_command(cmd)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as exc:
        logger.warning("WebSocket error: %s", exc)
        manager.disconnect(websocket)


if __name__ == "__main__":
    import sys
    import uvicorn

    if str(APP_DIR) not in sys.path:
        sys.path.insert(0, str(APP_DIR))
    os.environ["PYTHONPATH"] = (
        f"{APP_DIR}{os.pathsep}{os.environ['PYTHONPATH']}"
        if os.environ.get("PYTHONPATH")
        else str(APP_DIR)
    )
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(SRC_DIR)],
    )
