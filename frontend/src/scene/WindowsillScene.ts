import { BlurFilter, Container, Graphics } from 'pixi.js';
import type { TimeOfDay } from '../types/brain';

export const SCENE_WIDTH = 800;
export const SCENE_HEIGHT = 600;

export const SILL_INTERACTABLES = {
  berryBasket: { x: 175, y: 428, radius: 52 },
  dewDrop: { x: 525, y: 326, radius: 26 },
} as const;

const OUTLINE = 0x2b1e1f;

interface DustMote {
  graphic: Graphics;
  baseX: number;
  baseY: number;
  speedY: number;
  driftAmp: number;
  phase: number;
}

interface TimeTheme {
  skyTop: number;
  skyBottom: number;
  wallColor: number;
  frameColor: number;
  sillTopColor: number;
  sillFrontColor: number;
  rayColor: number;
  rayAlpha: number;
  tintColor: number;
  tintAlpha: number;
  moteColor: number;
  moteAlpha: number;
  showStars: boolean;
  cloudAlpha: number;
  treeColor: number;
}

const THEMES: Record<TimeOfDay, TimeTheme> = {
  morning: {
    skyTop: 0x7dd3fc,
    skyBottom: 0xfde68a,
    wallColor: 0x3b2f35,
    frameColor: 0xfef3c7,
    sillTopColor: 0xe6c79c,
    sillFrontColor: 0xc59d6f,
    rayColor: 0xfef08a,
    rayAlpha: 0.19,
    tintColor: 0xfde047,
    tintAlpha: 0.05,
    moteColor: 0xfef9c3,
    moteAlpha: 0.78,
    showStars: false,
    cloudAlpha: 0.85,
    treeColor: 0x15803d,
  },
  day: {
    skyTop: 0x38bdf8,
    skyBottom: 0xbae6fd,
    wallColor: 0x2c3345,
    frameColor: 0xf8fafc,
    sillTopColor: 0xead1ae,
    sillFrontColor: 0xc9a377,
    rayColor: 0xffffff,
    rayAlpha: 0.16,
    tintColor: 0xbae6fd,
    tintAlpha: 0.02,
    moteColor: 0xffffff,
    moteAlpha: 0.7,
    showStars: false,
    cloudAlpha: 0.92,
    treeColor: 0x16a34a,
  },
  sunset: {
    skyTop: 0x7c3aed,
    skyBottom: 0xfb923c,
    wallColor: 0x33202e,
    frameColor: 0xfed7aa,
    sillTopColor: 0xd9a77e,
    sillFrontColor: 0xaa7651,
    rayColor: 0xfdba74,
    rayAlpha: 0.22,
    tintColor: 0xf97316,
    tintAlpha: 0.12,
    moteColor: 0xffedd5,
    moteAlpha: 0.82,
    showStars: false,
    cloudAlpha: 0.65,
    treeColor: 0x14532d,
  },
  night: {
    skyTop: 0x090d1f,
    skyBottom: 0x1e293b,
    wallColor: 0x131726,
    frameColor: 0x64748b,
    sillTopColor: 0x6b584b,
    sillFrontColor: 0x4b3c33,
    rayColor: 0x93c5fd,
    rayAlpha: 0.08,
    tintColor: 0x0f172a,
    tintAlpha: 0.34,
    moteColor: 0xa3e635,
    moteAlpha: 0.88,
    showStars: true,
    cloudAlpha: 0.18,
    treeColor: 0x052e16,
  },
};

export interface WindowsillSceneHandle {
  root: Container;
  flyLayer: Container;
  shadow: Graphics;
  setTimeOfDay: (time: TimeOfDay) => void;
  update: (deltaTime: number, timeOfDay: TimeOfDay) => void;
}

export function createWindowsillScene(
  onDewClick: (x: number, y: number) => void,
  onBerryClick: (x: number, y: number) => void
): WindowsillSceneHandle {
  const root = new Container();

  // 1. Outdoor backdrop visible through window (soft sky + crisp cartoon street)
  const outdoorLayer = new Container();
  const skyBackdrop = new Container();
  const skyGraphics = new Graphics();
  const cloudsGraphics = new Graphics();
  const starsAndMoon = new Graphics();
  skyBackdrop.addChild(skyGraphics, starsAndMoon, cloudsGraphics);
  skyBackdrop.filters = [new BlurFilter({ strength: 1.2 })];

  const streetGraphics = new Graphics();

  // Masked lane for occasional cartoon cars outside the window
  const carsLayer = new Container();
  const carsMask = new Graphics().rect(74, 32, 652, 382).fill({ color: 0xffffff });
  carsLayer.mask = carsMask;

  interface StreetCar {
    container: Container;
    headlights: Graphics;
    dir: 1 | -1;
    speed: number;
    cooldown: number;
    active: boolean;
  }

  const carA = createCartoonCar(0xef4444, 1);
  carA.container.y = 376;
  carA.container.x = 180;
  const carB = createCartoonCar(0x38bdf8, -1);
  carB.container.y = 395;
  carB.container.x = 760;

  const cars: StreetCar[] = [
    { ...carA, dir: 1, speed: 1.55, cooldown: 30, active: true },
    { ...carB, dir: -1, speed: 1.85, cooldown: 210, active: false },
  ];
  for (const car of cars) {
    car.container.visible = car.active;
    carsLayer.addChild(car.container);
  }

  outdoorLayer.addChild(skyBackdrop, streetGraphics, carsMask, carsLayer);

  // 2. Room wall & cozy cartoon window frame
  const windowLayer = new Container();
  const wallAndFrame = new Graphics();
  const glassSheen = new Graphics();
  glassSheen
    .poly([120, 45, 175, 45, 105, 360, 75, 360])
    .poly([425, 45, 458, 45, 395, 360, 365, 360])
    .fill({ color: 0xffffff, alpha: 0.11 });
  windowLayer.addChild(wallAndFrame, glassSheen);

  // 3. Diagonal sun / moon rays
  const raysLayer = new Container();
  const raysGraphics = new Graphics();
  raysLayer.addChild(raysGraphics);

  // 4. Foreground wooden/cream windowsill
  const sillLayer = new Container();
  const sillGraphics = new Graphics();
  sillLayer.addChild(sillGraphics);

  // 5. Left: cozy wicker basket with raspberries | Right: terracotta pot with blooming flower & dew leaf
  const propsLayer = new Container();
  const basket = buildBerryBasket(onBerryClick);
  basket.x = SILL_INTERACTABLES.berryBasket.x;
  basket.y = SILL_INTERACTABLES.berryBasket.y;

  const { potGroup, dewDrop, dewHighlight, flowerHead } = buildFlowerPotWithDew(onDewClick);
  potGroup.x = 635;
  potGroup.y = 445;

  propsLayer.addChild(basket, potGroup);

  // 6. Character shadow & fly container
  const shadowLayer = new Container();
  const shadow = new Graphics();
  shadow.ellipse(0, 0, 28, 9).fill({ color: 0x1e1410, alpha: 0.32 });
  shadowLayer.addChild(shadow);

  const flyLayer = new Container();

  // 7. Floating dust motes / night fireflies
  const particlesLayer = new Container();
  const motes: DustMote[] = [];
  for (let i = 0; i < 24; i++) {
    const g = new Graphics().circle(0, 0, 1.6 + (i % 3) * 0.85).fill({ color: 0xffffff });
    const baseX = 75 + ((i * 91) % (SCENE_WIDTH - 150));
    const baseY = 55 + ((i * 67) % 380);
    g.x = baseX;
    g.y = baseY;
    particlesLayer.addChild(g);
    motes.push({
      graphic: g,
      baseX,
      baseY,
      speedY: 0.12 + (i % 5) * 0.05,
      driftAmp: 9 + (i % 4) * 4,
      phase: i * 0.8,
    });
  }

  // 8. Ambient time-of-day color overlay
  const lightingOverlay = new Graphics();

  root.addChild(
    outdoorLayer,
    windowLayer,
    raysLayer,
    sillLayer,
    propsLayer,
    shadowLayer,
    flyLayer,
    particlesLayer,
    lightingOverlay
  );

  const setTimeOfDay = (time: TimeOfDay) => {
    const t = THEMES[time];

    // Sky two-tone gradient feel
    skyGraphics.clear();
    skyGraphics
      .rect(60, 25, 680, 390)
      .fill({ color: t.skyTop })
      .rect(60, 220, 680, 195)
      .fill({ color: t.skyBottom, alpha: 0.65 });

    // Clouds
    cloudsGraphics.clear();
    drawCartoonCloud(cloudsGraphics, 200, 125, 1, t.cloudAlpha);
    drawCartoonCloud(cloudsGraphics, 520, 95, 0.85, t.cloudAlpha);
    drawCartoonCloud(cloudsGraphics, 355, 165, 0.72, t.cloudAlpha * 0.85);

    // Stars & crescent moon at night
    starsAndMoon.clear();
    if (t.showStars) {
      const starCoords = [
        [135, 78],
        [240, 62],
        [310, 115],
        [445, 70],
        [565, 130],
        [640, 75],
        [175, 195],
        [490, 205],
      ];
      for (const [sx, sy] of starCoords) {
        starsAndMoon.circle(sx, sy, 2.2).fill({ color: 0xfef9c3, alpha: 0.9 });
      }
      // Glowing moon
      starsAndMoon.circle(615, 108, 28).fill({ color: 0xfef08a, alpha: 0.92 });
      starsAndMoon.circle(626, 101, 24).fill({ color: t.skyTop });
    }

    // Cozy cartoon neighborhood street outside the window
    streetGraphics.clear();
    const isEvening = time === 'sunset' || time === 'night';
    const isNight = time === 'night';
    const houseWinColor = isNight ? 0xfde047 : isEvening ? 0xfef08a : 0xbae6fd;

    // Distant rolling park hills
    streetGraphics
      .ellipse(220, 352, 240, 62)
      .ellipse(580, 355, 250, 66)
      .fill({ color: t.treeColor, alpha: 0.72 });

    // Sidewalk & cobblestone road
    streetGraphics
      .rect(65, 345, 670, 22)
      .fill({ color: isNight ? 0x334155 : 0xcbd5e1 })
      .rect(65, 367, 670, 48)
      .fill({ color: isNight ? 0x1e293b : 0x64748b })
      .moveTo(65, 367)
      .lineTo(735, 367)
      .stroke({ width: 2, color: OUTLINE, alpha: 0.45 });

    // Subtle cobblestone dashes
    for (let rx = 90; rx < 710; rx += 38) {
      streetGraphics
        .roundRect(rx, 378, 18, 6, 3)
        .roundRect(rx + 16, 392, 16, 6, 3)
        .fill({ color: isNight ? 0x334155 : 0x94a3b8, alpha: 0.5 });
    }

    // Cozy cartoon townhouses across the street
    drawStreetHouse(streetGraphics, 108, 345, 86, 98, 0xfef3c7, 0xdc2626, houseWinColor, isNight);
    drawStreetHouse(streetGraphics, 206, 345, 92, 118, 0xfecdd3, 0xc2410c, houseWinColor, isNight);
    drawStreetHouse(streetGraphics, 476, 345, 96, 112, 0xd1fae5, 0x0f766e, houseWinColor, isNight);
    drawStreetHouse(streetGraphics, 588, 345, 88, 94, 0xfde68a, 0xb45309, houseWinColor, isNight);

    // Street trees & bushes
    drawStreetTree(streetGraphics, 318, 345, 1.0, t.treeColor);
    drawStreetTree(streetGraphics, 450, 345, 0.85, t.treeColor);
    drawStreetTree(streetGraphics, 696, 345, 0.92, t.treeColor);

    // Vintage streetlamp with warm evening glow
    streetGraphics
      .roundRect(351, 258, 5, 88, 2)
      .fill({ color: 0x1e293b })
      .roundRect(344, 244, 19, 16, 4)
      .fill({ color: isEvening ? 0xfef08a : 0xe2e8f0 })
      .stroke({ width: 1.6, color: OUTLINE })
      .poly([341, 244, 353.5, 234, 366, 244])
      .fill({ color: 0x1e293b });

    if (isEvening) {
      streetGraphics
        .circle(353.5, 252, 28)
        .fill({ color: 0xfde047, alpha: isNight ? 0.28 : 0.16 });
    }

    // Room wall around window + unified seamless cartoon window frame
    wallAndFrame.clear();
    // Outer wall strips
    wallAndFrame
      .rect(0, 0, SCENE_WIDTH, 32)
      .rect(0, 0, 76, 418)
      .rect(724, 0, 76, 418)
      .fill({ color: t.wallColor });

    // Outer recessed window casing (decorative trim)
    wallAndFrame
      .roundRect(54, 12, 692, 406, 14)
      .fill({ color: t.frameColor, alpha: 0.92 })
      .stroke({ width: 2.5, color: OUTLINE });

    // Inner sash depth shadow around glass opening
    wallAndFrame
      .roundRect(68, 24, 664, 388, 8)
      .stroke({ width: 4, color: OUTLINE, alpha: 0.22 });

    // Seamless cross muntins (filled WITHOUT internal intersecting black borders)
    wallAndFrame
      .rect(391, 24, 18, 388)
      .rect(70, 206, 660, 14)
      .fill({ color: t.frameColor });

    // Outer frame border & clean recessed bevel outlines on each of the 4 glass panes
    wallAndFrame
      .roundRect(68, 24, 664, 388, 8)
      .stroke({ width: 16, color: t.frameColor })
      .roundRect(60, 16, 680, 402, 11)
      .stroke({ width: 2.5, color: OUTLINE });

    const panes: Array<[number, number, number, number]> = [
      [76, 32, 315, 174],
      [409, 32, 315, 174],
      [76, 220, 315, 186],
      [409, 220, 315, 186],
    ];
    for (const [px, py, pw, ph] of panes) {
      wallAndFrame
        .roundRect(px, py, pw, ph, 4)
        .stroke({ width: 2, color: OUTLINE, alpha: 0.85 });
      // Subtle top-left inner sash bevel highlight
      wallAndFrame
        .moveTo(px + 4, py + ph - 3)
        .lineTo(px + 4, py + 3)
        .lineTo(px + pw - 3, py + 3)
        .stroke({ width: 1.5, color: 0xffffff, alpha: 0.45 });
    }

    // Small cartoon window latch on the vertical center bar
    wallAndFrame
      .roundRect(395, 226, 10, 22, 4)
      .fill({ color: 0xd97706 })
      .stroke({ width: 1.6, color: OUTLINE })
      .circle(400, 242, 3.5)
      .fill({ color: 0xfbbf24 })
      .stroke({ width: 1.4, color: OUTLINE });

    // Cozy windowsill (top plane y: 412..512, front apron y: 512..600)
    sillGraphics.clear();
    sillGraphics
      .rect(0, 412, SCENE_WIDTH, 100)
      .fill({ color: t.sillTopColor })
      .rect(0, 512, SCENE_WIDTH, 88)
      .fill({ color: t.sillFrontColor })
      // Bevel & wood grain lines
      .moveTo(0, 412)
      .lineTo(SCENE_WIDTH, 412)
      .moveTo(0, 512)
      .lineTo(SCENE_WIDTH, 512)
      .stroke({ width: 3, color: OUTLINE })
      .moveTo(40, 456)
      .quadraticCurveTo(180, 452, 310, 458)
      .moveTo(430, 478)
      .quadraticCurveTo(590, 474, 740, 480)
      .moveTo(90, 552)
      .quadraticCurveTo(320, 548, 520, 556)
      .stroke({ width: 2, color: OUTLINE, alpha: 0.14 });

    // Soft shadow cast by window frame onto sill
    sillGraphics
      .rect(0, 414, SCENE_WIDTH, 16)
      .fill({ color: 0x0f172a, alpha: 0.08 });

    // Volumetric light beams
    raysGraphics.clear();
    raysGraphics
      .poly([88, 34, 386, 34, 595, 512, 160, 512])
      .fill({ color: t.rayColor, alpha: t.rayAlpha })
      .poly([416, 34, 712, 34, 785, 420, 535, 512])
      .fill({ color: t.rayColor, alpha: t.rayAlpha * 0.72 });

    // Ambient overlay
    lightingOverlay.clear();
    lightingOverlay
      .rect(0, 0, SCENE_WIDTH, SCENE_HEIGHT)
      .fill({ color: t.tintColor, alpha: t.tintAlpha });

    for (const mote of motes) {
      mote.graphic.tint = t.moteColor;
      mote.graphic.alpha = t.moteAlpha;
    }
  };

  let elapsed = 0;
  const update = (deltaTime: number, timeOfDay: TimeOfDay) => {
    elapsed += deltaTime * 0.03;
    const t = THEMES[timeOfDay];

    // Gentle flower sway & glistening dew highlight
    flowerHead.rotation = Math.sin(elapsed * 0.9) * 0.04;
    dewHighlight.alpha = 0.68 + Math.sin(elapsed * 2.4) * 0.25;
    dewDrop.scale.set(1 + Math.sin(elapsed * 1.6) * 0.03);

    for (const mote of motes) {
      mote.baseY -= mote.speedY * deltaTime;
      if (mote.baseY < 38) {
        mote.baseY = 430;
      }
      mote.graphic.x = mote.baseX + Math.sin(elapsed + mote.phase) * mote.driftAmp;
      mote.graphic.y = mote.baseY;
      const pulse = 0.55 + Math.sin(elapsed * 1.7 + mote.phase) * 0.35;
      mote.graphic.alpha = t.moteAlpha * pulse;
    }

    // Occasional cartoon cars driving down the street
    const lightsOn = timeOfDay === 'sunset' || timeOfDay === 'night';
    for (const car of cars) {
      car.headlights.visible = lightsOn;
      if (!car.active) {
        car.cooldown -= deltaTime;
        if (car.cooldown <= 0) {
          car.active = true;
          car.container.visible = true;
          car.container.x = car.dir === 1 ? 30 : 770;
        }
        continue;
      }

      car.container.x += car.dir * car.speed * deltaTime;
      // Gentle suspension bounce
      car.container.y = (car.dir === 1 ? 376 : 395) + Math.sin(elapsed * 7 + car.container.x * 0.08) * 0.7;

      const exited = car.dir === 1 ? car.container.x > 780 : car.container.x < 20;
      if (exited) {
        car.active = false;
        car.container.visible = false;
        car.cooldown = 160 + Math.random() * 240;
      }
    }
  };

  setTimeOfDay('day');

  return {
    root,
    flyLayer,
    shadow,
    setTimeOfDay,
    update,
  };
}

function drawCartoonCloud(g: Graphics, x: number, y: number, scale: number, alpha: number): void {
  g.circle(x, y, 26 * scale)
    .circle(x - 24 * scale, y + 6 * scale, 19 * scale)
    .circle(x + 25 * scale, y + 7 * scale, 20 * scale)
    .fill({ color: 0xffffff, alpha });
}

function drawStreetHouse(
  g: Graphics,
  x: number,
  groundY: number,
  w: number,
  h: number,
  wallColor: number,
  roofColor: number,
  winColor: number,
  isNight: boolean
): void {
  const topY = groundY - h;
  const shadeWall = isNight ? 0x334155 : wallColor;
  const shadeRoof = isNight ? 0x1e293b : roofColor;
  const shutterColor = isNight ? 0x1e293b : roofColor;

  // Chimney with brick rim
  g.rect(x + w * 0.7, topY - 24, 12, 24)
    .fill({ color: shadeRoof })
    .stroke({ width: 1.5, color: OUTLINE, alpha: 0.75 })
    .roundRect(x + w * 0.7 - 2, topY - 26, 16, 4, 2)
    .fill({ color: shadeRoof })
    .stroke({ width: 1.3, color: OUTLINE, alpha: 0.75 });

  // House body + subtle side shadow strip + stone base plinth
  g.rect(x, topY, w, h)
    .fill({ color: shadeWall })
    .rect(x + w - 12, topY, 12, h)
    .fill({ color: 0x0f172a, alpha: 0.08 })
    .rect(x, groundY - 9, w, 9)
    .fill({ color: isNight ? 0x1e293b : 0x94a3b8, alpha: 0.75 })
    .rect(x, topY, w, h)
    .stroke({ width: 1.6, color: OUTLINE, alpha: 0.78 });

  // Pitched roof with eaves & shingle stripe
  const peakX = x + w / 2;
  const peakY = topY - 32;
  g.poly([x - 8, topY + 3, peakX, peakY, x + w + 8, topY + 3])
    .fill({ color: shadeRoof })
    .stroke({ width: 1.8, color: OUTLINE, alpha: 0.85 });
  // Roof ridge highlight
  g.moveTo(x - 3, topY - 1)
    .lineTo(peakX, peakY + 5)
    .lineTo(x + w + 3, topY - 1)
    .stroke({ width: 1.8, color: 0xffffff, alpha: 0.22 });

  // Round attic dormer window inside gable
  g.circle(peakX, topY - 11, 7)
    .fill({ color: winColor })
    .stroke({ width: 1.4, color: OUTLINE, alpha: 0.8 });

  // Cozy windows with shutters & tiny flower boxes
  const winW = 18;
  const winH = 22;
  const leftWinX = x + w * 0.17;
  const rightWinX = x + w * 0.62;
  const upperY = topY + 18;
  const lowerY = topY + 52;

  const winPositions: Array<[number, number]> = [
    [leftWinX, upperY],
    [rightWinX, upperY],
    [leftWinX, lowerY],
  ];
  for (const [wx, wy] of winPositions) {
    // Shutters
    g.rect(wx - 4, wy + 1, 4, winH - 2)
      .rect(wx + winW, wy + 1, 4, winH - 2)
      .fill({ color: shutterColor, alpha: 0.85 })
      .stroke({ width: 1, color: OUTLINE, alpha: 0.65 });

    // Glowing glass pane + cross
    g.roundRect(wx, wy, winW, winH, 3)
      .fill({ color: winColor })
      .stroke({ width: 1.4, color: OUTLINE, alpha: 0.8 });
    g.moveTo(wx + winW / 2, wy)
      .lineTo(wx + winW / 2, wy + winH)
      .moveTo(wx, wy + winH / 2)
      .lineTo(wx + winW, wy + winH / 2)
      .stroke({ width: 1, color: OUTLINE, alpha: 0.45 });

    // Flower box under window
    g.roundRect(wx - 2, wy + winH - 1, winW + 4, 5, 2)
      .fill({ color: 0x92400e })
      .stroke({ width: 1, color: OUTLINE, alpha: 0.7 });
    g.circle(wx + 3, wy + winH - 2, 2.2)
      .circle(wx + 9, wy + winH - 2.5, 2.2)
      .circle(wx + 15, wy + winH - 2, 2.2)
      .fill({ color: 0xf43f5e });
  }

  // Front door with striped canopy awning & doorstep
  const doorX = rightWinX - 1;
  g.roundRect(doorX, groundY - 35, 20, 35, 4)
    .fill({ color: 0x78350f })
    .stroke({ width: 1.5, color: OUTLINE, alpha: 0.85 });
  // Door knob & small awning
  g.circle(doorX + 15, groundY - 17, 1.8).fill({ color: 0xfbbf24 });
  g.poly([doorX - 4, groundY - 34, doorX + 24, groundY - 34, doorX + 21, groundY - 41, doorX - 1, groundY - 41])
    .fill({ color: shadeRoof })
    .stroke({ width: 1.3, color: OUTLINE, alpha: 0.8 });
}

function createCartoonCar(
  bodyColor: number,
  dir: 1 | -1
): { container: Container; headlights: Graphics } {
  const container = new Container();
  container.scale.x = dir;

  // Warm headlight beam cone (visible at sunset / night)
  const headlights = new Graphics();
  headlights
    .poly([22, -6, 68, -16, 68, 6, 22, -1])
    .fill({ color: 0xfef08a, alpha: 0.34 });
  headlights.visible = false;

  const car = new Graphics();
  // Soft shadow under car
  car.ellipse(0, 3, 24, 5).fill({ color: 0x0f172a, alpha: 0.35 });

  // Rounded retro cartoon body
  car
    .roundRect(-22, -11, 44, 14, 6)
    .fill({ color: bodyColor })
    .stroke({ width: 1.6, color: OUTLINE });

  // Cabin roof
  car
    .moveTo(-13, -10)
    .bezierCurveTo(-10, -22, 10, -22, 14, -10)
    .closePath()
    .fill({ color: bodyColor })
    .stroke({ width: 1.6, color: OUTLINE });

  // Cabin windows
  car
    .poly([-10, -11, -7, -18, -1, -18, -1, -11])
    .poly([1, -11, 1, -18, 7, -18, 11, -11])
    .fill({ color: 0xe0f2fe })
    .stroke({ width: 1.1, color: OUTLINE, alpha: 0.75 });

  // Headlight & taillight
  car.circle(21, -5, 2.5).fill({ color: 0xfef08a });
  car.circle(-21, -5, 2.2).fill({ color: 0xf43f5e });

  // Wheels with hubcaps
  for (const wx of [-12, 12]) {
    car.circle(wx, 2, 5.2).fill({ color: 0x1e293b }).stroke({ width: 1.3, color: OUTLINE });
    car.circle(wx, 2, 2.2).fill({ color: 0xe2e8f0 });
  }

  container.addChild(headlights, car);
  return { container, headlights };
}

function drawStreetTree(
  g: Graphics,
  x: number,
  groundY: number,
  scale: number,
  leafColor: number
): void {
  g.rect(x - 4 * scale, groundY - 36 * scale, 8 * scale, 36 * scale)
    .fill({ color: 0x78350f });
  g.circle(x, groundY - 54 * scale, 24 * scale)
    .circle(x - 16 * scale, groundY - 40 * scale, 18 * scale)
    .circle(x + 16 * scale, groundY - 40 * scale, 18 * scale)
    .fill({ color: leafColor })
    .stroke({ width: 1.5, color: OUTLINE, alpha: 0.55 });
}

function buildBerryBasket(onBerryClick: (x: number, y: number) => void): Container {
  const basket = new Container();
  basket.eventMode = 'static';
  basket.cursor = 'pointer';

  // Contact shadow on windowsill
  const contactShadow = new Graphics();
  contactShadow.ellipse(0, 34, 62, 14).fill({ color: 0x1e1410, alpha: 0.28 });

  // Plump individual raspberries heaped neatly in 3 layered rows
  const berriesLayer = new Container();

  // Back row (darker shade for depth)
  const backRow: Array<[number, number, number]> = [
    [-34, -14, -0.25],
    [-16, -22, -0.1],
    [4, -24, 0.1],
    [24, -20, 0.22],
    [36, -13, 0.3],
  ];
  for (const [bx, by, rot] of backRow) {
    berriesLayer.addChild(createSingleRaspberry(bx, by, rot, 0.92, true));
  }

  // Middle row
  const midRow: Array<[number, number, number]> = [
    [-26, -11, -0.18],
    [-8, -15, 0.05],
    [12, -14, -0.08],
    [28, -10, 0.2],
  ];
  for (const [bx, by, rot] of midRow) {
    berriesLayer.addChild(createSingleRaspberry(bx, by, rot, 1.0, false));
  }

  // Top hero berries
  const topRow: Array<[number, number, number]> = [
    [-11, -27, -0.15],
    [9, -28, 0.16],
    [0, -18, 0.0],
  ];
  for (const [bx, by, rot] of topRow) {
    berriesLayer.addChild(createSingleRaspberry(bx, by, rot, 1.02, false));
  }

  // Small crisp garnish leaves tucked at the rim
  const garnish = new Graphics();
  garnish
    .moveTo(-48, -10)
    .quadraticCurveTo(-36, -26, -20, -14)
    .quadraticCurveTo(-35, -6, -48, -10)
    .fill({ color: 0x22c55e })
    .stroke({ width: 1.8, color: OUTLINE });
  garnish
    .moveTo(48, -10)
    .quadraticCurveTo(36, -26, 20, -14)
    .quadraticCurveTo(35, -6, 48, -10)
    .fill({ color: 0x16a34a })
    .stroke({ width: 1.8, color: OUTLINE });

  // Woven wicker basket body in front of berries
  const body = new Graphics();
  body
    .moveTo(-54, -8)
    .lineTo(-42, 30)
    .quadraticCurveTo(0, 42, 42, 30)
    .lineTo(54, -8)
    .closePath()
    .fill({ color: 0xd97706 })
    .stroke({ width: 2.4, color: OUTLINE });

  // Wicker weave lines
  for (let x = -34; x <= 34; x += 17) {
    body.moveTo(x - 4, -4).lineTo(x, 31);
  }
  body
    .moveTo(-49, 6)
    .quadraticCurveTo(0, 14, 49, 6)
    .moveTo(-45, 20)
    .quadraticCurveTo(0, 28, 45, 20)
    .stroke({ width: 1.8, color: 0x92400e, alpha: 0.7 });

  // Braided basket rim
  const rim = new Graphics();
  rim
    .roundRect(-58, -14, 116, 13, 6.5)
    .fill({ color: 0xf59e0b })
    .stroke({ width: 2.4, color: OUTLINE });

  basket.addChild(contactShadow, berriesLayer, garnish, body, rim);
  basket.on('pointerdown', (e) => {
    e.stopPropagation();
    onBerryClick(SILL_INTERACTABLES.berryBasket.x, SILL_INTERACTABLES.berryBasket.y);
  });

  return basket;
}

function createSingleRaspberry(
  x: number,
  y: number,
  rotation: number,
  scale: number,
  shaded: boolean
): Container {
  const berry = new Container();
  berry.position.set(x, y);
  berry.rotation = rotation;
  berry.scale.set(scale);

  const baseColor = shaded ? 0xbe123c : 0xe11d48;
  const drupeColor = shaded ? 0xe11d48 : 0xf43f5e;
  const hiColor = shaded ? 0xfb7185 : 0xfecdd3;

  const g = new Graphics();
  // Clean whole berry outline silhouette (rounded cone)
  g.moveTo(0, -11)
    .bezierCurveTo(10, -11, 11, 2, 7, 9)
    .quadraticCurveTo(0, 14, -7, 9)
    .bezierCurveTo(-11, 2, -10, -11, 0, -11)
    .fill({ color: baseColor })
    .stroke({ width: 1.9, color: 0x4c0519 });

  // Distinct plump drupelet bumps arranged inside the berry silhouette
  const bumps: Array<[number, number, number]> = [
    [-4.2, -5.8, 3.1],
    [0, -6.5, 3.2],
    [4.2, -5.8, 3.1],
    [-5.5, -0.5, 3.2],
    [0, -1.0, 3.4],
    [5.5, -0.5, 3.2],
    [-3.8, 5.0, 3.0],
    [3.8, 5.0, 3.0],
    [0, 7.6, 2.7],
  ];
  for (const [dx, dy, r] of bumps) {
    g.circle(dx, dy, r)
      .fill({ color: drupeColor })
      .stroke({ width: 0.9, color: 0x881337, alpha: 0.65 });
    g.circle(dx - r * 0.28, dy - r * 0.3, r * 0.34).fill({ color: hiColor, alpha: 0.85 });
  }

  // Tiny green crown cap on top of berry
  g.poly([-5, -10, 0, -14, 5, -10, 0, -8])
    .fill({ color: 0x22c55e })
    .stroke({ width: 1.1, color: OUTLINE });

  berry.addChild(g);
  return berry;
}

function buildFlowerPotWithDew(onDewClick: (x: number, y: number) => void): {
  potGroup: Container;
  dewDrop: Container;
  dewHighlight: Graphics;
  flowerHead: Container;
} {
  const potGroup = new Container();

  // Contact shadow on windowsill
  const contactShadow = new Graphics();
  contactShadow.ellipse(0, 32, 60, 14).fill({ color: 0x1e1410, alpha: 0.3 });

  // Smooth curved stem & clean botanical cartoon leaves
  const foliage = new Graphics();
  foliage
    .moveTo(0, -68)
    .bezierCurveTo(-4, -120, -14, -172, -6, -220)
    .stroke({ width: 8.5, color: OUTLINE, cap: 'round' })
    .moveTo(0, -68)
    .bezierCurveTo(-4, -120, -14, -172, -6, -220)
    .stroke({ width: 5.5, color: 0x16a34a, cap: 'round' })
    .moveTo(-1, -72)
    .bezierCurveTo(-5, -120, -15, -170, -7, -216)
    .stroke({ width: 2, color: 0x4ade80, alpha: 0.65, cap: 'round' });

  // Broad left leaf (supports the interactive dew drop!)
  foliage
    .moveTo(-7, -110)
    .bezierCurveTo(-44, -152, -112, -146, -138, -104)
    .bezierCurveTo(-102, -74, -40, -80, -7, -110)
    .fill({ color: 0x22c55e })
    .stroke({ width: 2.4, color: OUTLINE });
  // Smooth central & lateral veins on left leaf
  foliage
    .moveTo(-12, -110)
    .quadraticCurveTo(-68, -120, -128, -105)
    .moveTo(-54, -115)
    .lineTo(-74, -130)
    .moveTo(-88, -113)
    .lineTo(-106, -123)
    .moveTo(-66, -114)
    .lineTo(-82, -96)
    .stroke({ width: 2, color: 0x86efac, alpha: 0.72, cap: 'round' });

  // Right leaf
  foliage
    .moveTo(-5, -130)
    .bezierCurveTo(32, -168, 86, -158, 102, -118)
    .bezierCurveTo(72, -94, 24, -100, -5, -130)
    .fill({ color: 0x16a34a })
    .stroke({ width: 2.4, color: OUTLINE });
  foliage
    .moveTo(0, -130)
    .quadraticCurveTo(48, -138, 94, -120)
    .moveTo(36, -133)
    .lineTo(52, -146)
    .moveTo(62, -130)
    .lineTo(76, -138)
    .moveTo(46, -132)
    .lineTo(60, -114)
    .stroke({ width: 1.9, color: 0x86efac, alpha: 0.62, cap: 'round' });

  // Small lower accent leaf
  foliage
    .moveTo(-2, -82)
    .bezierCurveTo(30, -98, 60, -82, 58, -60)
    .bezierCurveTo(34, -52, 12, -62, -2, -82)
    .fill({ color: 0x22c55e })
    .stroke({ width: 2.2, color: OUTLINE });

  // Interactive glistening dew drop on the left leaf
  // potGroup is at (635, 445); dew global is (525, 326) -> local (-110, -119)
  const dewDrop = new Container();
  dewDrop.x = SILL_INTERACTABLES.dewDrop.x - 635;
  dewDrop.y = SILL_INTERACTABLES.dewDrop.y - 445;
  dewDrop.eventMode = 'static';
  dewDrop.cursor = 'pointer';

  const dropBody = new Graphics();
  dropBody
    .ellipse(0, 0, 13, 11)
    .fill({ color: 0x38bdf8, alpha: 0.78 })
    .stroke({ width: 2, color: 0xe0f2fe });

  const dewHighlight = new Graphics();
  dewHighlight.circle(-4, -4, 4).fill({ color: 0xffffff, alpha: 0.9 });
  dewHighlight.circle(4, 3, 1.8).fill({ color: 0xe0f2fe, alpha: 0.8 });

  dewDrop.addChild(dropBody, dewHighlight);
  dewDrop.on('pointerdown', (e) => {
    e.stopPropagation();
    onDewClick(SILL_INTERACTABLES.dewDrop.x, SILL_INTERACTABLES.dewDrop.y);
  });

  // Multi-layered symmetric cartoon blossom
  const flowerHead = new Container();
  flowerHead.position.set(-6, -224);

  // Calyx sepals behind petals
  const calyx = new Graphics();
  calyx
    .poly([-14, 10, 0, 26, 14, 10])
    .fill({ color: 0x15803d })
    .stroke({ width: 2, color: OUTLINE });
  flowerHead.addChild(calyx);

  // Outer layer: 8 sculpted teardrop petals
  const outerCount = 8;
  for (let i = 0; i < outerCount; i++) {
    const petal = new Graphics();
    petal
      .moveTo(0, 0)
      .bezierCurveTo(-18, -14, -22, -46, 0, -52)
      .bezierCurveTo(22, -46, 18, -14, 0, 0)
      .fill({ color: 0xf43f5e })
      .stroke({ width: 2.2, color: OUTLINE });
    // Soft inner petal highlight
    petal
      .moveTo(0, -8)
      .bezierCurveTo(-9, -18, -10, -38, 0, -43)
      .bezierCurveTo(10, -38, 9, -18, 0, -8)
      .fill({ color: 0xfb7185, alpha: 0.85 });
    petal.rotation = (i / outerCount) * Math.PI * 2;
    flowerHead.addChild(petal);
  }

  // Inner layer: 8 smaller pastel petals offset by half step
  for (let i = 0; i < outerCount; i++) {
    const innerPetal = new Graphics();
    innerPetal
      .moveTo(0, 0)
      .bezierCurveTo(-12, -10, -14, -32, 0, -36)
      .bezierCurveTo(14, -32, 12, -10, 0, 0)
      .fill({ color: 0xfda4af })
      .stroke({ width: 1.8, color: OUTLINE });
    innerPetal.rotation = ((i + 0.5) / outerCount) * Math.PI * 2;
    flowerHead.addChild(innerPetal);
  }

  // Detailed golden pollen center
  const flowerCenter = new Graphics();
  flowerCenter
    .circle(0, 0, 17.5)
    .fill({ color: 0xf59e0b })
    .stroke({ width: 2.2, color: OUTLINE })
    .circle(0, 0, 13.5)
    .fill({ color: 0xfacc15 });
  // Cute pollen dots & specular
  const dots: Array<[number, number]> = [
    [-6, -5],
    [5, -6],
    [-7, 4],
    [6, 5],
    [0, 7],
    [1, -2],
  ];
  for (const [dx, dy] of dots) {
    flowerCenter.circle(dx, dy, 1.5).fill({ color: 0xd97706, alpha: 0.75 });
  }
  flowerCenter.circle(-5, -5, 4).fill({ color: 0xfef9c3, alpha: 0.85 });

  flowerHead.addChild(flowerCenter);

  // Terracotta flower pot
  const pot = new Graphics();
  pot
    .ellipse(0, -68, 46, 11)
    .fill({ color: 0x451a03 })
    .stroke({ width: 2, color: OUTLINE });

  pot
    .moveTo(-46, -60)
    .lineTo(-34, 28)
    .quadraticCurveTo(0, 38, 34, 28)
    .lineTo(46, -60)
    .closePath()
    .fill({ color: 0xea580c })
    .stroke({ width: 2.4, color: OUTLINE });

  pot
    .poly([-38, -56, -24, -56, -18, 26, -28, 24])
    .fill({ color: 0xfb923c, alpha: 0.55 });

  pot
    .roundRect(-54, -74, 108, 17, 7)
    .fill({ color: 0xf97316 })
    .stroke({ width: 2.4, color: OUTLINE });

  potGroup.addChild(contactShadow, foliage, dewDrop, flowerHead, pot);
  return { potGroup, dewDrop, dewHighlight, flowerHead };
}
