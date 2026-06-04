import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// 1. Core Scene Setup
const scene = new THREE.Scene();

// Game State Variables
let score = 0;
const totalTargets = 20;

// Dynamic UI Injection for the Score Counter Overlay
const scoreUI = document.createElement('div');
scoreUI.style.position = 'absolute';
scoreUI.style.top = '20px';
scoreUI.style.left = '20px';
scoreUI.style.color = '#ffffff';
scoreUI.style.fontFamily = 'system-ui, -apple-system, sans-serif';
scoreUI.style.fontSize = '22px';
scoreUI.style.fontWeight = 'bold';
scoreUI.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
scoreUI.style.padding = '12px 24px';
scoreUI.style.borderRadius = '10px';
scoreUI.style.border = '1px solid rgba(255, 255, 255, 0.2)';
scoreUI.style.pointerEvents = 'none'; // Ensures mouse clicks pass directly into the 3D canvas
scoreUI.innerText = `Targets Cleared: 0 / ${totalTargets}`;
document.body.appendChild(scoreUI);

// NEW: Dynamic UI Injection for Instruction Text Subtitle
const instructionUI = document.createElement('div');
instructionUI.style.position = 'absolute';
instructionUI.style.top = '75px'; // Positioned cleanly underneath the score tracker
instructionUI.style.left = '20px';
instructionUI.style.color = '#e0e0e0';
instructionUI.style.fontFamily = 'system-ui, -apple-system, sans-serif';
instructionUI.style.fontSize = '14px';
instructionUI.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
instructionUI.style.padding = '8px 16px';
instructionUI.style.borderRadius = '6px';
instructionUI.style.border = '1px solid rgba(255, 255, 255, 0.1)';
instructionUI.style.pointerEvents = 'none';
instructionUI.innerText = 'Click a floating object in the ring to clear it';
document.body.appendChild(instructionUI);

// ==========================================
// CUBEMAP SKYBOX ENVIRONMENT
// ==========================================
const cubeTextureLoader = new THREE.CubeTextureLoader();
const skyboxTexture = cubeTextureLoader
    .setPath('https://threejs.org/manual/examples/resources/images/cubemaps/computer-history-museum/')
    .load([
        'pos-x.jpg', 'neg-x.jpg',
        'pos-y.jpg', 'neg-y.jpg',
        'pos-z.jpg', 'neg-z.jpg'
    ]);
scene.background = skyboxTexture;

// 2. Perspective Camera Configuration
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 6, 11);

// 3. WebGL Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// 4. Camera Controls (OrbitControls)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// ==========================================
// MULTI-SOURCE LIGHTING PIPELINE
// ==========================================
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffaa44, 4.0, 12); 
pointLight.position.set(3, 2, 2); 
scene.add(pointLight);

// ==========================================
// TEXTURES & SHAPE GENERATION
// ==========================================
const textureLoader = new THREE.TextureLoader();
const wallTexture = textureLoader.load('https://threejs.org/manual/examples/resources/images/wall.jpg');

const greenMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.4 });
const texturedMaterial = new THREE.MeshStandardMaterial({ map: wallTexture });
const modelMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.9 });

// Core Exhibition Objects
const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), texturedMaterial);
cube.position.set(-3, 0.5, 0);
scene.add(cube);

const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 32), greenMaterial);
sphere.position.set(-1, 0.6, 0);
scene.add(sphere);

const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 32), greenMaterial);
cylinder.position.set(1, 0.6, 0);
scene.add(cylinder);

// Custom 3D Model Loading (.OBJ)
let customModel;
const objLoader = new OBJLoader();
objLoader.load(
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/models/obj/walt/WaltHead.obj',
    (root) => {
        customModel = root;
        root.traverse((child) => {
            if (child.isMesh) child.material = modelMaterial;
        });
        root.scale.set(0.05, 0.05, 0.05);
        root.position.set(3, 0, 0); 
        scene.add(root);
    }
);

// ==========================================
// INTERACTIVE GAME TARGETS (20 SHAPES)
// ==========================================
const targetsArray = [];
const geometries = [
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.CylinderGeometry(0.2, 0.2, 0.5, 16)
];

// Clean Ring Layout Configuration
const radius = 6; 
for (let i = 0; i < totalTargets; i++) {
    const angle = (i / totalTargets) * Math.PI * 2;
    const targetGeo = geometries[Math.floor(Math.random() * geometries.length)];
    
    // Bright, clean target color properties
    const targetMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(i / totalTargets, 0.85, 0.55),
        metalness: 0.3,
        roughness: 0.2
    });
    
    const targetMesh = new THREE.Mesh(targetGeo, targetMaterial);
    
    // Set positioning cleanly on the tracking boundary ring
    targetMesh.position.set(Math.cos(angle) * radius, 1.5, Math.sin(angle) * radius);
    
    targetMesh.userData = {
        initialY: targetMesh.position.y,
        offset: Math.random() * Math.PI * 2,
        rotSpeed: 0.5 + Math.random() * 1.5
    };
    
    scene.add(targetMesh);
    targetsArray.push(targetMesh);
}

// ==========================================
// RAYCASTING MOUSE INTERACTION ENGINE
// ==========================================
const raycaster = new THREE.Raycaster();
const mouseCoordinates = new THREE.Vector2();

window.addEventListener('click', (event) => {
    // Translate standard mouse clicking positions into standard device space coordinates (-1 to +1)
    mouseCoordinates.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouseCoordinates.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouseCoordinates, camera);
    const hitIntersections = raycaster.intersectObjects(targetsArray);
    
    if (hitIntersections.length > 0) {
        const selectedTarget = hitIntersections[0].object;
        
        // Remove item from scene structure cleanly
        scene.remove(selectedTarget);
        
        // Purge out from intersection detection tracking
        const storageIndex = targetsArray.indexOf(selectedTarget);
        if (storageIndex > -1) targetsArray.splice(storageIndex, 1);
        
        // Process tracking update changes
        score++;
        if (score < totalTargets) {
            scoreUI.innerText = `Targets Cleared: ${score} / ${totalTargets}`;
        } else {
            scoreUI.innerText = '✨ Exhibition Cleared! You Win! ✨';
            scoreUI.style.color = '#00ff66';
            scoreUI.style.borderColor = '#00ff66';
            
            // Hide the instructional statement entirely upon victory
            instructionUI.style.display = 'none';
        }
    }
});

// Window Resizing Setup
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 5. Animation Engine Update Loop
function animate(time) {
    const seconds = time / 1000; 
    controls.update();

    // Central Object Animations
    cube.rotation.x = seconds;
    cube.rotation.y = seconds * 0.5;
    sphere.position.y = 0.6 + Math.sin(seconds * 2) * 0.4;
    cylinder.rotation.z = seconds;

    if (customModel) customModel.rotation.y = seconds * 0.3;
    pointLight.position.x = 3 + Math.sin(seconds) * 1.5;

    // Smooth Wave Floating Ring Animations
    targetsArray.forEach((target) => {
        target.rotation.x += 0.01 * target.userData.rotSpeed;
        target.rotation.y += 0.01 * target.userData.rotSpeed;
        target.position.y = target.userData.initialY + Math.sin(seconds * 1.5 + target.userData.offset) * 0.25;
    });

    renderer.render(scene, camera);
}