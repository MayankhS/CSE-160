var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec3 a_Normal;
  attribute vec2 a_UV;
  
  varying vec2 v_UV;
  varying vec3 v_WorldPos;
  varying vec3 v_Normal;

  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  uniform mat4 u_NormalMatrix;

  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
    v_WorldPos = vec3(u_ModelMatrix * a_Position);
    v_Normal = normalize(vec3(u_NormalMatrix * vec4(a_Normal, 0.0)));
  }`;

var FSHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_UV;
  varying vec3 v_WorldPos;
  varying vec3 v_Normal;

  uniform vec4 u_FragColor;
  uniform sampler2D u_Sampler0;
  uniform int u_whichTexture; 
  uniform float u_happyWeight; 

  uniform bool u_LightingOn;
  uniform bool u_ShowNormals;
  uniform bool u_PointLightOn;
  uniform bool u_SpotLightOn;

  uniform vec3 u_LightPos;
  uniform vec3 u_LightColor;
  uniform vec3 u_CameraPos;

  uniform vec3 u_SpotLightPos;
  uniform vec3 u_SpotLightDir;
  uniform float u_SpotLightCutoff;

  void main() {
    if (u_ShowNormals) {
        gl_FragColor = vec4(v_Normal * 0.5 + 0.5, 1.0);
        return;
    }

    vec4 baseColor = u_FragColor;
    vec4 texColor = texture2D(u_Sampler0, v_UV);

    if (u_whichTexture == -1) {
        baseColor = u_FragColor;
    } else if (u_whichTexture == 0) {
        baseColor = texColor;
    } else if (u_whichTexture == 1) { 
        vec3 evilDirt = texColor.rgb * vec3(0.4, 0.12, 0.12); 
        vec3 happyDirt = texColor.rgb * vec3(0.85, 0.8, 0.7); 
        baseColor = vec4(mix(evilDirt, happyDirt, u_happyWeight), 1.0);
    } else if (u_whichTexture == 2) { 
        vec3 evilStone = texColor.rgb * vec3(0.2, 0.15, 0.22); 
        vec3 happyStone = texColor.rgb * vec3(1.1, 1.1, 1.15); 
        baseColor = vec4(mix(evilStone, happyStone, u_happyWeight), 1.0);
    } else if (u_whichTexture == 3) { 
        baseColor = vec4(texColor.rgb * vec3(1.4, 1.15, 0.2), 1.0);
    } else if (u_whichTexture == 4) { 
        vec3 evilMoss = texColor.rgb * vec3(0.12, 0.28, 0.18); 
        vec3 happyMoss = texColor.rgb * vec3(0.3, 0.85, 0.55); 
        baseColor = vec4(mix(evilMoss, happyMoss, u_happyWeight), 1.0);
    } else if (u_whichTexture == 5) { 
        vec3 evilFire = texColor.rgb * vec3(2.5, 0.6, 0.0); 
        vec3 happyFire = texColor.rgb * vec3(0.0, 1.8, 2.5); 
        baseColor = vec4(mix(evilFire, happyFire, u_happyWeight), 1.0);
    }

    if (!u_LightingOn) {
        gl_FragColor = baseColor;
        return;
    }

    vec3 N = normalize(v_Normal);
    vec3 V = normalize(u_CameraPos - v_WorldPos);
    
    vec3 ambientCoeff = vec3(0.3, 0.3, 0.3);
    vec3 diffuseCoeff = vec3(0.7, 0.7, 0.7);
    vec3 specularCoeff = vec3(0.5, 0.5, 0.5);
    float shininess = 32.0;

    vec3 totalAmbient = ambientCoeff * u_LightColor;
    vec3 totalDiffuse = vec3(0.0);
    vec3 totalSpecular = vec3(0.0);

    if (u_PointLightOn) {
        vec3 L = normalize(u_LightPos - v_WorldPos);
        float nDotL = max(dot(N, L), 0.0);
        vec3 diffuse = diffuseCoeff * nDotL * u_LightColor;
        
        vec3 R = reflect(-L, N);
        float rDotV = max(dot(R, V), 0.0);
        vec3 specular = specularCoeff * pow(rDotV, shininess) * u_LightColor;
        
        totalDiffuse += diffuse;
        totalSpecular += specular;
    }

    if (u_SpotLightOn) {
        vec3 L_spot = normalize(u_SpotLightPos - v_WorldPos);
        vec3 D_spot = normalize(u_SpotLightDir);
        float cosAngle = dot(-L_spot, D_spot);
        
        if (cosAngle > u_SpotLightCutoff) {
            float intensity = smoothstep(u_SpotLightCutoff, u_SpotLightCutoff + 0.05, cosAngle);
            float nDotL = max(dot(N, L_spot), 0.0);
            vec3 diffuse = diffuseCoeff * nDotL * vec3(1.0, 0.95, 0.6) * intensity;
            
            vec3 R = reflect(-L_spot, N);
            float rDotV = max(dot(R, V), 0.0);
            vec3 specular = specularCoeff * pow(rDotV, shininess) * vec3(1.0, 0.95, 0.6) * intensity;
            
            totalDiffuse += diffuse;
            totalSpecular += specular;
        }
    }

    vec3 finalCalculatedColor = (totalAmbient + totalDiffuse) * baseColor.rgb + totalSpecular;
    gl_FragColor = vec4(finalCalculatedColor, baseColor.a);
  }`;

let g_lightingOn = true;
let g_showNormals = false;
let g_pointLightOn = true;
let g_spotLightOn = true;
let g_lightAnimate = true;

let g_lightPos = [0.0, 5.0, 2.0];
let g_lightColor = [1.0, 1.0, 1.0];

let g_vertexBuffer = null;
let g_normalBuffer = null;
let g_uvBuffer = null;
let g_sphereData = null;
let g_objModelData = null;

let u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, u_NormalMatrix;
let u_FragColor, u_whichTexture, u_happyWeight;
let u_LightingOn, u_ShowNormals, u_PointLightOn, u_SpotLightOn;
let u_LightPos, u_LightColor, u_CameraPos;
let u_SpotLightPos, u_SpotLightDir, u_SpotLightCutoff;

let g_lastFrameTime = performance.now() / 1000;
let g_keysPressed = {};
let g_horseYOffset = 3.2; 
let g_happyWeight = 0.0; 
let g_camera;

let g_goldCollected = 0;
let g_treasurePositions = [
    {x: 25, z: 25, harvested: false}, 
    {x: 6, z: 6, harvested: false},   
    {x: 16, z: 16, harvested: false}  
];

let g_map = [];
let g_blockType = []; 

function initMapMatrix() {
    g_map = []; g_blockType = [];
    for (let x = 0; x < 32; x++) {
        let hRow = new Array(32).fill(0);
        let tRow = new Array(32).fill(2); 
        if (x === 0 || x === 31) { hRow.fill(4); } else { hRow[0] = 4; hRow[31] = 4; }
        g_map.push(hRow); g_blockType.push(tRow);
    }
    let towers = [{x:3, z:3}, {x:3, z:28}, {x:28, z:3}, {x:28, z:28}];
    towers.forEach(t => { g_map[t.x][t.z] = 5; g_blockType[t.x][t.z] = 2; });

    for (let x = 21; x <= 29; x++) {
        for (let z = 21; z <= 29; z++) {
            g_map[x][z] = 1; g_blockType[x][z] = 2;
            if (x >= 22 && x <= 28 && z >= 22 && z <= 28) g_map[x][z] = 2;
            if (x >= 23 && x <= 27 && z >= 23 && z <= 27) g_map[x][z] = 4;
            if ((x === 22 || x === 28) && (z === 22 || z === 28)) g_map[x][z] = 6;
        }
    }
    g_map[25][21] = 0; g_map[25][22] = 0; g_map[25][23] = 0; g_map[25][24] = 0;
    g_map[25][25] = 1; g_blockType[25][25] = 2;

    for (let x = 3; x <= 9; x++) {
        for (let z = 3; z <= 9; z++) {
            if (x === 3 || x === 9 || z === 3 || z === 9) {
                g_map[x][z] = ((x + z) % 2 === 0) ? 4 : 2; g_blockType[x][z] = 2;
            } else if (x === 4 || x === 8 || z === 4 || z === 8) {
                g_map[x][z] = 3; g_blockType[x][z] = 2;
            }
        }
    }
    g_map[9][6] = 0; g_map[8][6] = 0; g_map[7][6] = 0;
    g_map[6][6] = 1; g_blockType[6][6] = 2;

    let centerPillarCoords = [
        {x: 12, z: 16}, {x: 20, z: 16}, {x: 16, z: 12}, {x: 16, z: 20},
        {x: 13, z: 13}, {x: 19, z: 19}, {x: 13, z: 19}, {x: 19, z: 13}
    ];
    centerPillarCoords.forEach(p => { g_map[p.x][p.z] = 5; g_blockType[p.x][p.z] = 2; });
    g_map[16][16] = 1; g_blockType[16][16] = 2;

    g_map[22][6] = 4; g_blockType[22][6] = 2; 
    g_map[26][6] = 4; g_blockType[26][6] = 2; 

    for (let x = 4; x <= 8; x++) {
        for (let z = 23; z <= 27; z++) {
            if (x === 4 || x === 8 || z === 23 || z === 27) { g_map[x][z] = 2; g_blockType[x][z] = 2; }
        }
    }
    let cryptCorners = [{x:4, z:23}, {x:4, z:27}, {x:8, z:23}, {x:8, z:27}];
    cryptCorners.forEach(c => { g_map[c.x][c.z] = 3; g_blockType[c.x][c.z] = 5; });

    let decorativeTorches = [
        {x: 24, z: 20}, {x: 26, z: 20}, {x: 10, z: 5},  {x: 10, z: 7},  
        {x: 14, z: 14}, {x: 14, z: 18}, {x: 18, z: 14}, {x: 18, z: 18}  
    ];
    decorativeTorches.forEach(tp => { g_map[tp.x][tp.z] = 3; g_blockType[tp.x][tp.z] = 5; });

    for (let i = 0; i < g_treasurePositions.length; i++) {
        let t = g_treasurePositions[i];
        g_map[t.x][t.z] = Math.max(g_map[t.x][t.z], 1);
    }
}

initMapMatrix();

function main() {
    let canvas = document.getElementById('webgl');
    let gl = getWebGLContext(canvas, false);
    if (!gl) return;
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) return;

    gl.enable(gl.DEPTH_TEST);

    initBuffers(gl);
    initTextures(gl);
    setupInterfaceListeners();

    u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
    u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
    u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
    u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
    u_whichTexture = gl.getUniformLocation(gl.program, 'u_whichTexture');
    u_happyWeight = gl.getUniformLocation(gl.program, 'u_happyWeight');

    u_LightingOn = gl.getUniformLocation(gl.program, 'u_LightingOn');
    u_ShowNormals = gl.getUniformLocation(gl.program, 'u_ShowNormals');
    u_PointLightOn = gl.getUniformLocation(gl.program, 'u_PointLightOn');
    u_SpotLightOn = gl.getUniformLocation(gl.program, 'u_SpotLightOn');
    u_LightPos = gl.getUniformLocation(gl.program, 'u_LightPos');
    u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
    u_CameraPos = gl.getUniformLocation(gl.program, 'u_CameraPos');

    u_SpotLightPos = gl.getUniformLocation(gl.program, 'u_SpotLightPos');
    u_SpotLightDir = gl.getUniformLocation(gl.program, 'u_SpotLightDir');
    u_SpotLightCutoff = gl.getUniformLocation(gl.program, 'u_SpotLightCutoff');

    g_camera = new Camera(canvas);

    document.onkeydown = function(ev) {
        g_keysPressed[ev.key.toLowerCase()] = true;
        if (ev.key === 'f' || ev.key === 'F') modifyVoxelBlock(1);
        if (ev.key === 'g' || ev.key === 'G') modifyVoxelBlock(-1);
    };
    
    document.onkeyup = function(ev) { g_keysPressed[ev.key.toLowerCase()] = false; };

    canvas.onmousemove = function(ev) {
        if (ev.buttons === 1) {
            let trackingFactor = 0.22;
            if (ev.movementX > 0) g_camera.panRight(ev.movementX * trackingFactor);
            if (ev.movementX < 0) g_camera.panLeft(Math.abs(ev.movementX) * trackingFactor);
            if (ev.movementY > 0) g_camera.panUpDown(-ev.movementY * trackingFactor);
            if (ev.movementY < 0) g_camera.panUpDown(Math.abs(ev.movementY) * trackingFactor);
            updateTargetTelemetry();
        }
    };

    function tick() {
        let now = performance.now() / 1000;
        let elapsed = now - g_lastFrameTime;
        g_lastFrameTime = now;
        document.getElementById('fps').innerText = "FPS: " + Math.round(1 / elapsed);

        processInputStateLoop();
        updateTerrainHeightTrackingLoop();
        
        if (g_lightAnimate) {
            g_lightPos[0] = Math.cos(now * 1.2) * 6.0;
            g_lightPos[2] = Math.sin(now * 1.2) * 6.0 + 2.0;
            document.getElementById('lightX').value = g_lightPos[0];
            document.getElementById('lightZ').value = g_lightPos[2];
        }

        if (g_goldCollected === 3) {
            if (g_happyWeight < 1.0) { g_happyWeight += 0.015; if (g_happyWeight > 1.0) g_happyWeight = 1.0; }
            if (g_horseYOffset > 0.0) { g_horseYOffset -= 0.05; if (g_horseYOffset < 0.0) g_horseYOffset = 0.0; }
        }

        gl.uniform1f(u_happyWeight, g_happyWeight);
        
        gl.uniform1i(u_LightingOn, g_lightingOn);
        gl.uniform1i(u_ShowNormals, g_showNormals);
        gl.uniform1i(u_PointLightOn, g_pointLightOn);
        gl.uniform1i(u_SpotLightOn, g_spotLightOn);
        gl.uniform3f(u_LightPos, g_lightPos[0], g_lightPos[1], g_lightPos[2]);
        gl.uniform3f(u_LightColor, g_lightColor[0], g_lightColor[1], g_lightColor[2]);
        gl.uniform3f(u_CameraPos, g_camera.eye.elements[0], g_camera.eye.elements[1], g_camera.eye.elements[2]);

        gl.uniform3f(u_SpotLightPos, 0.0, 6.0, 2.0);
        gl.uniform3f(u_SpotLightDir, 0.0, -1.0, 0.0);
        gl.uniform1f(u_SpotLightCutoff, Math.cos(25 * Math.PI / 180)); 

        renderScene(gl);
        requestAnimationFrame(tick);
    }
    tick();
}

function setupInterfaceListeners() {
    document.getElementById('toggleLighting').onclick = function() { g_lightingOn = !g_lightingOn; };
    document.getElementById('toggleNormals').onclick = function() { g_showNormals = !g_showNormals; };
    document.getElementById('togglePointLight').onclick = function() { g_pointLightOn = !g_pointLightOn; };
    document.getElementById('toggleSpotLight').onclick = function() { g_spotLightOn = !g_spotLightOn; };
    document.getElementById('toggleAnimate').onclick = function() { g_lightAnimate = !g_lightAnimate; };

    document.getElementById('lightX').oninput = function() { g_lightPos[0] = parseFloat(this.value); g_lightAnimate = false; };
    document.getElementById('lightY').oninput = function() { g_lightPos[1] = parseFloat(this.value); };
    document.getElementById('lightZ').oninput = function() { g_lightPos[2] = parseFloat(this.value); g_lightAnimate = false; };

    document.getElementById('lightR').oninput = function() { g_lightColor[0] = parseFloat(this.value); };
    document.getElementById('lightG').oninput = function() { g_lightColor[1] = parseFloat(this.value); };
    document.getElementById('lightB').oninput = function() { g_lightColor[2] = parseFloat(this.value); };
}

function processInputStateLoop() {
    let walkSpeed = 0.08; let turnSpeed = 1.5;
    let preMoveX = g_camera.eye.elements[0]; let preMoveZ = g_camera.eye.elements[2];
    let preAtX = g_camera.at.elements[0]; let preAtZ = g_camera.at.elements[2];
    
    if (g_keysPressed['w']) g_camera.moveForward(walkSpeed);
    if (g_keysPressed['s']) g_camera.moveBackwards(walkSpeed);
    if (g_keysPressed['a']) g_camera.moveLeft(walkSpeed);
    if (g_keysPressed['d']) g_camera.moveRight(walkSpeed);
    if (g_keysPressed['q']) g_camera.panLeft(turnSpeed);
    if (g_keysPressed['e']) g_camera.panRight(turnSpeed);

    let mapX = Math.floor(g_camera.eye.elements[0] + 16);
    let mapZ = Math.floor(g_camera.eye.elements[2] + 16);
    if (mapX >= 0 && mapX < 32 && mapZ >= 0 && mapZ < 32) {
        let terrainHeight = 0.25 * Math.sin(mapX * 0.35) * Math.cos(mapZ * 0.35);
        let structuralBlockHeight = g_map[mapX][mapZ];
        let cameraFeetY = g_camera.eye.elements[1] - 0.7;

        if (structuralBlockHeight + terrainHeight > cameraFeetY + 0.1) {
            g_camera.eye.elements[0] = preMoveX; g_camera.eye.elements[2] = preMoveZ;
            g_camera.at.elements[0] = preAtX; g_camera.at.elements[2] = preAtZ;
            g_camera.updateView();
        }
    }
}

function updateTerrainHeightTrackingLoop() {
    let mapX = Math.floor(g_camera.eye.elements[0] + 16);
    let mapZ = Math.floor(g_camera.eye.elements[2] + 16);
    if (mapX >= 0 && mapX < 32 && mapZ >= 0 && mapZ < 32) {
        let terrainHeight = 0.25 * Math.sin(mapX * 0.35) * Math.cos(mapZ * 0.35);
        let currentTargetGroundY = terrainHeight + g_map[mapX][mapZ] + 0.7;
        let heightCorrection = currentTargetGroundY - g_camera.eye.elements[1];
        g_camera.eye.elements[1] = currentTargetGroundY;
        g_camera.at.elements[1] += heightCorrection;
        g_camera.updateView();
    }
}

function modifyVoxelBlock(actionType) {
    let f = new Vector3(); f.set(g_camera.at); f.sub(g_camera.eye); f.elements[1] = 0; f.normalize(); f.mul(1.5);
    let mapX = Math.floor((g_camera.eye.elements[0] + f.elements[0]) + 16);
    let mapZ = Math.floor((g_camera.eye.elements[2] + f.elements[2]) + 16);
    
    if (mapX >= 0 && mapX < 32 && mapZ >= 0 && mapZ < 32) {
        let wallHeight = g_map[mapX][mapZ];
        if (actionType === -1 && wallHeight > 0) {
            for (let i = 0; i < g_treasurePositions.length; i++) {
                let t = g_treasurePositions[i];
                if (t.x === mapX && t.z === mapZ && !t.harvested) {
                    t.harvested = true; g_goldCollected++;
                    document.getElementById('game-status').innerText = "Relics Cleansed: " + g_goldCollected + " / 3";
                }
            }
        }
        if (actionType === 1 && wallHeight < 4) { g_map[mapX][mapZ]++; } 
        else if (actionType === -1 && wallHeight > 0) { g_map[mapX][mapZ]--; }
        updateTargetTelemetry();
    }
}

function updateTargetTelemetry() {
    let f = new Vector3(); f.set(g_camera.at); f.sub(g_camera.eye); f.elements[1] = 0; f.normalize(); f.mul(1.5);
    let mapX = Math.floor((g_camera.eye.elements[0] + f.elements[0]) + 16);
    let mapZ = Math.floor((g_camera.eye.elements[2] + f.elements[2]) + 16);
    if (mapX >= 0 && mapX < 32 && mapZ >= 0 && mapZ < 32) {
        document.getElementById('target-coords').innerText = "Targeting Matrix: [X: " + mapX + ", Z: " + mapZ + "]";
    }
}

function initBuffers(gl) {
    g_vertexBuffer = gl.createBuffer();
    let cubeVertices = new Float32Array([
        0,0,0, 1,1,0, 1,0,0,  0,0,0, 0,1,0, 1,1,0, 
        0,0,1, 1,0,1, 1,1,1,  0,0,1, 1,1,1, 0,1,1, 
        0,1,0, 0,1,1, 1,1,1,  0,1,0, 1,1,1, 1,1,0, 
        0,0,0, 1,0,0, 1,0,1,  0,0,0, 1,0,1, 0,0,1, 
        1,0,0, 1,1,0, 1,1,1,  1,0,0, 1,1,1, 1,0,1, 
        0,0,0, 0,0,1, 0,1,1,  0,0,0, 0,1,1, 0,1,0  
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, g_vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

    g_normalBuffer = gl.createBuffer();
    let cubeNormals = new Float32Array([
        0,0,-1, 0,0,-1, 0,0,-1,  0,0,-1, 0,0,-1, 0,0,-1,
        0,0,1,  0,0,1,  0,0,1,   0,0,1,  0,0,1,  0,0,1,
        0,1,0,  0,1,0,  0,1,0,   0,1,0,  0,1,0,  0,1,0,
        0,-1,0, 0,-1,0, 0,-1,0,  0,-1,0, 0,-1,0, 0,-1,0,
        1,0,0,  1,0,0,  1,0,0,   1,0,0,  1,0,0,  1,0,0,
       -1,0,0, -1,0,0, -1,0,0,  -1,0,0, -1,0,0, -1,0,0
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, g_normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeNormals, gl.STATIC_DRAW);

    g_uvBuffer = gl.createBuffer();
    let cubeUVs = new Float32Array([
        0,0, 1,1, 1,0,  0,0, 0,1, 1,1,
        0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
        0,0, 0,1, 1,1,  0,0, 1,1, 1,0,
        0,0, 1,0, 1,1,  0,0, 1,1, 0,1,
        0,0, 0,1, 1,1,  0,0, 1,1, 1,0,
        0,0, 1,0, 1,1,  0,0, 1,1, 0,1 
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, g_uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeUVs, gl.STATIC_DRAW);

    g_sphereData = generateSphereMesh(1.0, 24);
    g_objModelData = parseInlineOBJ();
}

function generateSphereMesh(radius, segments) {
    let vertices = []; let normals = []; let uvs = []; let indices = [];
    for (let lat = 0; lat <= segments; lat++) {
        let theta = (lat * Math.PI) / segments;
        let sinTh = Math.sin(theta); let cosTh = Math.cos(theta);
        for (let lon = 0; lon <= segments; lon++) {
            let phi = (lon * 2 * Math.PI) / segments;
            let x = Math.cos(phi) * sinTh; let y = cosTh; let z = Math.sin(phi) * sinTh;
            vertices.push(radius * x, radius * y, radius * z);
            normals.push(x, y, z); 
            uvs.push(1 - (lon / segments), 1 - (lat / segments));
        }
    }
    for (let lat = 0; lat < segments; lat++) {
        for (let lon = 0; lon < segments; lon++) {
            let first = lat * (segments + 1) + lon; let second = first + segments + 1;
            indices.push(first, second, first + 1); indices.push(second, second + 1, first + 1);
        }
    }
    return {
        vBuf: new Float32Array(vertices), nBuf: new Float32Array(normals),
        tBuf: new Float32Array(uvs), idxBuf: new Uint16Array(indices), count: indices.length
    };
}

function parseInlineOBJ() {
    let rawObjText = `
    v 0.0 1.0 0.0
    v -0.6 0.0 -0.6
    v 0.6 0.0 -0.6
    v 0.6 0.0 0.6
    v -0.6 0.0 0.6
    v 0.0 -1.0 0.0
    f 1 2 3
    f 1 3 4
    f 1 4 5
    f 1 5 2
    f 6 3 2
    f 6 4 3
    f 6 5 4
    f 6 2 5`;

    let lines = rawObjText.split('\\n');
    let positions = [];
    let finalVertices = [];
    let finalNormals = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.startsWith('v ')) {
            let parts = line.split(/\\s+/).slice(1).map(Number);
            positions.push(parts);
        } else if (line.startsWith('f ')) {
            let idxs = line.split(/\\s+/).slice(1).map(p => parseInt(p.split('/')[0]) - 1);
            
            let p0 = positions[idxs[0]];
            let p1 = positions[idxs[1]];
            let p2 = positions[idxs[2]];

            let v1 = [p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]];
            let v2 = [p2[0]-p0[0], p2[1]-p0[1], p2[2]-p0[2]];
            let nx = v1[1]*v2[2] - v1[2]*v2[1];
            let ny = v1[2]*v2[0] - v1[0]*v2[2];
            let nz = v1[0]*v2[1] - v1[1]*v2[0];
            let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if(len > 0) { nx /= len; ny /= len; nz /= len; }

            for (let j = 0; j < 3; j++) {
                finalVertices.push(positions[idxs[j]][0], positions[idxs[j]][1], positions[idxs[j]][2]);
                finalNormals.push(nx, ny, nz);
            }
        }
    }
    return {
        vBuf: new Float32Array(finalVertices),
        nBuf: new Float32Array(finalNormals),
        count: finalVertices.length / 3
    };
}

function initTextures(gl) {
    let u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
    let texture0 = gl.createTexture();
    let image0 = new Image();
    image0.onload = function() {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image0);
        gl.uniform1i(u_Sampler0, 0);
    };
    image0.src = 'dirt.jpg';
}

function drawCube(gl, matrix, color, textureTypeFlag) {
    gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);
    gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
    gl.uniform1i(u_whichTexture, textureTypeFlag);
    
    let normalMatrix = new Matrix4();
    normalMatrix.set(matrix);
    normalMatrix.invert();
    normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

    gl.bindBuffer(gl.ARRAY_BUFFER, g_vertexBuffer);
    let a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, g_normalBuffer);
    let a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);

    gl.bindBuffer(gl.ARRAY_BUFFER, g_uvBuffer);
    let a_UV = gl.getAttribLocation(gl.program, 'a_UV');
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_UV);
    
    gl.drawArrays(gl.TRIANGLES, 0, 36);
}

function drawSphere(gl, matrix, color, textureTypeFlag) {
    gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);
    gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
    gl.uniform1i(u_whichTexture, textureTypeFlag);

    let normalMatrix = new Matrix4();
    normalMatrix.set(matrix); normalMatrix.invert(); normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

    let posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, g_sphereData.vBuf, gl.DYNAMIC_DRAW);
    let a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    let normBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, g_sphereData.nBuf, gl.DYNAMIC_DRAW);
    let a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);

    let texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, g_sphereData.tBuf, gl.DYNAMIC_DRAW);
    let a_UV = gl.getAttribLocation(gl.program, 'a_UV');
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_UV);

    let indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g_sphereData.idxBuf, gl.DYNAMIC_DRAW);

    gl.drawElements(gl.TRIANGLES, g_sphereData.count, gl.UNSIGNED_SHORT, 0);
    
    gl.deleteBuffer(posBuffer); gl.deleteBuffer(normBuffer);
    gl.deleteBuffer(texBuffer); gl.deleteBuffer(indexBuffer);
}

function drawOBJModel(gl, matrix, color) {
    gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);
    gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
    gl.uniform1i(u_whichTexture, -1);

    let normalMatrix = new Matrix4();
    normalMatrix.set(matrix); normalMatrix.invert(); normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

    let posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, g_objModelData.vBuf, gl.DYNAMIC_DRAW);
    let a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    let normBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, g_objModelData.nBuf, gl.DYNAMIC_DRAW);
    let a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);

    gl.drawArrays(gl.TRIANGLES, 0, g_objModelData.count);

    gl.deleteBuffer(posBuffer); gl.deleteBuffer(normBuffer);
}

function renderScene(gl) {
    let t = performance.now() / 1000;
    
    gl.clearColor(0.2, 0.3, 0.4, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix4fv(u_ViewMatrix, false, g_camera.viewMatrix.elements);
    gl.uniformMatrix4fv(u_ProjectionMatrix, false, g_camera.projectionMatrix.elements);

    let markerMat = new Matrix4();
    markerMat.translate(g_lightPos[0], g_lightPos[1], g_lightPos[2]);
    markerMat.scale(0.25, 0.25, 0.25);
    gl.uniform1i(u_LightingOn, false); 
    drawCube(gl, markerMat, [g_lightColor[0], g_lightColor[1], g_lightColor[2], 1.0], -1);
    gl.uniform1i(u_LightingOn, g_lightingOn); 

    // Textured Stone Sphere - Untouched position
    let sphereMat1 = new Matrix4();
    sphereMat1.translate(2.5, 1.3, 1.0);
    sphereMat1.scale(1.0, 1.0, 1.0);
    drawSphere(gl, sphereMat1, [1.0, 1.0, 1.0, 1.0], 2); 

    // Matte Red Sphere - Restored and shifted safely to a completely open courtyard gap
    let sphereMat2 = new Matrix4();
    sphereMat2.translate(-2.0, 1.3, 0.0);
    sphereMat2.scale(1.0, 1.0, 1.0);
    drawSphere(gl, sphereMat2, [0.85, 0.15, 0.15, 1.0], -1); 

    let objMat = new Matrix4();
    objMat.translate(0.0, 2.2, 1.0);
    objMat.scale(1.2, 1.2, 1.2);
    objMat.rotate(t * 30, 0, 1, 0);
    drawOBJModel(gl, objMat, [0.1, 0.8, 0.7, 1.0]);

    for (let x = 0; x < 32; x++) {
        for (let z = 0; z < 32; z++) {
            let groundTerrainMatrix = new Matrix4();
            let terrainHeight = 0.25 * Math.sin(x * 0.35) * Math.cos(z * 0.35);
            groundTerrainMatrix.translate(x - 16, terrainHeight - 0.1, z - 16);
            groundTerrainMatrix.scale(1.0, 0.1, 1.0);
            drawCube(gl, groundTerrainMatrix, [1.0, 1.0, 1.0, 1.0], 1);
        }
    }

    for (let x = 0; x < 32; x++) {
        for (let z = 0; z < 32; z++) {
            let wallHeight = g_map[x][z];
            let baseTerrainOffset = 0.25 * Math.sin(x * 0.35) * Math.cos(z * 0.35);
            
            for (let y = 0; y < wallHeight; y++) {
                let wallMat = new Matrix4();
                wallMat.translate(x - 16, y + baseTerrainOffset, z - 16);
                let activeTex = g_blockType[x][z]; let isTreasure = false;
                
                for (let i = 0; i < g_treasurePositions.length; i++) {
                    let treasure = g_treasurePositions[i];
                    if (treasure.x === x && treasure.z === z && !treasure.harvested && y === (wallHeight - 1)) { isTreasure = true; }
                }
                
                if (isTreasure) {
                    activeTex = 3; drawCube(gl, wallMat, [1.0, 1.0, 1.0, 1.0], activeTex);
                } else if (activeTex === 5) {
                    if (y < (wallHeight - 1)) { drawCube(gl, wallMat, [1.0, 1.0, 1.0, 1.0], 2); } 
                    else { drawCube(gl, wallMat, [1.0, 1.0, 1.0, 1.0], 5); }
                } else {
                    drawCube(gl, wallMat, [1.0, 1.0, 1.0, 1.0], activeTex);
                }
            }
            if (x >= 23 && x <= 25 && z === 6) {
                let archMat = new Matrix4(); archMat.translate(x - 16, 3.0 + baseTerrainOffset, z - 16);
                drawCube(gl, archMat, [1.0, 1.0, 1.0, 1.0], 2);
            }
            if (x >= 23 && x <= 27 && z >= 23 && z <= 27) {
                let caveCeilingMat = new Matrix4(); caveCeilingMat.translate(x - 16, 4.0 + baseTerrainOffset, z - 16);
                drawCube(gl, caveCeilingMat, [1.0, 1.0, 1.0, 1.0], 2);
            }
            if (wallHeight === 0 && (x > 11 && x < 21) && (z > 11 && z < 21)) {
                if ((x + z) % 4 === 0 && !(x >= 15 && x <= 17 && z >= 15 && z <= 17)) {
                    let islandMat = new Matrix4(); islandMat.translate(x - 16, 4.2 + (0.12 * Math.sin(t * 2 + x)), z - 16);
                    drawCube(gl, islandMat, [1.0, 1.0, 1.0, 1.0], 4);
                }
            }
        }
    }

    if (g_horseYOffset > 0.0) {
        for (let xi = 15; xi <= 17; xi++) {
            for (let zi = 15; zi <= 17; zi++) {
                let islandTerrainOffset = 0.25 * Math.sin(xi * 0.35) * Math.cos(zi * 0.35);
                let customIslandMat = new Matrix4();
                customIslandMat.translate(xi - 16, 3.2 + islandTerrainOffset, zi - 16); 
                drawCube(gl, customIslandMat, [1.0, 1.0, 1.0, 1.0], 4);
            }
        }
    }

    let animalBaseMatrix = new Matrix4();
    let centerTerrainOffset = 0.25 * Math.sin(16 * 0.35) * Math.cos(16 * 0.35);
    animalBaseMatrix.translate(0.0, 0.45 + centerTerrainOffset + g_horseYOffset, 0.0);
    animalBaseMatrix.scale(0.6, 0.6, 0.6);
    
    let torsoMatrix = new Matrix4(animalBaseMatrix).translate(-0.4, 0.0, -0.2);
    drawCube(gl, new Matrix4(torsoMatrix).scale(0.8, 0.4, 0.4), [0.4, 0.25, 0.15, 1.0], -1);

    let neckMatrix = new Matrix4(torsoMatrix).translate(0.7, 0.35, 0.1);
    neckMatrix.rotate(-25 + (Math.sin(t * 5) * 8), 0, 0, 1);
    drawCube(gl, new Matrix4(neckMatrix).scale(0.15, 0.5, 0.15), [0.4, 0.25, 0.15, 1.0], -1);

    let headMatrix = new Matrix4(neckMatrix).translate(-0.05, 0.45, -0.02);
    drawCube(gl, new Matrix4(headMatrix).scale(0.3, 0.25, 0.2), [0.5, 0.35, 0.2, 1.0], -1);

    function drawHierarchicalLeg(xOffset, zOffset, animPhaseOffset) {
        let thighMatrix = new Matrix4(torsoMatrix).translate(xOffset, 0.1, zOffset);
        thighMatrix.rotate(25 * Math.sin(t * 5 + animPhaseOffset), 0, 0, 1);
        drawCube(gl, new Matrix4(thighMatrix).scale(0.12, -0.35, 0.1), [0.35, 0.2, 0.1, 1.0], -1);

        let calfMatrix = new Matrix4(thighMatrix).translate(0, -0.35, 0).rotate(20 * Math.sin(t * 5 + animPhaseOffset) + 15, 0, 0, 1);
        drawCube(gl, new Matrix4(calfMatrix).scale(0.1, -0.3, 0.1), [0.3, 0.15, 0.05, 1.0], -1);

        let hoofMatrix = new Matrix4(calfMatrix).translate(-0.02, -0.3, -0.02).rotate(10 * Math.sin(t * 5 + animPhaseOffset), 0, 0, 1);
        drawCube(gl, new Matrix4(hoofMatrix).scale(0.14, -0.08, 0.14), [0.1, 0.1, 0.1, 1.0], -1);
    }
    drawHierarchicalLeg(0.65, 0.05, 0); 
    drawHierarchicalLeg(0.65, 0.25, Math.PI);
    drawHierarchicalLeg(0.05, 0.05, Math.PI); 
    drawHierarchicalLeg(0.05, 0.25, 0);

    let tailMatrix = new Matrix4(torsoMatrix).translate(0, 0.35, 0.15);
    tailMatrix.rotate(180 + (30 * Math.sin(t * 8)), 0, 0, 1);
    drawCube(gl, new Matrix4(tailMatrix).scale(0.45, 0.1, 0.1), [0.1, 0.1, 0.1, 1.0], -1);
}

window.onload = main;