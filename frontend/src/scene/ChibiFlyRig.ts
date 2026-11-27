import { Container, Graphics, Text } from 'pixi.js';
import type { BrainClusters, FlyBehaviorState, Neuromodulators } from '../types/brain';

export interface ChibiFlyUpdateInput {
  deltaTime: number;
  state: FlyBehaviorState;
  clusters: BrainClusters;
  neuromodulators: Neuromodulators;
  lookAngle: number;
  cursorOffset: { dx: number; dy: number } | null;
  xrayEnabled: boolean;
}

interface XRayNode {
  key: keyof BrainClusters;
  x: number;
  y: number;
  color: number;
  glow: Graphics;
  core: Graphics;
}

const CLUSTER_NODES_SPEC: Array<{
  key: keyof BrainClusters;
  x: number;
  y: number;
  color: number;
}> = [
  { key: 'vision', x: -18, y: -3, color: 0x38bdf8 },
  { key: 'olfactory', x: 18, y: -3, color: 0xa3e635 },
  { key: 'mushroomBody', x: 0, y: -16, color: 0xe879f9 },
  { key: 'motor', x: 0, y: 12, color: 0x34d399 },
  { key: 'hunger', x: 0, y: -1, color: 0xfbbf24 },
];

const CLUSTER_LINKS: Array<[number, number]> = [
  [0, 2],
  [1, 2],
  [2, 4],
  [4, 3],
  [0, 3],
  [1, 3],
];

const FUR_DARK = 0x3d3031;
const FUR_MID = 0x4e3e3f;
const FUR_OUTLINE = 0x23191a;
const FUR_WARM_RIM = 0x8c6d63;

function drawStarSparkle(g: Graphics, cx: number, cy: number, r: number, color: number): void {
  const inner = r * 0.3;
  g.poly([
    cx,
    cy - r,
    cx + inner,
    cy - inner,
    cx + r,
    cy,
    cx + inner,
    cy + inner,
    cx,
    cy + r,
    cx - inner,
    cy + inner,
    cx - r,
    cy,
    cx - inner,
    cy - inner,
  ]).fill({ color });
}

export class ChibiFlyRig {
  readonly root = new Container();

  private readonly bodyGroup = new Container();
  private readonly wingsGroup = new Container();
  private readonly leftWing = new Graphics();
  private readonly rightWing = new Graphics();
  private readonly bodySprite = new Graphics();
  private readonly legsBottom = new Graphics();
  private readonly pawFrontLeft = new Graphics();
  private readonly pawFrontRight = new Graphics();

  private readonly headGroup = new Container();
  private readonly antennae = new Graphics();
  private readonly headShell = new Graphics();
  private readonly blush = new Graphics();
  private readonly smileAndProboscis = new Graphics();

  private readonly eyesNormalGroup = new Container();
  private readonly leftIrisGroup = new Container();
  private readonly rightIrisGroup = new Container();
  private readonly eyeLashes = new Graphics();
  private readonly eyelids = new Graphics();

  private readonly eyesHappy = new Graphics();
  private readonly eyesSleep = new Graphics();
  private readonly eyesSpiral = new Graphics();
  private readonly eyesHearts = new Graphics();

  private readonly xrayGroup = new Container();
  private readonly xrayLinks = new Graphics();
  private readonly xrayNodes: XRayNode[] = [];

  private readonly fxGroup = new Container();
  private readonly sleepText: Text;
  private readonly zapBolts = new Graphics();

  private elapsed = 0;
  private wingPhase = 0;
  private blinkTimer = 140;
  private blinkProgress = 0;
  private pupilOffsetX = 0;
  private pupilOffsetY = 0;

  constructor() {
    this.buildWings();
    this.buildBodyAndPaws();
    this.buildHeadAndEyes();
    this.buildXRayOverlay();

    this.sleepText = new Text({
      text: 'Zzz',
      style: {
        fontFamily: 'sans-serif',
        fontSize: 15,
        fontWeight: 'bold',
        fill: '#e2e8f0',
      },
    });
    this.sleepText.x = 28;
    this.sleepText.y = -52;
    this.sleepText.visible = false;

    this.zapBolts.visible = false;
    this.fxGroup.addChild(this.sleepText, this.zapBolts);

    this.root.addChild(this.wingsGroup, this.bodyGroup, this.headGroup, this.fxGroup);
  }

  private buildWings(): void {
    // Low-set iridescent translucent wings behind the plump body
    this.drawRainbowWing(this.leftWing, -1);
    this.leftWing.position.set(-16, 22);
    this.leftWing.pivot.set(0, 0);

    this.drawRainbowWing(this.rightWing, 1);
    this.rightWing.position.set(16, 22);
    this.rightWing.pivot.set(0, 0);

    this.wingsGroup.addChild(this.leftWing, this.rightWing);
  }

  private drawRainbowWing(g: Graphics, dir: -1 | 1): void {
    g.moveTo(0, -4)
      .bezierCurveTo(dir * 18, -14, dir * 32, -2, dir * 28, 12)
      .bezierCurveTo(dir * 22, 20, dir * 6, 16, 0, 6)
      .closePath()
      .fill({ color: 0xe0f2fe, alpha: 0.55 })
      .stroke({ width: 1.5, color: 0x94a3b8, alpha: 0.85 });

    // Soft pastel rainbow bands inside wing
    g.moveTo(dir * 3, -1)
      .lineTo(dir * 22, -3)
      .stroke({ width: 4, color: 0xf9a8d4, alpha: 0.3 });
    g.moveTo(dir * 4, 3)
      .lineTo(dir * 24, 4)
      .stroke({ width: 4, color: 0xfef08a, alpha: 0.28 });
    g.moveTo(dir * 4, 7)
      .lineTo(dir * 22, 11)
      .stroke({ width: 4, color: 0x67e8f9, alpha: 0.3 });
  }

  private buildBodyAndPaws(): void {
    // Small plump fuzzy charcoal-brown body sitting below the large head
    this.bodySprite
      .ellipse(0, 26, 22, 18)
      .fill({ color: FUR_DARK })
      .stroke({ width: 2, color: FUR_OUTLINE });

    // Fuzzy side tufts & chest ruff
    this.bodySprite
      .poly([-22, 22, -26, 25, -21, 28, -25, 32, -19, 34])
      .poly([22, 22, 26, 25, 21, 28, 25, 32, 19, 34])
      .poly([-8, 11, -4, 17, 0, 13, 4, 18, 9, 11])
      .fill({ color: FUR_MID });

    // Subtle soft belly highlight
    this.bodySprite.ellipse(0, 27, 13, 11).fill({ color: FUR_MID, alpha: 0.55 });

    // 4 bottom sitting paws (two outer splayed, two inner straight)
    this.legsBottom
      // Outer left splayed paw
      .moveTo(-16, 35)
      .quadraticCurveTo(-24, 42, -27, 36)
      .quadraticCurveTo(-29, 33, -24, 33)
      .quadraticCurveTo(-20, 35, -14, 32)
      .fill({ color: FUR_MID })
      .stroke({ width: 2, color: FUR_OUTLINE })
      // Outer right splayed paw
      .moveTo(16, 35)
      .quadraticCurveTo(24, 42, 27, 36)
      .quadraticCurveTo(29, 33, 24, 33)
      .quadraticCurveTo(20, 35, 14, 32)
      .fill({ color: FUR_MID })
      .stroke({ width: 2, color: FUR_OUTLINE })
      // Inner left sitting foot
      .roundRect(-12, 30, 7, 13, 3.5)
      .fill({ color: FUR_MID })
      .stroke({ width: 2, color: FUR_OUTLINE })
      // Inner right sitting foot
      .roundRect(5, 30, 7, 13, 3.5)
      .fill({ color: FUR_MID })
      .stroke({ width: 2, color: FUR_OUTLINE });

    // Two cute front paws tucked up under the chin
    this.pawFrontLeft
      .ellipse(0, 0, 5.2, 8.5)
      .fill({ color: FUR_MID })
      .stroke({ width: 2, color: FUR_OUTLINE });
    this.pawFrontLeft.position.set(-13, 14);
    this.pawFrontLeft.rotation = -0.35;

    this.pawFrontRight
      .ellipse(0, 0, 5.2, 8.5)
      .fill({ color: FUR_MID })
      .stroke({ width: 2, color: FUR_OUTLINE });
    this.pawFrontRight.position.set(13, 14);
    this.pawFrontRight.rotation = 0.35;

    this.bodyGroup.addChild(
      this.bodySprite,
      this.legsBottom,
      this.pawFrontLeft,
      this.pawFrontRight
    );
  }

  private buildHeadAndEyes(): void {
    // Huge Super Deformed chibi head centered above the small sitting body
    this.headGroup.position.set(0, -14);

    // Curved clubbed antennae on top
    this.antennae
      .moveTo(-7, -32)
      .quadraticCurveTo(-11, -46, -21, -47)
      .moveTo(7, -32)
      .quadraticCurveTo(11, -46, 21, -47)
      .stroke({ width: 2.5, color: FUR_OUTLINE, cap: 'round' });
    this.antennae
      .ellipse(-22, -47, 5.5, 2.8)
      .fill({ color: FUR_MID })
      .stroke({ width: 1.8, color: FUR_OUTLINE });
    this.antennae
      .ellipse(22, -47, 5.5, 2.8)
      .fill({ color: FUR_MID })
      .stroke({ width: 1.8, color: FUR_OUTLINE });

    // Big round fuzzy charcoal-brown head
    this.headShell
      .ellipse(0, 0, 41, 35)
      .fill({ color: FUR_DARK })
      .stroke({ width: 2.2, color: FUR_OUTLINE });

    // Warm rim-light crescent hugging top-left of head
    this.headShell
      .ellipse(-4, -2, 34, 29)
      .fill({ color: FUR_MID, alpha: 0.72 })
      .moveTo(-36, -11)
      .quadraticCurveTo(-26, -31, -4, -33)
      .stroke({ width: 2.6, color: FUR_WARM_RIM, alpha: 0.5, cap: 'round' });

    // Cute hair tufts on top and fuzzy cheeks
    this.headShell
      .poly([-4, -35, -1, -41, 2, -35, 6, -40, 7, -34])
      .poly([-40, 5, -44, 8, -39, 12, -43, 15, -37, 18])
      .poly([40, 5, 44, 8, 39, 12, 43, 15, 37, 18])
      .fill({ color: FUR_DARK });

    // Tiny cute oval eyebrows
    this.headShell
      .ellipse(-18, -22, 4, 1.8)
      .ellipse(18, -22, 4, 1.8)
      .fill({ color: FUR_OUTLINE });

    // Rosy cheek blush + 3 slanted anime blush lines
    this.blush
      .ellipse(-25, 16, 8, 5)
      .ellipse(25, 16, 8, 5)
      .fill({ color: 0xf43f5e, alpha: 0.34 });
    for (let i = -1; i <= 1; i++) {
      const lx = -25 + i * 4;
      const rx = 25 + i * 4;
      this.blush
        .moveTo(lx - 1.5, 18)
        .lineTo(lx + 1.5, 14)
        .moveTo(rx - 1.5, 18)
        .lineTo(rx + 1.5, 14);
    }
    this.blush.stroke({ width: 1.5, color: 0xfda4af, alpha: 0.85, cap: 'round' });

    // Cute smile + little resting proboscis in the center
    this.drawMouthAndProboscis(1);

    // Huge anime eyes covering half the face
    const eyeBg = new Graphics();
    eyeBg
      .circle(-18, 0, 14.5)
      .fill({ color: 0xfffbeb })
      .stroke({ width: 2, color: FUR_OUTLINE });
    eyeBg
      .circle(18, 0, 14.5)
      .fill({ color: 0xfffbeb })
      .stroke({ width: 2, color: FUR_OUTLINE });

    this.buildAnimeIris(this.leftIrisGroup, -18, 0);
    this.buildAnimeIris(this.rightIrisGroup, 18, 0);

    // Thick upper lash line & outer eyelashes (explicit moveTo prevents stray connector lines)
    this.eyeLashes
      .moveTo(-32, -2)
      .bezierCurveTo(-30, -18, -6, -18, -4, -2)
      .moveTo(4, -2)
      .bezierCurveTo(6, -18, 30, -18, 32, -2)
      .stroke({ width: 3.2, color: FUR_OUTLINE, cap: 'round' })
      .moveTo(-31, -5)
      .quadraticCurveTo(-36, -9, -37, -12)
      .moveTo(-29, -9)
      .quadraticCurveTo(-33, -13, -33, -16)
      .moveTo(31, -5)
      .quadraticCurveTo(36, -9, 37, -12)
      .moveTo(29, -9)
      .quadraticCurveTo(33, -13, 33, -16)
      .stroke({ width: 2, color: FUR_OUTLINE, cap: 'round' });

    this.eyesNormalGroup.addChild(
      eyeBg,
      this.leftIrisGroup,
      this.rightIrisGroup,
      this.eyeLashes,
      this.eyelids
    );

    // Emotion overlays
    this.eyesHappy
      .moveTo(-28, 1)
      .quadraticCurveTo(-18, -11, -8, 1)
      .moveTo(8, 1)
      .quadraticCurveTo(18, -11, 28, 1)
      .stroke({ width: 3.4, color: FUR_OUTLINE, cap: 'round' });
    this.eyesHappy.visible = false;

    this.eyesSleep
      .moveTo(-28, 0)
      .quadraticCurveTo(-18, 7, -8, 0)
      .moveTo(8, 0)
      .quadraticCurveTo(18, 7, 28, 0)
      .stroke({ width: 3.2, color: FUR_OUTLINE, cap: 'round' });
    this.eyesSleep.visible = false;

    this.buildSpiralEye(this.eyesSpiral, -18, 0);
    this.buildSpiralEye(this.eyesSpiral, 18, 0);
    this.eyesSpiral.visible = false;

    this.buildHeart(this.eyesHearts, -18, -1, 8.5);
    this.buildHeart(this.eyesHearts, 18, -1, 8.5);
    this.eyesHearts.visible = false;

    this.headGroup.addChild(
      this.antennae,
      this.headShell,
      this.blush,
      this.eyesNormalGroup,
      this.eyesHappy,
      this.eyesSleep,
      this.eyesSpiral,
      this.eyesHearts,
      this.smileAndProboscis
    );
  }

  private drawMouthAndProboscis(extension: number): void {
    this.smileAndProboscis.clear();

    // Cute smile mouth positioned below the nose/proboscis
    this.smileAndProboscis
      .moveTo(-6.5, 11.5)
      .quadraticCurveTo(0, 17, 6.5, 11.5)
      .stroke({ width: 2, color: FUR_OUTLINE, cap: 'round' });

    // Little rounded proboscis starting ABOVE the mouth (nose bridge)
    const tipX = -2.2 * extension;
    const tipY = 13.5 + 4 * (extension - 1);
    this.smileAndProboscis
      .moveTo(-2.2, 6.5)
      .lineTo(tipX - 2.3, tipY)
      .lineTo(tipX + 2.3, tipY)
      .lineTo(2.2, 6.5)
      .closePath()
      .fill({ color: 0x7c4a46 })
      .stroke({ width: 1.6, color: FUR_OUTLINE });

    // Tiny rounded proboscis tip
    this.smileAndProboscis
      .ellipse(tipX, tipY, 2.6, 1.8)
      .fill({ color: 0xf43f5e, alpha: 0.72 })
      .stroke({ width: 1.4, color: FUR_OUTLINE });
  }

  private buildAnimeIris(group: Container, cx: number, cy: number): void {
    group.position.set(cx, cy);
    const iris = new Graphics();
    // Deep ruby top -> glowing fiery amber-orange bottom
    iris.circle(0, 0, 11.4).fill({ color: 0x7f1d1d });
    iris.ellipse(0, 4.5, 9.6, 6.2).fill({ color: 0xea580c, alpha: 0.85 });
    iris.ellipse(0, 6.4, 7.2, 3.6).fill({ color: 0xfbbf24, alpha: 0.92 });
    // Deep dark pupil
    iris.circle(0, -0.5, 5.4).fill({ color: 0x1c070a });
    // Large oval top-left shine & secondary specular
    iris.ellipse(-4.2, -5.2, 3.6, 2.7).fill({ color: 0xffffff });
    iris.circle(-1.2, -7.8, 1.3).fill({ color: 0xffffff, alpha: 0.9 });
    // Signature 4-point star sparkles
    drawStarSparkle(iris, 5.4, -2.5, 3.4, 0xffffff);
    drawStarSparkle(iris, 4.5, 5.2, 3.8, 0xfef9c3);
    group.addChild(iris);
  }

  private buildSpiralEye(g: Graphics, cx: number, cy: number): void {
    g.circle(cx, cy, 13).fill({ color: 0xfffbeb }).stroke({ width: 2, color: FUR_OUTLINE });
    for (let r = 2.5; r <= 10; r += 3) {
      g.circle(cx, cy, r).stroke({ width: 1.6, color: 0x0284c7 });
    }
  }

  private buildHeart(g: Graphics, cx: number, cy: number, s: number): void {
    g.moveTo(cx, cy + s * 0.7)
      .bezierCurveTo(cx - s * 1.3, cy - s * 0.1, cx - s * 0.8, cy - s * 1.1, cx, cy - s * 0.35)
      .bezierCurveTo(cx + s * 0.8, cy - s * 1.1, cx + s * 1.3, cy - s * 0.1, cx, cy + s * 0.7)
      .fill({ color: 0xf43f5e });
  }

  private buildXRayOverlay(): void {
    this.xrayGroup.visible = false;

    const holoSkull = new Graphics();
    holoSkull
      .ellipse(0, 0, 39, 33)
      .fill({ color: 0x0f172a, alpha: 0.52 })
      .stroke({ width: 2, color: 0x38bdf8, alpha: 0.9 });

    this.xrayGroup.addChild(holoSkull, this.xrayLinks);

    for (const spec of CLUSTER_NODES_SPEC) {
      const glow = new Graphics().circle(0, 0, 13).fill({ color: spec.color, alpha: 0.32 });
      const core = new Graphics()
        .circle(0, 0, 5.2)
        .fill({ color: spec.color })
        .stroke({ width: 1.2, color: 0xffffff, alpha: 0.85 });

      glow.position.set(spec.x, spec.y);
      core.position.set(spec.x, spec.y);

      this.xrayGroup.addChild(glow, core);
      this.xrayNodes.push({
        key: spec.key,
        x: spec.x,
        y: spec.y,
        color: spec.color,
        glow,
        core,
      });
    }

    this.headGroup.addChild(this.xrayGroup);
  }

  update(input: ChibiFlyUpdateInput): void {
    const { deltaTime, state, clusters, neuromodulators, lookAngle, cursorOffset, xrayEnabled } =
      input;
    this.elapsed += deltaTime * 0.05;

    // 1. Eye contact & subtle head tilt toward cursor
    let targetPupilX = Math.cos(lookAngle) * 2.2;
    let targetPupilY = Math.sin(lookAngle) * 1.8;
    if (cursorOffset) {
      const dist = Math.hypot(cursorOffset.dx, cursorOffset.dy) || 1;
      const clampDist = Math.min(1, dist / 150);
      targetPupilX = (cursorOffset.dx / dist) * 2.8 * clampDist;
      targetPupilY = (cursorOffset.dy / dist) * 2.4 * clampDist;
    }
    const eyeLerp = Math.min(1, 0.2 * deltaTime);
    this.pupilOffsetX += (targetPupilX - this.pupilOffsetX) * eyeLerp;
    this.pupilOffsetY += (targetPupilY - this.pupilOffsetY) * eyeLerp;

    this.leftIrisGroup.position.set(-18 + this.pupilOffsetX, this.pupilOffsetY);
    this.rightIrisGroup.position.set(18 + this.pupilOffsetX, this.pupilOffsetY);

    const irisScale = state === 'startled' ? 0.65 : 1;
    this.leftIrisGroup.scale.set(irisScale);
    this.rightIrisGroup.scale.set(irisScale);

    // 2. Natural blinking
    this.blinkTimer -= deltaTime;
    if (this.blinkTimer <= 0) {
      this.blinkProgress += deltaTime * 0.35;
      if (this.blinkProgress >= Math.PI) {
        this.blinkProgress = 0;
        this.blinkTimer = 110 + Math.random() * 140;
      }
    }
    this.eyelids.clear();
    if (this.blinkProgress > 0 && state !== 'sleep') {
      const lidH = Math.sin(this.blinkProgress) * 30;
      this.eyelids
        .ellipse(-18, -16 + lidH * 0.45, 15, Math.max(1, lidH * 0.52))
        .ellipse(18, -16 + lidH * 0.45, 15, Math.max(1, lidH * 0.52))
        .fill({ color: FUR_DARK });
    }

    // 3. Eye emotions & blush
    const isHappy = state === 'eat' || state === 'drink' || state === 'grooming';
    const isHeartMode =
      !xrayEnabled && neuromodulators.dopamine > 0.72 && (state === 'eat' || state === 'drink');
    const isZapped = state === 'electrocuted';
    const isSleep = state === 'sleep';

    this.eyesNormalGroup.visible =
      !xrayEnabled && !isHappy && !isSleep && !isZapped && !isHeartMode;
    this.eyesHappy.visible = !xrayEnabled && isHappy && !isHeartMode;
    this.eyesSleep.visible = !xrayEnabled && isSleep;
    this.eyesSpiral.visible = !xrayEnabled && isZapped;
    this.eyesHearts.visible = !xrayEnabled && isHeartMode;

    this.blush.alpha = isHappy || isHeartMode ? 1 : 0.72;

    // 4. Body & head procedural animations
    const isFlying = state === 'fly' || state === 'startled';
    const breath = Math.sin(this.elapsed * 1.4);

    let bodyBobY = breath * 1.0;
    let headBobY = -14 + breath * 1.4;
    let headTilt = this.pupilOffsetX * 0.035;
    let shakeX = 0;

    if (state === 'walk') {
      bodyBobY = Math.abs(Math.sin(this.elapsed * 4.5)) * -3;
      headTilt += Math.sin(this.elapsed * 4.5) * 0.07;
    } else if (state === 'fly') {
      bodyBobY = -15 + Math.sin(this.elapsed * 3.2) * 5;
      headBobY = -29 + Math.sin(this.elapsed * 3.2) * 5;
    } else if (state === 'startled') {
      bodyBobY = -18 + Math.sin(this.elapsed * 7) * 4;
      headBobY = -33 + Math.sin(this.elapsed * 7) * 4;
      headTilt = Math.sin(this.elapsed * 9) * 0.12;
    } else if (state === 'electrocuted') {
      shakeX = Math.sin(this.elapsed * 26) * 4.5;
      headTilt = Math.cos(this.elapsed * 22) * 0.14;
    } else if (state === 'sleep') {
      headBobY = -11 + Math.sin(this.elapsed * 0.8) * 1.8;
      headTilt = 0.07 + Math.sin(this.elapsed * 0.8) * 0.035;
    } else if (state === 'eat' || state === 'drink') {
      headBobY = -12 + Math.sin(this.elapsed * 4.8) * 2.2;
    }

    this.bodyGroup.position.set(shakeX, bodyBobY);
    this.wingsGroup.position.set(shakeX, bodyBobY);
    this.headGroup.position.set(shakeX, headBobY);
    this.headGroup.rotation = headTilt;

    // Proboscis extension on eat / drink
    if (state === 'eat' || state === 'drink') {
      this.drawMouthAndProboscis(1.4 + Math.abs(Math.sin(this.elapsed * 4.8)) * 0.55);
    } else {
      this.drawMouthAndProboscis(1);
    }

    // Front paws pose: tucked cutely at chest in idle, rubbing near face in grooming
    if (state === 'grooming') {
      this.pawFrontLeft.position.set(-15, 7);
      this.pawFrontLeft.rotation = -0.65 + Math.sin(this.elapsed * 8) * 0.3;
      this.pawFrontRight.position.set(15, 7);
      this.pawFrontRight.rotation = 0.65 - Math.sin(this.elapsed * 8) * 0.3;
    } else if (state === 'walk') {
      this.pawFrontLeft.position.set(-13, 15 + Math.sin(this.elapsed * 6) * 2.5);
      this.pawFrontLeft.rotation = -0.35 + Math.sin(this.elapsed * 6) * 0.2;
      this.pawFrontRight.position.set(13, 15 - Math.sin(this.elapsed * 6) * 2.5);
      this.pawFrontRight.rotation = 0.35 - Math.sin(this.elapsed * 6) * 0.2;
    } else {
      this.pawFrontLeft.position.set(-13, 14);
      this.pawFrontLeft.rotation = -0.35;
      this.pawFrontRight.position.set(13, 14);
      this.pawFrontRight.rotation = 0.35;
    }

    // 5. Wings flutter
    const flutterRate = isZapped
      ? 1.9
      : isFlying
        ? 1.4
        : isSleep || state === 'idle'
          ? 0.05
          : 0.22 + clusters.motor * 0.35;
    this.wingPhase += flutterRate * deltaTime;
    const wingAmp = isZapped ? 0.34 : isFlying ? 0.32 : isSleep ? 0.02 : 0.08;
    const wingAngle = Math.sin(this.wingPhase) * wingAmp;
    this.leftWing.rotation = -wingAngle;
    this.rightWing.rotation = wingAngle;

    // 6. Sleep Zzz & Electrocuted sparks
    this.sleepText.visible = isSleep;
    if (isSleep) {
      this.sleepText.y = -48 - ((this.elapsed * 6) % 16);
      this.sleepText.alpha = 0.4 + Math.abs(Math.sin(this.elapsed * 1.4)) * 0.6;
    }

    this.zapBolts.visible = isZapped;
    if (isZapped) {
      this.zapBolts.clear();
      const jitter = Math.sin(this.elapsed * 18) * 6;
      this.zapBolts
        .moveTo(-46, -28 + jitter)
        .lineTo(-34, -14)
        .lineTo(-42, -6 - jitter)
        .moveTo(46, -26 - jitter)
        .lineTo(35, -12)
        .lineTo(43, -4 + jitter)
        .stroke({ width: 2.2, color: 0x38bdf8 });
    }

    // 7. Brain X-Ray hologram inside big chibi head
    this.xrayGroup.visible = xrayEnabled;
    this.headShell.alpha = xrayEnabled ? 0.22 : 1;
    this.bodyGroup.alpha = xrayEnabled ? 0.35 : 1;
    this.wingsGroup.alpha = xrayEnabled ? 0.35 : 1;
    this.blush.visible = !xrayEnabled;
    this.smileAndProboscis.visible = !xrayEnabled;

    if (xrayEnabled) {
      this.xrayLinks.clear();
      for (const [fromIdx, toIdx] of CLUSTER_LINKS) {
        const a = this.xrayNodes[fromIdx];
        const b = this.xrayNodes[toIdx];
        const strength = (clusters[a.key] + clusters[b.key]) * 0.5;
        this.xrayLinks
          .moveTo(a.x, a.y)
          .lineTo(b.x, b.y)
          .stroke({ width: 1.2 + strength * 1.8, color: 0x7dd3fc, alpha: 0.2 + strength * 0.65 });
      }

      for (const node of this.xrayNodes) {
        const activity = clusters[node.key];
        const pulse = 1 + Math.sin(this.elapsed * (3 + activity * 5)) * 0.16;
        node.glow.scale.set((0.65 + activity * 0.95) * pulse);
        node.glow.alpha = 0.18 + activity * 0.6;
        node.core.scale.set(0.75 + activity * 0.55);
      }
    }
  }
}
