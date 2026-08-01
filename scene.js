/* ============================================
   ANIBAL SANTA CRUZ — 3D PORTFOLIO SCENE
   Three.js Interactive Constellation
   ============================================ */

import * as THREE from './vendor/three/build/three.module.js';
import { EffectComposer } from './vendor/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './vendor/three/examples/jsm/postprocessing/ShaderPass.js';

// ============================================
// CONSTANTS & CONFIG
// ============================================
const COLORS = {
    bg: 0x0A0F1D,
    cyan: 0x00F0FF,
    orange: 0xFF5F16,
    purple: 0xB486FF,
    silver: 0xC0D0E0,
    gold: 0xFFD700,
    white: 0xffffff,
};

const isTouchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
const isMobileDevice = () => {
    return isTouchCapable || /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent) || window.innerWidth <= 900;
};

let isMobile = isMobileDevice();
const defaultCameraDistance = isMobile ? 18 : 16;

const NODE_CONFIG = {
    core: { position: new THREE.Vector3(0, 0, 0), color: COLORS.cyan, panelId: 'panel-core' },
    intelica: { position: new THREE.Vector3(5, 1.5, 2), color: COLORS.orange, panelId: 'panel-intelica' },
    education: { position: new THREE.Vector3(-4, 2, -4), color: COLORS.purple, panelId: 'panel-education' },
    innovation: { position: new THREE.Vector3(3, -2, -5), color: COLORS.gold, panelId: 'panel-innovation' },
};

const ORBIT_RADII = { intelica: 6, education: 7, innovation: 8 };
const ORBIT_SPEEDS = { intelica: 0.08, education: 0.06, innovation: 0.05 };
const ORBIT_HIGHLIGHT = {
    default: 0.42,
    hover: 0.68,
    active: 0.92,
};

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
    cameraPosition: new THREE.Vector3(0, 2, defaultCameraDistance),
    defaultCamPos: new THREE.Vector3(0, 2, defaultCameraDistance),
    defaultCamTarget: new THREE.Vector3(0, 0, 0),
    cameraDistance: defaultCameraDistance,
    orbitAngle: 0,
    autoOrbit: true,
    isDragging: false,
    dragStart: new THREE.Vector2(),
    dragDistance: 0,
    dragVelocity: new THREE.Vector2(),
    sphericalDelta: { theta: 0, phi: 0 },
    spherical: { theta: 0, phi: Math.PI / 2.3 },
    nodeSpherical: { theta: 0, phi: Math.PI / 2.3 },
    nodeDistance: 4.5,
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
        // Default to ON for first-time visitors (no key stored yet)
        if (value === null) {
            audioState.persistedEnabled = true;
        } else {
            audioState.persistedEnabled = value === 'true';
        }
    } catch (error) {
        audioState.persistedEnabled = true;
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
const crosshairEl = document.getElementById('crosshair');
const fallbackOverlay = document.getElementById('webgl-fallback');

function showWebGLFallback() {
    if (container) container.style.display = 'none';
    if (fallbackOverlay) {
        fallbackOverlay.classList.remove('hidden');
        fallbackOverlay.classList.add('visible');
    }
    console.warn('WebGL is not available on this device.');
}

let renderer = null;
let scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);
scene.fog = new THREE.FogExp2(COLORS.bg, 0.018);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.copy(state.cameraPosition);

try {
    renderer = new THREE.WebGLRenderer({
        antialias: !isMobile,
        alpha: false,
    });
    renderer.setPixelRatio(Math.max(1, Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 2)));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    if (container) {
        container.style.display = 'block';
        container.appendChild(renderer.domElement);
    }
} catch (error) {
    renderer = null;
    showWebGLFallback();
    console.error('Failed to initialize WebGL renderer:', error);
}

if (!renderer) {
    throw new Error('WebGL renderer initialization failed');
}

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

const usePostProcessing = !isMobile;
let composer = null;
let bloomPass = null;
let chromaPass = null;

// ============================================
// POST-PROCESSING
// ============================================
if (usePostProcessing) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        isMobile ? 0.35 : 0.8,
        0.4,
        0.85
    );
    composer.addPass(bloomPass);

    chromaPass = new ShaderPass(ChromaticAberrationShader);
    chromaPass.uniforms.uIntensity.value = isMobile ? 0.001 : 0.002;
    composer.addPass(chromaPass);
}

function applyDevicePerformanceSettings() {
    isMobile = isMobileDevice();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));
    if (usePostProcessing && bloomPass && chromaPass) {
        bloomPass.strength = isMobile ? 0.35 : 0.8;
        bloomPass.enabled = !isMobile;
        chromaPass.uniforms.uIntensity.value = isMobile ? 0.001 : 0.002;
        chromaPass.enabled = !isMobile;
    }
    if (renderer.domElement) {
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
    }
}
applyDevicePerformanceSettings();

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
    const count = isMobile ? 500 : 2000;
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
const orbitRings = {};

function createOrbitRing(key, radius, color, tiltX = 0, tiltZ = 0) {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
    const points = curve.getPoints(128);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: ORBIT_HIGHLIGHT.default,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const ring = new THREE.Line(geometry, material);
    ring.rotation.x = Math.PI / 2 + tiltX;
    ring.rotation.z = tiltZ;
    orbitRings[key] = ring;
    return ring;
}

scene.add(createOrbitRing('intelica', ORBIT_RADII.intelica, COLORS.orange, 0.3, 0.1));
scene.add(createOrbitRing('education', ORBIT_RADII.education, COLORS.purple, -0.2, -0.15));
scene.add(createOrbitRing('innovation', ORBIT_RADII.innovation, COLORS.gold, 0.15, 0.2));

// ============================================
// CONNECTION LINES between nodes
// ============================================
const connectionLines = [];
function createConnectionLine(fromKey, toKey) {
    const material = new THREE.LineBasicMaterial({
        color: COLORS.orange,
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

function boostNodeGlow(group, color, intensity) {
    group.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((material) => {
            if (material.isMeshStandardMaterial) {
                material.emissive = new THREE.Color(color);
                material.emissiveIntensity = intensity;
            }
            if (material.isMeshBasicMaterial && material.color) {
                material.opacity = Math.min(1, material.opacity + 0.05);
            }
        });
    });
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

    const orbitRing1 = new THREE.Mesh(
        new THREE.TorusGeometry(1.7, 0.008, 8, 64),
        new THREE.MeshBasicMaterial({
            color: COLORS.cyan,
            transparent: true,
            opacity: 0.24,
            depthWrite: false,
        })
    );
    orbitRing1.rotation.x = Math.PI / 2;
    group.add(orbitRing1);

    const orbitRing2 = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.006, 8, 64),
        new THREE.MeshBasicMaterial({
            color: COLORS.cyan,
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
        })
    );
    orbitRing2.rotation.y = Math.PI / 2;
    group.add(orbitRing2);

    boostNodeGlow(group, COLORS.cyan, 1.25);

    // Label
    const label = createLabel('CORE', COLORS.cyan);
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

// --- Node 2: Intelica ---
function createIntelicaNode() {
    const group = new THREE.Group();
    group.userData = { key: 'intelica', baseScale: 1 };

    // ── Core globe — softer warm burnt-orange ──
    const planetMat = new THREE.MeshStandardMaterial({
        color: 0xA84820,
        emissive: 0x4A1A06,
        emissiveIntensity: 0.25,
        metalness: 0.70,
        roughness: 0.42,
        transparent: true,
        opacity: 0.97,
    });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(1.05, isMobile ? 32 : 64, isMobile ? 32 : 64), planetMat);
    group.add(planet);

    // ── Tech wireframe icosahedron overlay ──
    const icoWireMat = new THREE.MeshBasicMaterial({
        color: 0xFFAA66,
        wireframe: true,
        transparent: true,
        opacity: 0.18,
    });
    const icoWire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.07, 2), icoWireMat);
    group.add(icoWire);

    // ── Outer tech shell ──
    const outerShell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.14, 3),
        new THREE.MeshBasicMaterial({ color: 0xFF8844, wireframe: true, transparent: true, opacity: 0.07 })
    );
    group.add(outerShell);

    // ── Atmosphere halo ──
    const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.22, 64, 64),
        new THREE.MeshBasicMaterial({ color: 0xD06030, transparent: true, opacity: 0.06, side: THREE.BackSide })
    );
    group.add(atmosphere);

    // ── Latitude data rings ──
    const latRingMat = new THREE.LineBasicMaterial({
        color: 0xFFCC88, transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    [-0.45, 0, 0.45].forEach((yOffset) => {
        const r = Math.sqrt(1.08 * 1.08 - yOffset * yOffset);
        const pts = [];
        for (let i = 0; i <= 64; i++) {
            const a = (i / 64) * Math.PI * 2;
            pts.push(new THREE.Vector3(r * Math.cos(a), yOffset, r * Math.sin(a)));
        }
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), latRingMat));
    });

    // ── Meridian lines ──
    const meridianMat = new THREE.LineBasicMaterial({
        color: 0xFF9955, transparent: true, opacity: 0.15,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (let m = 0; m < 6; m++) {
        const angle = (m / 6) * Math.PI;
        const mPts = [];
        for (let i = 0; i <= 48; i++) {
            const phi = (i / 48) * Math.PI;
            mPts.push(new THREE.Vector3(
                1.08 * Math.sin(phi) * Math.cos(angle),
                1.08 * Math.cos(phi),
                1.08 * Math.sin(phi) * Math.sin(angle)
            ));
        }
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(mPts), meridianMat));
    }

    // ── Orbital data rings ──
    const ringPts = Array.from({ length: 129 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    });
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);

    const dataRing1 = new THREE.Line(ringGeo,
        new THREE.LineBasicMaterial({ color: 0xFFAA55, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    dataRing1.scale.setScalar(1.38);
    dataRing1.rotation.x = Math.PI / 2.3;
    dataRing1.rotation.z = 0.4;
    group.add(dataRing1);

    const dataRing2 = new THREE.Line(ringGeo,
        new THREE.LineBasicMaterial({ color: 0xFFAA55, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    dataRing2.scale.setScalar(1.28);
    dataRing2.rotation.x = Math.PI / 2.8;
    dataRing2.rotation.z = -0.9;
    group.add(dataRing2);

    group.userData.icoWire = icoWire;
    group.userData.outerShell = outerShell;
    group.userData.dataRing1 = dataRing1;
    group.userData.dataRing2 = dataRing2;

    // ── Tech arcs ──
    const arcMat = new THREE.LineBasicMaterial({
        color: 0xFFCC99, transparent: true, opacity: 0.40,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const createArc = (radius, tiltX, tiltY, phase, amplitude) => {
        const pts = [];
        for (let i = 0; i <= 96; i++) {
            const t = (i / 96) * Math.PI * 2;
            pts.push(new THREE.Vector3(radius * Math.cos(t), 0.08 * Math.sin(t * 2 + phase) * amplitude, radius * Math.sin(t)));
        }
        const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat);
        arc.rotation.x = tiltX;
        arc.rotation.y = tiltY;
        return arc;
    };
    group.add(createArc(1.32, Math.PI / 2, 0, 0.3, 1));
    group.add(createArc(1.28, Math.PI / 2.5, Math.PI / 5, 1.7, 0.8));
    group.add(createArc(1.24, Math.PI / 2.2, -Math.PI / 8, 3.1, 0.7));

    // ── Surface circuit traces ──
    const circuitMat = new THREE.LineBasicMaterial({
        color: 0xFFDDB0, transparent: true, opacity: 0.38,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const circuitGroup = new THREE.Group();
    [
        { radius: 0.92, offsetY: 0.4, phase: 0.2, loops: 1.7 },
        { radius: 0.84, offsetY: 0.05, phase: 1.6, loops: 1.4 },
        { radius: 0.76, offsetY: -0.25, phase: 2.9, loops: 1.2 },
    ].forEach(({ radius, offsetY, phase, loops }) => {
        const pts = [];
        for (let i = 0; i <= 40; i++) {
            const theta = phase + (i / 40) * loops;
            pts.push(new THREE.Vector3(radius * Math.cos(theta), offsetY + 0.03 * Math.sin(theta * 3), radius * Math.sin(theta)));
        }
        circuitGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), circuitMat));
    });
    [
        [new THREE.Vector3(0.68, 0.18, 0.47), new THREE.Vector3(0.22, 0.02, 0.92)],
        [new THREE.Vector3(-0.73, -0.12, 0.36), new THREE.Vector3(-0.18, 0.26, 0.86)],
        [new THREE.Vector3(0.5, -0.28, -0.71), new THREE.Vector3(0.14, -0.08, -0.95)],
    ].forEach(([start, end]) => {
        circuitGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), circuitMat));
    });
    group.add(circuitGroup);

    // ── Data node spheres at key positions ──
    const dnGeo = new THREE.SphereGeometry(0.055, 10, 10);
    const dnMat = new THREE.MeshStandardMaterial({
        color: 0xFFCC88, emissive: 0xFF8833, emissiveIntensity: 0.7,
        metalness: 0.6, roughness: 0.15,
    });
    [
        new THREE.Vector3(1.08, 0, 0),
        new THREE.Vector3(-1.08, 0, 0),
        new THREE.Vector3(0, 1.08, 0),
        new THREE.Vector3(0, -1.08, 0),
        new THREE.Vector3(0.76, 0.76, 0),
        new THREE.Vector3(-0.76, 0, 0.76),
        new THREE.Vector3(0.54, -0.54, -0.76),
    ].forEach((pos) => {
        const dn = new THREE.Mesh(dnGeo, dnMat);
        dn.position.copy(pos);
        group.add(dn);
    });

    // ── Equatorial bands ──
    const bandMat = new THREE.MeshBasicMaterial({ color: 0xFF9955, transparent: true, opacity: 0.12 });
    const band1 = new THREE.Mesh(new THREE.TorusGeometry(1.105, 0.055, 8, 120), bandMat);
    band1.rotation.x = Math.PI / 2;
    group.add(band1);
    const band2 = band1.clone();
    band2.rotation.z = Math.PI / 4;
    group.add(band2);

    // ── Glow & label ──
    group.add(createGlowSprite(0xA84820, 2.8));
    boostNodeGlow(group, 0xA84820, 0.85);

    const label = createLabel('INTELICA', 0xD06028);
    label.position.y = 1.85;
    group.add(label);

    // ── Hitbox ──
    const hitbox = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 8, 8),
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
    const neuronCount = isMobile ? 18 : 30;
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
    boostNodeGlow(group, COLORS.purple, 1.15);

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
    boostNodeGlow(group, COLORS.gold, 1.2);

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
    const width = 164;
    const height = 58;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const bgR = Math.floor((color >> 16) * 0.65);
    const bgG = Math.floor(((color >> 8) & 255) * 0.65);
    const bgB = Math.floor((color & 255) * 0.65);
    ctx.fillStyle = `rgba(${bgR}, ${bgG}, ${bgB}, 0.82)`;
    const radius = 14;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(width - radius, 0);
    ctx.quadraticCurveTo(width, 0, width, radius);
    ctx.lineTo(width, height - radius);
    ctx.quadraticCurveTo(width, height, width - radius, height);
    ctx.lineTo(radius, height);
    ctx.quadraticCurveTo(0, height, 0, height - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();

    ctx.font = '700 18px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        toneMapped: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.23, 0.51, 1);
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

function unlockAudioContext(ctx) {
    if (!ctx) return;
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
    } catch (e) {
        // Fallback for devices not supporting silent buffer source
    }
}

function createAmbientSound() {
    if (audioState.started) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    unlockAudioContext(ctx);
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);

    // Warm Low-pass Filter for cosmic ambient music
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 550;
    filter.Q.value = 1.0;

    // Filter modulation LFO (gentle breathing effect)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07; // ~14s slow cycle
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    filter.connect(masterGain);

    // Calming chord progression frequencies (Cmaj9 -> Am9 -> Fmaj7 -> G6/9)
    const chords = [
        [130.81, 164.81, 196.00, 246.94, 293.66], // Cmaj9
        [110.00, 164.81, 196.00, 261.63, 329.63], // Am9
        [87.31,  130.81, 164.81, 220.00, 261.63], // Fmaj7
        [98.00,  146.83, 196.00, 246.94, 329.63]  // G6/9
    ];

    let currentChordIndex = 0;

    function playNextChord() {
        if (!audioState.enabled || !ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        const now = ctx.currentTime;
        const duration = 6.5; // seconds per chord
        const chordFreqs = chords[currentChordIndex];

        chordFreqs.forEach((freq, idx) => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const noteGain = ctx.createGain();

            osc1.type = 'sine';
            osc2.type = 'triangle';
            osc1.frequency.value = freq;
            osc2.frequency.value = freq * 1.0025; // Soft detune warmth

            noteGain.gain.setValueAtTime(0, now);
            const peakGain = (0.052 - idx * 0.007);
            noteGain.gain.linearRampToValueAtTime(peakGain, now + 2.2);
            noteGain.gain.setValueAtTime(peakGain, now + 4.2);
            noteGain.gain.linearRampToValueAtTime(0, now + duration);

            osc1.connect(noteGain);
            osc2.connect(noteGain);
            noteGain.connect(filter);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + duration + 0.1);
            osc2.stop(now + duration + 0.1);
        });

        currentChordIndex = (currentChordIndex + 1) % chords.length;
    }

    // Soft starry chime melody (Pentatonic notes)
    const chimes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    function playStarChime() {
        if (!audioState.enabled || !ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        const now = ctx.currentTime;
        const freq = chimes[Math.floor(Math.random() * chimes.length)];
        const osc = ctx.createOscillator();
        const chimeGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        chimeGain.gain.setValueAtTime(0, now);
        chimeGain.gain.linearRampToValueAtTime(0.024, now + 0.15);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

        osc.connect(chimeGain);
        chimeGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 2.9);
    }

    const chordInterval = setInterval(playNextChord, 5500);
    const chimeInterval = setInterval(() => {
        if (Math.random() > 0.35) playStarChime();
    }, 3000);

    audioState.started = true;
    audioState.enabled = false;
    audioState.context = ctx;
    audioState.masterGain = masterGain;
    audioState.chordInterval = chordInterval;
    audioState.chimeInterval = chimeInterval;
    audioState.playNextChord = playNextChord;
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

    unlockAudioContext(audioState.context);
    const now = audioState.context.currentTime;
    audioState.masterGain.gain.cancelScheduledValues(now);

    if (!audioState.enabled) {
        audioState.enabled = true;
        audioState.masterGain.gain.setValueAtTime(audioState.masterGain.gain.value || 0, now);
        audioState.masterGain.gain.linearRampToValueAtTime(0.638, now + 1.5);
        if (audioState.playNextChord) audioState.playNextChord();
    } else {
        audioState.enabled = false;
        audioState.masterGain.gain.setValueAtTime(audioState.masterGain.gain.value || 0.638, now);
        audioState.masterGain.gain.linearRampToValueAtTime(0, now + 1.2);
    }

    setAudioControlState(audioState.enabled);
    saveAudioPreference();
}

function activateAmbientAudio() {
    if (!audioState.started && audioState.persistedEnabled) {
        toggleAmbientAudio();
    } else if (audioState.started && audioState.enabled && audioState.context) {
        if (audioState.context.state === 'suspended') {
            unlockAudioContext(audioState.context);
        }
    }
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
    const duration = 600;
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

            // Calculate spherical angles relative to selected node for centered 3D orbit
            const nodePos = nodes[key].position;
            const offset = camera.position.clone().sub(nodePos);
            const radius = Math.max(2, offset.length());
            state.nodeDistance = radius;
            state.nodeSpherical.phi = Math.max(0.15, Math.min(Math.PI - 0.15, Math.acos(Math.max(-1, Math.min(1, offset.y / radius)))));
            state.nodeSpherical.theta = Math.atan2(offset.x, offset.z);

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
        dot.classList.toggle('active', key === activeKey);
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
    if (crosshairEl) {
        crosshairEl.style.left = e.clientX + 'px';
        crosshairEl.style.top = e.clientY + 'px';
    }

    // Drag orbit (full 2D: horizontal + vertical)
    if (state.isDragging && state.introComplete) {
        const deltaX = e.clientX - state.dragStart.x;
        const deltaY = e.clientY - state.dragStart.y;
        state.dragDistance += Math.abs(deltaX) + Math.abs(deltaY);
        const sensitivity = isMobile ? 0.038 : 0.050;
        const inertiaFactor = isMobile ? 0.025 : 0.035;
        state.sphericalDelta.theta = -deltaX * sensitivity;
        state.sphericalDelta.phi = deltaY * sensitivity;
        state.dragVelocity.set(-deltaX * inertiaFactor, deltaY * inertiaFactor);
        state.dragStart.set(e.clientX, e.clientY);
        state.autoOrbit = false;
    }
}

function onMouseDown(e) {
    if (e.button !== 0) return;

    // Don't activate drag when clicking on interactive elements or inside panels
    const target = e.target;
    if (target.closest('button, a, .btn-back, .action-btn, .hud-button, .nav-dot, #audio-control, .detail-panel')) return;

    activateAmbientAudio();
    state.isDragging = true;
    state.dragStart.set(e.clientX, e.clientY);
    state.dragDistance = 0;
}

function onMouseUp() {
    if (state.isDragging) {
        state.isDragging = false;

        // Restore cursor
        document.body.style.cursor = state.hoveredNode ? 'none' : 'default';
    }
}

function onClick(e) {
    if (!state.introComplete || state.isTransitioning) return;

    // Ignorar click si fue un drag (movimiento mayor a 10px)
    if (state.dragDistance > 10) return;

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

        // Don't start drag if touching inside a detail panel (allow native scroll)
        const touchTarget = document.elementFromPoint(touch.clientX, touch.clientY);
        if (touchTarget && touchTarget.closest('.detail-panel')) {
            state.isDragging = false;
            state._touchInsidePanel = true;
            // Still record coords for tap detection on node hitboxes
            state.mouseNorm.x = (touch.clientX / window.innerWidth) * 2 - 1;
            state.mouseNorm.y = -(touch.clientY / window.innerHeight) * 2 + 1;
            state.dragDistance = 0;
            state.dragStart.set(touch.clientX, touch.clientY);
            return;
        }

        state._touchInsidePanel = false;
        state.mouseNorm.x = (touch.clientX / window.innerWidth) * 2 - 1;
        state.mouseNorm.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        state.isDragging = true;
        state.dragDistance = 0;
        state.dragStart.set(touch.clientX, touch.clientY);
    }
}

function onTouchMove(e) {
    // If touching inside a panel, let the browser handle scroll natively
    if (state._touchInsidePanel) return;

    if (e.touches.length === 1 && state.isDragging) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - state.dragStart.x;
        const deltaY = touch.clientY - state.dragStart.y;
        state.dragDistance += Math.abs(deltaX) + Math.abs(deltaY);
        const sensitivity = isMobile ? 0.038 : 0.050;
        const inertiaFactor = isMobile ? 0.025 : 0.035;
        state.sphericalDelta.theta = -deltaX * sensitivity;
        state.sphericalDelta.phi = deltaY * sensitivity;
        state.dragVelocity.set(-deltaX * inertiaFactor, deltaY * inertiaFactor);
        state.dragStart.set(touch.clientX, touch.clientY);
        state.autoOrbit = false;
    }
}

function onTouchEnd(e) {
    const wasInsidePanel = state._touchInsidePanel;
    state._touchInsidePanel = false;
    state.isDragging = false;

    // If touch was inside a panel, don't try to navigate nodes
    if (wasInsidePanel) return;

    // Only treat as tap if drag distance was small
    if (state.dragDistance > 10) return;

    // Simple tap detection for click
    if (!state.isTransitioning && state.introComplete) {
        state.raycaster.setFromCamera(state.mouseNorm, camera);
        const intersects = state.raycaster.intersectObjects(clickableObjects);
        if (intersects.length > 0) {
            transitionToNode(intersects[0].object.userData.nodeKey);
        }
    }
}

function onMouseWheel(e) {
    // Allow native scroll inside panel-body sections
    const panelBody = e.target.closest('.panel-body');
    if (panelBody) {
        // Don't prevent default — let the browser scroll the panel naturally
        return;
    }

    e.preventDefault();
    if (!state.introComplete || state.isTransitioning) return;

    // Zoom with mouse wheel
    const zoomSpeed = 0.5;
    const zoomDelta = e.deltaY > 0 ? 1 : -1;
    if (state.activeNode) {
        state.nodeDistance = Math.max(2.5, Math.min(12, state.nodeDistance + zoomDelta * zoomSpeed));
    } else {
        state.cameraDistance = Math.max(5, Math.min(40, state.cameraDistance + zoomDelta * zoomSpeed));
    }
}

window.addEventListener('mousemove', onMouseMove, { passive: true });
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);
window.addEventListener('click', onClick);
window.addEventListener('touchstart', onTouchStart, { passive: true });
window.addEventListener('touchmove', onTouchMove, { passive: true });
window.addEventListener('touchend', onTouchEnd);
window.addEventListener('wheel', onMouseWheel, { passive: false });

// Nav dots
document.querySelectorAll('.nav-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        const key = dot.dataset.node;
        if (state.activeNode === key) return;
        transitionToNode(key);
    });
});

updateNavDots(state.activeNode);

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
        ctx.strokeStyle = 'rgba(238, 244, 255, 1)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Spokes
    for (let i = 0; i < n; i++) {
        const a = i * angleStep - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
        ctx.strokeStyle = 'rgba(238, 244, 255, 1)';
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
    ctx.fillStyle = 'rgba(238, 244, 255, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(238, 244, 255, 1)';
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
        ctx.fillStyle = '#eef4ff';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(238, 244, 255, 1)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Labels
    ctx.font = '500 10px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(238, 244, 255, 1)';

    for (let i = 0; i < n; i++) {
        const a = i * angleStep - Math.PI / 2;
        const lr = radius + 20;
        const x = cx + lr * Math.cos(a);
        const y = cy + lr * Math.sin(a);
        ctx.fillText(labels[i], x, y);
    }
}

// ============================================
// RESIZE
// ============================================
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    if (renderer) {
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
    if (bloomPass) {
        bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    }
    applyDevicePerformanceSettings();
}
loadAudioPreference();

const audioControl = document.getElementById('audio-control');
if (audioControl) {
    if (audioState.persistedEnabled) {
        audioControl.classList.add('active');
        audioControl.textContent = 'DISABLE AMBIENCE';
    } else {
        audioControl.textContent = 'ENABLE AMBIENCE';
    }

    const handleToggle = (e) => {
        if (e && e.cancelable) e.preventDefault();
        toggleAmbientAudio();
    };

    audioControl.addEventListener('click', handleToggle);
    audioControl.addEventListener('touchend', handleToggle);
    audioControl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleAmbientAudio();
        }
    });
}

// Auto-start audio on first user interaction (required by browser autoplay policy)
function autoStartAudioOnInteraction() {
    activateAmbientAudio();
}
window.addEventListener('click', autoStartAudioOnInteraction, { passive: true });
window.addEventListener('touchstart', autoStartAudioOnInteraction, { passive: true });
window.addEventListener('touchend', autoStartAudioOnInteraction, { passive: true });
window.addEventListener('keydown', autoStartAudioOnInteraction, { passive: true });

window.addEventListener('resize', onResize);

// ============================================
// ANIMATION LOOP
// ============================================

// Reusable static vectors to avoid GC pauses in frame loop
const _vecTargetPos = new THREE.Vector3();
const _vecHoverScale = new THREE.Vector3();
const _vecNormalScale = new THREE.Vector3(1, 1, 1);
const _vecRingScale = new THREE.Vector3();

function animate() {
    requestAnimationFrame(animate);

    const time = state.clock.getElapsedTime();
    const delta = state.clock.getDelta();

    // --- Update particles ---
    particles.material.uniforms.uTime.value = time;
    particles.rotation.y = time * 0.01;

    // --- Update grid ---
    const gridMesh = grid.children[0];
    if (gridMesh) gridMesh.material.uniforms.uTime.value = time;

    // --- Chromatic aberration ---
    chromaPass.uniforms.uTime.value = time;

    // --- Node orbits ---
    const t1 = time * ORBIT_SPEEDS.intelica + state.orbitAngle;
    nodes.intelica.position.set(
        ORBIT_RADII.intelica * Math.cos(t1) * Math.cos(0.3),
        1.5 + Math.sin(t1 * 1.3) * 0.5,
        ORBIT_RADII.intelica * Math.sin(t1) + Math.sin(0.1) * 2
    );

    const t2 = time * ORBIT_SPEEDS.education + Math.PI * 0.7 + state.orbitAngle;
    nodes.education.position.set(
        ORBIT_RADII.education * Math.cos(t2) * Math.cos(-0.2),
        2 + Math.sin(t2 * 0.8) * 0.8,
        ORBIT_RADII.education * Math.sin(t2) * Math.cos(-0.15)
    );

    const t3 = time * ORBIT_SPEEDS.innovation + Math.PI * 1.3 + state.orbitAngle;
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
    nodes.core.rotation.y = time * 0.08;
    nodes.core.rotation.x = Math.sin(time * 0.12) * 0.1;
    if (nodes.core.children[4]) nodes.core.children[4].rotation.z = time * 0.25;
    if (nodes.core.children[5]) nodes.core.children[5].rotation.x = time * 0.18;

    // Intelica cube rotation
    nodes.intelica.children[0].rotation.y = time * 0.12;
    nodes.intelica.children[0].rotation.x = time * 0.08;
    nodes.intelica.rotation.y = t1 * 0.75 + time * 0.12;
    nodes.intelica.rotation.x = Math.sin(t1 * 0.6) * 0.18;
    nodes.intelica.rotation.z = Math.cos(t1 * 0.5) * 0.12;

    // Education neural network wobble
    nodes.education.rotation.y = t2 * 0.7 + time * 0.1;
    nodes.education.rotation.x = Math.sin(t2 * 0.45) * 0.16;

    // Innovation ring rotation
    nodes.innovation.children[0].rotation.x = Math.PI / 2 + time * 0.2;
    nodes.innovation.children[0].rotation.z = time * 0.15;
    nodes.innovation.children[1].rotation.y = time * 0.3;
    nodes.innovation.rotation.y = t3 * 0.65 + time * 0.08;
    nodes.innovation.rotation.z = Math.sin(t3 * 0.5) * 0.15;

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

        if (intersects.length > 0) {
            const key = intersects[0].object.userData.nodeKey;
            if (state.hoveredNode !== key) {
                state.hoveredNode = key;
                document.body.style.cursor = 'none';
                if (crosshairEl) {
                    crosshairEl.classList.remove('hidden');
                    crosshairEl.classList.add('visible');
                }
            }
            // Scale up hovered node
            const node = nodes[key];
            const targetScale = 1.1;
            _vecHoverScale.set(targetScale, targetScale, targetScale);
            node.scale.lerp(_vecHoverScale, 0.12);
        } else {
            if (state.hoveredNode) {
                state.hoveredNode = null;
                document.body.style.cursor = 'default';
                if (crosshairEl) {
                    crosshairEl.classList.add('hidden');
                    crosshairEl.classList.remove('visible');
                }
            }
        }

        // Scale down non-hovered nodes
        Object.entries(nodes).forEach(([key, node]) => {
            if (key !== state.hoveredNode) {
                node.scale.lerp(_vecNormalScale, 0.1);
            }
        });
    }

    // --- Follow active node orbit ---
    if (state.activeNode && !state.isTransitioning) {
        const pivotCenter = nodes[state.activeNode].position;
        const radius = state.nodeDistance;
        const targetX = pivotCenter.x + radius * Math.sin(state.nodeSpherical.phi) * Math.sin(state.nodeSpherical.theta);
        const targetY = pivotCenter.y + radius * Math.cos(state.nodeSpherical.phi);
        const targetZ = pivotCenter.z + radius * Math.sin(state.nodeSpherical.phi) * Math.cos(state.nodeSpherical.theta);

        _vecTargetPos.set(targetX, targetY, targetZ);
        camera.position.lerp(_vecTargetPos, 0.12);
        state.cameraTarget.lerp(pivotCenter, 0.12);
        camera.lookAt(state.cameraTarget);
    }

    // --- Orbit highlighting ---
    Object.entries(orbitRings).forEach(([key, ring]) => {
        let targetOpacity = ORBIT_HIGHLIGHT.default;
        if (state.activeNode === key) targetOpacity = ORBIT_HIGHLIGHT.active;
        else if (state.hoveredNode === key) targetOpacity = ORBIT_HIGHLIGHT.hover;
        ring.material.opacity += (targetOpacity - ring.material.opacity) * 0.22;
        const s = targetOpacity === ORBIT_HIGHLIGHT.active ? 1.04 : 1.015;
        _vecRingScale.set(s, 1.015, 1.015);
        ring.scale.lerp(_vecRingScale, 0.1);
    });

    // --- Camera orbit when not focused ---
    if (state.autoOrbit && state.introComplete && !state.isTransitioning && !state.activeNode) {
        state.spherical.theta += 0.002;
    }

    // Apply drag deltas
    if (!state.isTransitioning && state.introComplete) {
        if (state.activeNode) {
            // When a node is active, dragging orbits spherical around that node
            state.nodeSpherical.theta += state.sphericalDelta.theta + state.dragVelocity.x * 1.2;
            state.nodeSpherical.phi += state.sphericalDelta.phi + state.dragVelocity.y * 1.2;

            // Clamp phi to avoid flipping camera at poles
            state.nodeSpherical.phi = Math.max(0.15, Math.min(Math.PI - 0.15, state.nodeSpherical.phi));

            // Damping and momentum
            state.sphericalDelta.theta *= 0.82;
            state.sphericalDelta.phi *= 0.82;
            state.dragVelocity.multiplyScalar(0.78);

            camera.lookAt(state.cameraTarget);
        } else {
            state.spherical.theta += state.sphericalDelta.theta + state.dragVelocity.x * 1.2;
            state.spherical.phi += state.sphericalDelta.phi + state.dragVelocity.y * 1.2;

            // Clamp phi
            state.spherical.phi = Math.max(0.28, Math.min(Math.PI - 0.28, state.spherical.phi));

            // Damping and momentum
            state.sphericalDelta.theta *= 0.82;
            state.sphericalDelta.phi *= 0.82;
            state.dragVelocity.multiplyScalar(0.78);

            // Convert spherical to cartesian with zoom support
            const radius = state.cameraDistance;
            const targetX = radius * Math.sin(state.spherical.phi) * Math.sin(state.spherical.theta);
            const targetY = radius * Math.cos(state.spherical.phi);
            const targetZ = radius * Math.sin(state.spherical.phi) * Math.cos(state.spherical.theta);

            camera.position.x += (targetX - camera.position.x) * 0.12;
            camera.position.y += (targetY - camera.position.y) * 0.12;
            camera.position.z += (targetZ - camera.position.z) * 0.12;
        }

        // Subtle mouse parallax (disabled)
        // camera.position.x += state.mouseNorm.x * 0.24;
        // camera.position.y += state.mouseNorm.y * 0.16;

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
    if (usePostProcessing && composer) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

// ============================================
// LOADING & START
// ============================================
const loadingScreen = document.getElementById('loading-screen');
const hudOverlay = document.getElementById('hud-overlay');
const navDots = document.getElementById('nav-dots');
const progressEl = document.getElementById('load-progress');
const loadingBarFill = document.getElementById('loading-bar-fill');

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
    const progressValue = Math.round(loadProgress);
    if (progressEl) progressEl.textContent = progressValue + '%';
    if (loadingBarFill) loadingBarFill.style.width = `${progressValue}%`;
}, 200);

setTimeout(() => {
    if (loadProgress < 100) {
        loadProgress = 100;
        if (progressEl) progressEl.textContent = '100%';
        if (loadingBarFill) loadingBarFill.style.width = '100%';
        loadingScreen.classList.add('fade-out');
        hudOverlay.classList.add('visible');
        navDots.classList.add('visible');
        playIntroCinematic();
    }
}, 8000);

// Start render loop
animate();
