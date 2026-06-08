/* ============================================
   ANIBAL SANTA CRUZ — 3D PORTFOLIO SCENE
   Three.js Interactive Constellation
   ============================================ */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ============================================
// CONSTANTS & CONFIG
// ============================================
const COLORS = {
    bg: 0x0A0F1D,
    cyan: 0x00F0FF,
    purple: 0xB486FF,
    silver: 0xC0D0E0,
    gold: 0xFFD700,
    white: 0xffffff,
};

const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent) || window.innerWidth <= 768;

const NODE_CONFIG = {
    core: { position: new THREE.Vector3(0, 0, 0), color: COLORS.cyan, panelId: 'panel-core' },
    intelica: { position: new THREE.Vector3(5, 1.5, 2), color: COLORS.cyan, panelId: 'panel-intelica' },
    education: { position: new THREE.Vector3(-4, 2, -4), color: COLORS.purple, panelId: 'panel-education' },
    innovation: { position: new THREE.Vector3(3, -2, -5), color: COLORS.gold, panelId: 'panel-innovation' },
};

const ORBIT_RADII = { intelica: 6, education: 7, innovation: 8 };
const ORBIT_SPEEDS = { intelica: 0.08, education: 0.06, innovation: 0.05 };

// ============================================
// STATE
// ============================================
const state = {
    mouse: new THREE.Vector2(),
    mouseNorm: new THREE.Vector2(),
    raycaster: new THREE.Raycaster(),
    hoveredNode: null,
    activeNode: null,
    isTransitioning: false,
    introComplete: false,
    clock: new THREE.Clock(),
    cameraTarget: new THREE.Vector3(0, 0, 0),
    cameraPosition: new THREE.Vector3(0, 2, 16),
    defaultCamPos: new THREE.Vector3(0, 2, 16),
    defaultCamTarget: new THREE.Vector3(0, 0, 0),
    orbitAngle: 0,
    autoOrbit: true,
    isDragging: false,
    dragStart: new THREE.Vector2(),
    sphericalDelta: { theta: 0, phi: 0 },
    spherical: { theta: 0, phi: Math.PI / 2.3 },
    damping: { theta: 0, phi: 0 },
};

const audioState = {
    started: false,
    enabled: false,
    persistedEnabled: false,
    storageKey: 'anibalPortfolioAmbienceEnabled',
    context: null,
    masterGain: null,
    oscillators: [],
    noiseSource: null,
    filterLFO: null,
};

function loadAudioPreference() {
    try {
        const value = localStorage.getItem(audioState.storageKey);
        audioState.persistedEnabled = value === 'true';
    } catch (error) {
        audioState.persistedEnabled = false;
    }
}

function saveAudioPreference() {
    try {
        localStorage.setItem(audioState.storageKey, audioState.enabled ? 'true' : 'false');
    } catch (error) {
        // ignore storage errors
    }
}

// ============================================
// INIT SCENE
// ============================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);
scene.fog = new THREE.FogExp2(COLORS.bg, 0.018);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.copy(state.cameraPosition);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

// ============================================
// POST-PROCESSING
// ============================================
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    isMobile ? 0.6 : 0.8,   // strength
    0.4,   // radius
    0.85   // threshold
);
composer.addPass(bloomPass);

// Chromatic Aberration Shader
const ChromaticAberrationShader = {
    uniforms: {
        tDiffuse: { value: null },
        uIntensity: { value: 0.002 },
        uTime: { value: 0 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uIntensity;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
            vec2 center = vec2(0.5);
            vec2 dir = vUv - center;
            float dist = length(dir);
            float aberration = uIntensity * dist * dist;
            float r = texture2D(tDiffuse, vUv + dir * aberration).r;
            float g = texture2D(tDiffuse, vUv).g;
            float b = texture2D(tDiffuse, vUv - dir * aberration).b;
            // Subtle scanline
            float scanline = 1.0 - 0.03 * sin(vUv.y * 800.0 + uTime * 2.0);
            // Vignette
            float vignette = 1.0 - dist * 0.6;
            gl_FragColor = vec4(r, g, b, 1.0) * scanline * vignette;
        }
    `
};

const chromaPass = new ShaderPass(ChromaticAberrationShader);
composer.addPass(chromaPass);

// ============================================
// LIGHTING
// ============================================
const ambientLight = new THREE.AmbientLight(0x1a1a3a, 0.5);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(COLORS.cyan, 2, 30);
pointLight1.position.set(5, 5, 5);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(COLORS.purple, 1.5, 30);
pointLight2.position.set(-5, -3, -5);
scene.add(pointLight2);

const pointLight3 = new THREE.PointLight(COLORS.gold, 0.8, 20);
pointLight3.position.set(3, -4, 3);
scene.add(pointLight3);

// ============================================
// BACKGROUND PARTICLES
// ============================================
function createParticleField() {
    const count = isMobile ? 1200 : 2000;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const cCyan = new THREE.Color(COLORS.cyan);
    const cPurple = new THREE.Color(COLORS.purple);
    const cSilver = new THREE.Color(COLORS.silver);

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const radius = 20 + Math.random() * 60;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);

        sizes[i] = 0.5 + Math.random() * 2.0;

        const colorChoice = Math.random();
        const c = colorChoice < 0.4 ? cCyan : colorChoice < 0.7 ? cPurple : cSilver;
        colors[i3] = c.r;
        colors[i3 + 1] = c.g;
        colors[i3 + 2] = c.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: renderer.getPixelRatio() },
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            varying float vOpacity;
            uniform float uTime;
            uniform float uPixelRatio;
            void main() {
                vColor = color;
                vec3 pos = position;
                pos.x += sin(uTime * 0.1 + position.z * 0.05) * 0.3;
                pos.y += cos(uTime * 0.08 + position.x * 0.05) * 0.3;
                vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
                vOpacity = 0.3 + 0.3 * sin(uTime * 0.5 + position.x * 0.1);
                gl_PointSize = size * uPixelRatio * (80.0 / -mvPos.z);
                gl_Position = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            varying float vOpacity;
            void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                if (d > 0.5) discard;
                float alpha = smoothstep(0.5, 0.0, d) * vOpacity;
                gl_FragColor = vec4(vColor, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    return new THREE.Points(geometry, material);
}

const particles = createParticleField();
scene.add(particles);

// ============================================
// GRID FLOOR
// ============================================
function createGrid() {
    const gridGroup = new THREE.Group();

    const gridMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(COLORS.cyan) },
        },
        vertexShader: `
            varying vec3 vWorldPos;
            void main() {
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uColor;
            varying vec3 vWorldPos;
            void main() {
                vec2 coord = vWorldPos.xz;
                vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
                float line = min(grid.x, grid.y);
                float alpha = 1.0 - min(line, 1.0);
                float dist = length(vWorldPos.xz) / 30.0;
                alpha *= max(0.0, 1.0 - dist) * 0.12;
                alpha *= 0.8 + 0.2 * sin(uTime * 0.5 + vWorldPos.x * 0.2);
                gl_FragColor = vec4(uColor, alpha);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const gridGeo = new THREE.PlaneGeometry(80, 80);
    const gridMesh = new THREE.Mesh(gridGeo, gridMat);
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.y = -6;
    gridGroup.add(gridMesh);

    return gridGroup;
}

const grid = createGrid();
scene.add(grid);

// ============================================
// ORBIT RINGS (visual orbit paths)
// ============================================
function createOrbitRing(radius, color, tiltX = 0, tiltZ = 0) {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
    const points = curve.getPoints(128);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Line(geometry, material);
    ring.rotation.x = Math.PI / 2 + tiltX;
    ring.rotation.z = tiltZ;
    return ring;
}

scene.add(createOrbitRing(ORBIT_RADII.intelica, COLORS.cyan, 0.3, 0.1));
scene.add(createOrbitRing(ORBIT_RADII.education, COLORS.purple, -0.2, -0.15));
scene.add(createOrbitRing(ORBIT_RADII.innovation, COLORS.gold, 0.15, 0.2));

// ============================================
// CONNECTION LINES between nodes
// ============================================
const connectionLines = [];
function createConnectionLine(fromKey, toKey) {
    const material = new THREE.LineBasicMaterial({
        color: COLORS.cyan,
        transparent: true,
        opacity: 0.06,
        blending: THREE.AdditiveBlending,
    });
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(6);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    connectionLines.push({ line, fromKey, toKey });
}

createConnectionLine('core', 'intelica');
createConnectionLine('core', 'education');
createConnectionLine('core', 'innovation');
createConnectionLine('intelica', 'education');

// ============================================
// NODE CREATION
// ============================================
const nodes = {};
const clickableObjects = [];

// --- Shared utilities ---
function createGlowSprite(color, scale = 4) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    const c = new THREE.Color(color);
    gradient.addColorStop(0, `rgba(${c.r * 255 | 0}, ${c.g * 255 | 0}, ${c.b * 255 | 0}, 0.6)`);
    gradient.addColorStop(0.4, `rgba(${c.r * 255 | 0}, ${c.g * 255 | 0}, ${c.b * 255 | 0}, 0.15)`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(scale, scale, 1);
    return sprite;
}

// --- Node 1: Central Core (Geodesic Sphere) ---
function createCoreNode() {
    const group = new THREE.Group();
    group.userData = { key: 'core', baseScale: 1 };

    // Outer wireframe sphere
    const outerGeo = new THREE.IcosahedronGeometry(1.2, 2);
    const outerMat = new THREE.MeshBasicMaterial({
        color: COLORS.cyan,
        wireframe: true,
        transparent: true,
        opacity: 0.25,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    group.add(outerMesh);

    // Inner emissive sphere
    const innerGeo = new THREE.IcosahedronGeometry(0.6, 3);
    const innerMat = new THREE.MeshStandardMaterial({
        color: COLORS.cyan,
        emissive: COLORS.cyan,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.3,
        roughness: 0.2,
        metalness: 0.8,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    group.add(innerMesh);

    // Data stream particles inside
    const streamCount = 200;
    const streamPos = new Float32Array(streamCount * 3);
    for (let i = 0; i < streamCount; i++) {
        const r = Math.random() * 0.9;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        streamPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        streamPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        streamPos[i * 3 + 2] = r * Math.cos(phi);
    }
    const streamGeo = new THREE.BufferGeometry();
    streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPos, 3));
    const streamMat = new THREE.PointsMaterial({
        color: COLORS.cyan,
        size: 0.03,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const streamPoints = new THREE.Points(streamGeo, streamMat);
    group.add(streamPoints);

    // Glow
    group.add(createGlowSprite(COLORS.cyan, 5));

    // Label
    const label = createLabel('CORE OVERVIEW', COLORS.cyan);
    label.position.y = 2;
    group.add(label);

    // Hitbox
    const hitbox = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.userData = { nodeKey: 'core' };
    group.add(hitbox);
    clickableObjects.push(hitbox);

    group.position.copy(NODE_CONFIG.core.position);
    return group;
}

// --- Node 2: Intelica (Atomic Cube) ---
function createIntelicaNode() {
    const group = new THREE.Group();
    group.userData = { key: 'intelica', baseScale: 1 };

    // Build cube from small blocks
    const blockGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const blockMat = new THREE.MeshStandardMaterial({
        color: COLORS.cyan,
        emissive: COLORS.cyan,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.6,
        roughness: 0.3,
        metalness: 0.9,
    });

    const cubeGroup = new THREE.Group();
    const gridSize = 5;
    const spacing = 0.22;
    const offset = (gridSize - 1) * spacing / 2;

    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
            for (let z = 0; z < gridSize; z++) {
                // Only edges and sparse interior
                const isEdge = (x === 0 || x === gridSize - 1) +
                    (y === 0 || y === gridSize - 1) +
                    (z === 0 || z === gridSize - 1) >= 2;
                if (isEdge || Math.random() < 0.08) {
                    const block = new THREE.Mesh(blockGeo, blockMat.clone());
                    block.position.set(
                        x * spacing - offset,
                        y * spacing - offset,
                        z * spacing - offset
                    );
                    cubeGroup.add(block);
                }
            }
        }
    }
    group.add(cubeGroup);

    // Outer wireframe
    const wireGeo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
    const wireMat = new THREE.MeshBasicMaterial({
        color: COLORS.cyan,
        wireframe: true,
        transparent: true,
        opacity: 0.1,
    });
    group.add(new THREE.Mesh(wireGeo, wireMat));

    // Glow
    group.add(createGlowSprite(COLORS.cyan, 3.5));

    // Label
    const label = createLabel('INTELICA', COLORS.cyan);
    label.position.y = 1.5;
    group.add(label);

    // Hitbox
    const hitbox = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.userData = { nodeKey: 'intelica' };
    group.add(hitbox);
    clickableObjects.push(hitbox);

    return group;
}

// --- Node 3: Education (Neural Network) ---
function createEducationNode() {
    const group = new THREE.Group();
    group.userData = { key: 'education', baseScale: 1 };

    // Neural nodes
    const neuronGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const neuronMat = new THREE.MeshStandardMaterial({
        color: COLORS.purple,
        emissive: COLORS.purple,
        emissiveIntensity: 0.6,
    });

    const neuronPositions = [];
    const neuronCount = 30;
    for (let i = 0; i < neuronCount; i++) {
        const r = 0.3 + Math.random() * 0.8;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const pos = new THREE.Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
        neuronPositions.push(pos);
        const neuron = new THREE.Mesh(neuronGeo, neuronMat);
        neuron.position.copy(pos);
        group.add(neuron);
    }

    // Connections
    const lineMat = new THREE.LineBasicMaterial({
        color: COLORS.purple,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
    });

    for (let i = 0; i < neuronPositions.length; i++) {
        for (let j = i + 1; j < neuronPositions.length; j++) {
            if (neuronPositions[i].distanceTo(neuronPositions[j]) < 0.8) {
                const lineGeo = new THREE.BufferGeometry().setFromPoints([
                    neuronPositions[i], neuronPositions[j]
                ]);
                group.add(new THREE.Line(lineGeo, lineMat.clone()));
            }
        }
    }

    // Glow
    group.add(createGlowSprite(COLORS.purple, 4));

    // Label
    const label = createLabel('EDUCATION', COLORS.purple);
    label.position.y = 1.5;
    group.add(label);

    // Hitbox
    const hitbox = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.userData = { nodeKey: 'education' };
    group.add(hitbox);
    clickableObjects.push(hitbox);

    return group;
}

// --- Node 4: Innovation (Metallic Ring/Prism) ---
function createInnovationNode() {
    const group = new THREE.Group();
    group.userData = { key: 'innovation', baseScale: 1 };

    // Main ring
    const ringGeo = new THREE.TorusGeometry(0.6, 0.08, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
        color: COLORS.gold,
        emissive: COLORS.gold,
        emissiveIntensity: 0.3,
        metalness: 1.0,
        roughness: 0.15,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    group.add(ring);

    // Inner prism
    const prismGeo = new THREE.OctahedronGeometry(0.35, 0);
    const prismMat = new THREE.MeshStandardMaterial({
        color: COLORS.gold,
        emissive: COLORS.gold,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.5,
        metalness: 0.9,
        roughness: 0.2,
    });
    group.add(new THREE.Mesh(prismGeo, prismMat));

    // Outer orbit ring decorations
    const orbitRingGeo = new THREE.TorusGeometry(0.9, 0.015, 8, 64);
    const orbitRingMat = new THREE.MeshBasicMaterial({
        color: COLORS.gold,
        transparent: true,
        opacity: 0.2,
    });
    const orbitRing1 = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRing1.rotation.x = Math.PI / 3;
    group.add(orbitRing1);

    const orbitRing2 = new THREE.Mesh(orbitRingGeo, orbitRingMat.clone());
    orbitRing2.rotation.x = -Math.PI / 4;
    orbitRing2.rotation.z = Math.PI / 4;
    group.add(orbitRing2);

    // Glow
    group.add(createGlowSprite(COLORS.gold, 3.5));

    // Label
    const label = createLabel('EXPERIENCE', COLORS.gold);
    label.position.y = 1.5;
    group.add(label);

    // Hitbox
    const hitbox = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.userData = { nodeKey: 'innovation' };
    group.add(hitbox);
    clickableObjects.push(hitbox);

    return group;
}

// --- Label helper ---
function createLabel(text, color) {
    const canvas = document.createElement('canvas');
    const dpr = 2;
    canvas.width = 256 * dpr;
    canvas.height = 40 * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.font = '600 11px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const c = new THREE.Color(color);
    ctx.fillStyle = `rgba(${c.r * 255 | 0}, ${c.g * 255 | 0}, ${c.b * 255 | 0}, 0.8)`;
    ctx.shadowColor = `rgba(${c.r * 255 | 0}, ${c.g * 255 | 0}, ${c.b * 255 | 0}, 0.5)`;
    ctx.shadowBlur = 10;
    ctx.fillText(text, 128, 20);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.5, 0.4, 1);
    return sprite;
}

// --- Create all nodes ---
nodes.core = createCoreNode();
scene.add(nodes.core);

nodes.intelica = createIntelicaNode();
scene.add(nodes.intelica);

nodes.education = createEducationNode();
scene.add(nodes.education);

nodes.innovation = createInnovationNode();
scene.add(nodes.innovation);

// ============================================
// CAMERA SYSTEM
// ============================================
function getCameraPositionForNode(key) {
    const node = nodes[key];
    const pos = node.position.clone();
    // Position camera in front of and slightly above the node, facing toward it
    const offset = new THREE.Vector3(2.5, 1.0, 3.5);
    return pos.clone().add(offset);
}

function createAmbientSound() {
    if (audioState.started) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);

    const baseDrone = ctx.createOscillator();
    baseDrone.type = 'triangle';
    baseDrone.frequency.value = 36;
    const baseGain = ctx.createGain();
    baseGain.gain.value = 0.035;
    baseDrone.connect(baseGain).connect(masterGain);
    baseDrone.start();

    const subDrone = ctx.createOscillator();
    subDrone.type = 'sine';
    subDrone.frequency.value = 22;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.02;
    subDrone.connect(subGain).connect(masterGain);
    subDrone.start();

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * 0.12;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 720;
    noiseFilter.Q.value = 0.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.015;
    noiseSource.connect(noiseFilter).connect(noiseGain).connect(masterGain);
    noiseSource.start();

    const filterLFO = ctx.createOscillator();
    filterLFO.type = 'sine';
    filterLFO.frequency.value = 0.085;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 360;
    filterLFO.connect(lfoGain).connect(noiseFilter.frequency);
    filterLFO.start();

    audioState.started = true;
    audioState.enabled = false;
    audioState.context = ctx;
    audioState.masterGain = masterGain;
    audioState.oscillators = [baseDrone, subDrone];
    audioState.noiseSource = noiseSource;
    audioState.filterLFO = filterLFO;
}

function setAudioControlState(enabled) {
    const control = document.getElementById('audio-control');
    if (!control) return;
    if (enabled) {
        control.classList.add('active');
        control.textContent = 'DISABLE AMBIENCE';
    } else {
        control.classList.remove('active');
        control.textContent = 'ENABLE AMBIENCE';
    }
}

function toggleAmbientAudio() {
    createAmbientSound();
    if (!audioState.context) return;

    const now = audioState.context.currentTime;
    audioState.context.resume();
    audioState.masterGain.gain.cancelScheduledValues(now);

    if (!audioState.enabled) {
        audioState.masterGain.gain.setValueAtTime(audioState.masterGain.gain.value || 0, now);
        audioState.masterGain.gain.linearRampToValueAtTime(0.065, now + 1.8);
        audioState.enabled = true;
    } else {
        audioState.masterGain.gain.setValueAtTime(audioState.masterGain.gain.value || 0.065, now);
        audioState.masterGain.gain.linearRampToValueAtTime(0, now + 1.2);
        audioState.enabled = false;
    }

    setAudioControlState(audioState.enabled);
    saveAudioPreference();
}

function transitionToNode(key) {
    if (state.isTransitioning) return;
    state.isTransitioning = true;
    state.activeNode = key;
    state.autoOrbit = false;

    // Hide all panels first
    document.querySelectorAll('.detail-panel').forEach(p => {
        p.classList.add('hidden');
        p.classList.remove('visible');
    });

    // Set camera targets
    const targetPos = getCameraPositionForNode(key);
    const targetLook = nodes[key].position.clone();

    // Animate
    const startPos = camera.position.clone();
    const startTarget = state.cameraTarget.clone();
    const duration = 1500;
    const startTime = performance.now();

    function animateTransition(now) {
        const elapsed = now - startTime;
        let t = Math.min(elapsed / duration, 1);
        // Smooth easing
        t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        camera.position.lerpVectors(startPos, targetPos, t);
        state.cameraTarget.lerpVectors(startTarget, targetLook, t);
        camera.lookAt(state.cameraTarget);

        if (t < 1) {
            requestAnimationFrame(animateTransition);
        } else {
            state.isTransitioning = false;
            // Show panel
            const panelId = NODE_CONFIG[key].panelId;
            const panel = document.getElementById(panelId);
            panel.classList.remove('hidden');
            panel.classList.add('visible');

            // Animate metrics if intelica
            if (key === 'intelica') animateMetrics();

            // Draw radar chart if core
            if (key === 'core') drawRadarChart();

            // Update nav dots
            updateNavDots(key);
        }
    }

    requestAnimationFrame(animateTransition);
}

function returnToOrbit() {
    if (state.isTransitioning) return;
    state.isTransitioning = true;

    // Hide panels
    document.querySelectorAll('.detail-panel').forEach(p => {
        p.classList.add('hidden');
        p.classList.remove('visible');
    });

    const startPos = camera.position.clone();
    const startTarget = state.cameraTarget.clone();
    const duration = 1200;
    const startTime = performance.now();

    function animateReturn(now) {
        const elapsed = now - startTime;
        let t = Math.min(elapsed / duration, 1);
        t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        camera.position.lerpVectors(startPos, state.defaultCamPos, t);
        state.cameraTarget.lerpVectors(startTarget, state.defaultCamTarget, t);
        camera.lookAt(state.cameraTarget);

        if (t < 1) {
            requestAnimationFrame(animateReturn);
        } else {
            state.isTransitioning = false;
            state.activeNode = null;
            state.autoOrbit = true;
            updateNavDots(null);
        }
    }

    requestAnimationFrame(animateReturn);
}

function updateNavDots(activeKey) {
    document.querySelectorAll('.nav-dot').forEach(dot => {
        const key = dot.dataset.node;
        dot.classList.toggle('active', key === activeKey || (activeKey === null && key === 'core'));
    });
}

// ============================================
// INTRO CINEMATIC
// ============================================
function playIntroCinematic() {
    const duration = 4000;
    const startTime = performance.now();
    const startPos = new THREE.Vector3(15, 8, 15);
    camera.position.copy(startPos);

    function animateIntro(now) {
        const elapsed = now - startTime;
        let t = Math.min(elapsed / duration, 1);
        t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        camera.position.lerpVectors(startPos, state.defaultCamPos, t);

        // Slight orbit during intro
        const introOrbit = (1 - t) * Math.PI * 0.5;
        const pos = camera.position.clone();
        const rx = pos.x * Math.cos(introOrbit * 0.3) - pos.z * Math.sin(introOrbit * 0.3);
        const rz = pos.x * Math.sin(introOrbit * 0.3) + pos.z * Math.cos(introOrbit * 0.3);
        camera.position.x = rx;
        camera.position.z = rz;

        camera.lookAt(state.cameraTarget);

        if (t < 1) {
            requestAnimationFrame(animateIntro);
        } else {
            state.introComplete = true;
            state.autoOrbit = true;
            camera.position.copy(state.defaultCamPos);
            state.spherical.theta = Math.atan2(state.defaultCamPos.x, state.defaultCamPos.z);
        }
    }

    requestAnimationFrame(animateIntro);
}

// ============================================
// INTERACTION HANDLERS
// ============================================
function onMouseMove(e) {
    state.mouse.x = e.clientX;
    state.mouse.y = e.clientY;
    state.mouseNorm.x = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouseNorm.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // Crosshair follows cursor
    const crosshair = document.getElementById('crosshair');
    crosshair.style.left = e.clientX + 'px';
    crosshair.style.top = e.clientY + 'px';

    // Drag orbit
    if (state.isDragging && state.introComplete && !state.activeNode) {
        const deltaX = e.clientX - state.dragStart.x;
        const deltaY = e.clientY - state.dragStart.y;
        state.sphericalDelta.theta = -deltaX * 0.005;
        state.sphericalDelta.phi = -deltaY * 0.003;
        state.dragStart.set(e.clientX, e.clientY);
        state.autoOrbit = false;
    }
}

function onMouseDown(e) {
    if (e.button !== 0) return;
    activateAmbientAudio();
    state.isDragging = true;
    state.dragStart.set(e.clientX, e.clientY);
}

function onMouseUp() {
    if (state.isDragging) {
        state.isDragging = false;
    }
}

function onClick(e) {
    if (!state.introComplete || state.isTransitioning) return;

    state.raycaster.setFromCamera(state.mouseNorm, camera);
    const intersects = state.raycaster.intersectObjects(clickableObjects);

    if (intersects.length > 0) {
        const nodeKey = intersects[0].object.userData.nodeKey;
        if (state.activeNode === nodeKey) return;
        transitionToNode(nodeKey);
    }
}

function onTouchStart(e) {
    if (e.touches.length === 1) {
        activateAmbientAudio();
        const touch = e.touches[0];
        state.mouseNorm.x = (touch.clientX / window.innerWidth) * 2 - 1;
        state.mouseNorm.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        state.isDragging = true;
        state.dragStart.set(touch.clientX, touch.clientY);
    }
}

function onTouchMove(e) {
    if (e.touches.length === 1 && state.isDragging && !state.activeNode) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - state.dragStart.x;
        const deltaY = touch.clientY - state.dragStart.y;
        state.sphericalDelta.theta = -deltaX * 0.005;
        state.sphericalDelta.phi = -deltaY * 0.003;
        state.dragStart.set(touch.clientX, touch.clientY);
        state.autoOrbit = false;
    }
}

function onTouchEnd(e) {
    state.isDragging = false;
    // Simple tap detection for click
    if (!state.isTransitioning && state.introComplete) {
        state.raycaster.setFromCamera(state.mouseNorm, camera);
        const intersects = state.raycaster.intersectObjects(clickableObjects);
        if (intersects.length > 0) {
            transitionToNode(intersects[0].object.userData.nodeKey);
        }
    }
}

window.addEventListener('mousemove', onMouseMove, { passive: true });
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);
window.addEventListener('click', onClick);
window.addEventListener('touchstart', onTouchStart, { passive: true });
window.addEventListener('touchmove', onTouchMove, { passive: true });
window.addEventListener('touchend', onTouchEnd);

// Nav dots
document.querySelectorAll('.nav-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        const key = dot.dataset.node;
        if (state.activeNode === key) return;
        if (state.activeNode) {
            // Return first, then go
            returnToOrbit();
            setTimeout(() => transitionToNode(key), 600);
        } else {
            transitionToNode(key);
        }
    });
});

// Back buttons
document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', returnToOrbit);
});

// ============================================
// ANIMATE METRICS
// ============================================
function animateMetrics() {
    document.querySelectorAll('.metric-value').forEach(el => {
        const target = parseInt(el.dataset.target, 10);
        let current = 0;
        const step = target / 40;
        const interval = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(interval);
            }
            el.textContent = Math.round(current);
        }, 30);
    });
}

// ============================================
// RADAR CHART
// ============================================
function drawRadarChart() {
    const canvas = document.getElementById('radar-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 30;

    ctx.clearRect(0, 0, w, h);

    const labels = ['UX Design', 'Research', 'Visual', 'Product Design', 'Prototyping', 'DesignOps'];
    const values = [0.95, 0.88, 0.92, 0.8, 0.9, 0.85];
    const n = labels.length;
    const angleStep = (Math.PI * 2) / n;

    // Grid circles
    for (let i = 1; i <= 4; i++) {
        const r = (radius * i) / 4;
        ctx.beginPath();
        for (let j = 0; j <= n; j++) {
            const a = j * angleStep - Math.PI / 2;
            const x = cx + r * Math.cos(a);
            const y = cy + r * Math.sin(a);
            j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Spokes
    for (let i = 0; i < n; i++) {
        const a = i * angleStep - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Data shape
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
        const idx = i % n;
        const a = idx * angleStep - Math.PI / 2;
        const r = radius * values[idx];
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.fillStyle = 'rgba(0, 240, 255, 0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Data points
    for (let i = 0; i < n; i++) {
        const a = i * angleStep - Math.PI / 2;
        const r = radius * values[i];
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00F0FF';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Labels
    ctx.font = '500 10px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(200, 215, 240, 0.6)';

    for (let i = 0; i < n; i++) {
        const a = i * angleStep - Math.PI / 2;
        const lr = radius + 20;
        const x = cx + lr * Math.cos(a);
        const y = cy + lr * Math.sin(a);
        ctx.fillText(labels[i], x, y);
    }
}

// ============================================
// HUD TIME
// ============================================
function updateHudTime() {
    const el = document.getElementById('hud-time');
    if (el) {
        const now = new Date();
        el.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    }
}
setInterval(updateHudTime, 1000);
updateHudTime();

// ============================================
// RESIZE
// ============================================
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloomPass.resolution.set(window.innerWidth, window.innerHeight);
}
loadAudioPreference();

const audioControl = document.getElementById('audio-control');
if (audioControl) {
    if (audioState.persistedEnabled) {
        audioControl.classList.add('active');
    }
    audioControl.textContent = 'ENABLE AMBIENCE';

    audioControl.addEventListener('click', toggleAmbientAudio);
    audioControl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleAmbientAudio();
        }
    });
}

window.addEventListener('resize', onResize);

// ============================================
// ANIMATION LOOP
// ============================================
let frameCount = 0;
let lastFpsTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const time = state.clock.getElapsedTime();
    const delta = state.clock.getDelta();

    // FPS counter
    frameCount++;
    const fpsNow = performance.now();
    if (fpsNow - lastFpsTime >= 500) {
        const fps = Math.round(frameCount / ((fpsNow - lastFpsTime) / 1000));
        const fpsEl = document.getElementById('hud-fps');
        if (fpsEl) fpsEl.textContent = fps + ' FPS';
        frameCount = 0;
        lastFpsTime = fpsNow;
    }

    // --- Update particles ---
    particles.material.uniforms.uTime.value = time;
    particles.rotation.y = time * 0.01;

    // --- Update grid ---
    const gridMesh = grid.children[0];
    if (gridMesh) gridMesh.material.uniforms.uTime.value = time;

    // --- Chromatic aberration ---
    chromaPass.uniforms.uTime.value = time;

    // --- Node orbits ---
    const t1 = time * ORBIT_SPEEDS.intelica;
    nodes.intelica.position.set(
        ORBIT_RADII.intelica * Math.cos(t1) * Math.cos(0.3),
        1.5 + Math.sin(t1 * 1.3) * 0.5,
        ORBIT_RADII.intelica * Math.sin(t1) + Math.sin(0.1) * 2
    );

    const t2 = time * ORBIT_SPEEDS.education + Math.PI * 0.7;
    nodes.education.position.set(
        ORBIT_RADII.education * Math.cos(t2) * Math.cos(-0.2),
        2 + Math.sin(t2 * 0.8) * 0.8,
        ORBIT_RADII.education * Math.sin(t2) * Math.cos(-0.15)
    );

    const t3 = time * ORBIT_SPEEDS.innovation + Math.PI * 1.3;
    nodes.innovation.position.set(
        ORBIT_RADII.innovation * Math.cos(t3) * Math.cos(0.15),
        -2 + Math.sin(t3 * 0.9) * 0.6,
        ORBIT_RADII.innovation * Math.sin(t3) * Math.cos(0.2)
    );

    // --- Node rotations ---
    nodes.core.children[0].rotation.y = time * 0.15;
    nodes.core.children[0].rotation.x = time * 0.1;
    nodes.core.children[1].rotation.y = -time * 0.2;
    nodes.core.children[2].rotation.y = time * 0.3;
    nodes.core.children[2].rotation.x = time * 0.2;

    // Intelica cube rotation
    nodes.intelica.children[0].rotation.y = time * 0.12;
    nodes.intelica.children[0].rotation.x = time * 0.08;

    // Education neural network wobble
    nodes.education.rotation.y = time * 0.1;

    // Innovation ring rotation
    nodes.innovation.children[0].rotation.x = Math.PI / 2 + time * 0.2;
    nodes.innovation.children[0].rotation.z = time * 0.15;
    nodes.innovation.children[1].rotation.y = time * 0.3;

    // --- Update connection lines ---
    connectionLines.forEach(({ line, fromKey, toKey }) => {
        const posAttr = line.geometry.getAttribute('position');
        const from = nodes[fromKey].position;
        const to = nodes[toKey].position;
        posAttr.array[0] = from.x;
        posAttr.array[1] = from.y;
        posAttr.array[2] = from.z;
        posAttr.array[3] = to.x;
        posAttr.array[4] = to.y;
        posAttr.array[5] = to.z;
        posAttr.needsUpdate = true;
    });

    // --- Raycasting for hover ---
    if (state.introComplete && !state.isTransitioning && !state.isDragging) {
        state.raycaster.setFromCamera(state.mouseNorm, camera);
        const intersects = state.raycaster.intersectObjects(clickableObjects);
        const crosshair = document.getElementById('crosshair');

        if (intersects.length > 0) {
            const key = intersects[0].object.userData.nodeKey;
            if (state.hoveredNode !== key) {
                state.hoveredNode = key;
                document.body.style.cursor = 'none';
                crosshair.classList.remove('hidden');
                crosshair.classList.add('visible');
            }
            // Scale up hovered node
            const node = nodes[key];
            const targetScale = 1.1;
            node.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
        } else {
            if (state.hoveredNode) {
                state.hoveredNode = null;
                document.body.style.cursor = 'default';
                crosshair.classList.add('hidden');
                crosshair.classList.remove('visible');
            }
        }

        // Scale down non-hovered nodes
        Object.entries(nodes).forEach(([key, node]) => {
            if (key !== state.hoveredNode) {
                node.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
            }
        });
    }

    // --- Camera orbit when not focused ---
    if (state.autoOrbit && state.introComplete && !state.isTransitioning && !state.activeNode) {
        state.spherical.theta += 0.002;
    }

    // Apply drag deltas
    if (!state.activeNode && !state.isTransitioning && state.introComplete) {
        state.spherical.theta += state.sphericalDelta.theta;
        state.spherical.phi += state.sphericalDelta.phi;

        // Clamp phi
        state.spherical.phi = Math.max(0.3, Math.min(Math.PI - 0.3, state.spherical.phi));

        // Damping
        state.sphericalDelta.theta *= 0.92;
        state.sphericalDelta.phi *= 0.92;

        // Convert spherical to cartesian
        const radius = 16;
        const targetX = radius * Math.sin(state.spherical.phi) * Math.sin(state.spherical.theta);
        const targetY = radius * Math.cos(state.spherical.phi);
        const targetZ = radius * Math.sin(state.spherical.phi) * Math.cos(state.spherical.theta);

        camera.position.x += (targetX - camera.position.x) * 0.05;
        camera.position.y += (targetY - camera.position.y) * 0.05;
        camera.position.z += (targetZ - camera.position.z) * 0.05;

        // Subtle mouse parallax
        camera.position.x += state.mouseNorm.x * 0.15;
        camera.position.y += state.mouseNorm.y * 0.1;

        camera.lookAt(state.cameraTarget);
    }

    // --- Pulse wave for core ---
    const pulseScale = 1 + Math.sin(time * 2) * 0.02;
    nodes.core.children[0].scale.set(pulseScale, pulseScale, pulseScale);

    // --- Point lights movement ---
    pointLight1.position.x = 5 + Math.sin(time * 0.3) * 3;
    pointLight1.position.z = 5 + Math.cos(time * 0.3) * 3;
    pointLight2.position.y = -3 + Math.sin(time * 0.2) * 2;

    // --- Render ---
    composer.render();
}

// ============================================
// LOADING & START
// ============================================
const loadingScreen = document.getElementById('loading-screen');
const hudOverlay = document.getElementById('hud-overlay');
const navDots = document.getElementById('nav-dots');
const progressEl = document.getElementById('load-progress');

// Simulate loading
let loadProgress = 0;
const loadInterval = setInterval(() => {
    loadProgress += Math.random() * 15 + 5;
    if (loadProgress >= 100) {
        loadProgress = 100;
        clearInterval(loadInterval);
        setTimeout(() => {
            loadingScreen.classList.add('fade-out');
            hudOverlay.classList.add('visible');
            navDots.classList.add('visible');
            playIntroCinematic();
        }, 400);
    }
    if (progressEl) progressEl.textContent = Math.round(loadProgress) + '%';
}, 200);

// Start render loop
animate();
