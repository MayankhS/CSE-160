// Shaders with Distance Fog and Texture Multi-Sampling Tints
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  varying vec2 v_UV;
  varying vec4 v_DistPos;

  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;

  void main() {
    vec4 vPos = u_ViewMatrix * u_ModelMatrix * a_Position;
    gl_Position = u_ProjectionMatrix * vPos;
    v_UV = a_UV;
    v_DistPos = vPos; 
  }`;

var FSHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_UV;
  varying vec4 v_DistPos;

  uniform vec4 u_FragColor;
  uniform sampler2D u_Sampler0;
  uniform int u_whichTexture; // 0 = Color, 1 = Dirt, 2 = Stone, 3 = Gold, 4 = Moss, 5 = Textured Flame
  uniform vec4 u_FogColor;
  uniform float u_happyWeight; 

  void main() {
    vec4 baseColor;
    vec4 texColor = texture2D(u_Sampler0, v_UV);

    if (u_whichTexture == 0) {
        baseColor = u_FragColor;
    } else if (u_whichTexture == 1) { // Ground / Crimson Dirt
        vec3 evilDirt = texColor.rgb * vec3(0.4, 0.12, 0.12); 
        vec3 happyDirt = texColor.rgb * vec3(0.85, 0.8, 0.7); 
        baseColor = vec4(mix(evilDirt, happyDirt, u_happyWeight), 1.0);
    } else if (u_whichTexture == 2) { // Structures / Stone
        vec3 evilStone = texColor.rgb * vec3(0.2, 0.15, 0.22); 
        vec3 happyStone = texColor.rgb * vec3(1.1, 1.1, 1.15); 
        baseColor = vec4(mix(evilStone, happyStone, u_happyWeight), 1.0);
    } else if (u_whichTexture == 3) { // Golden Relic Block
        baseColor = vec4(texColor.rgb * vec3(1.4, 1.15, 0.2), 1.0);
    } else if (u_whichTexture == 4) { // Levitating Monolith Bases
        vec3 evilMoss = texColor.rgb * vec3(0.12, 0.28, 0.18); 
        vec3 happyMoss = texColor.rgb * vec3(0.3, 0.85, 0.55); 
        baseColor = vec4(mix(evilMoss, happyMoss, u_happyWeight), 1.0);
    } else if (u_whichTexture == 5) { // Firelit Torch Element (Now fully textured and pixelated)
        vec3 evilFire = texColor.rgb * vec3(2.5, 0.6, 0.0); // Dynamic glowing orange lava fire
        vec3 happyFire = texColor.rgb * vec3(0.0, 1.8, 2.5); // Radiant holy blue sanctuary fire
        baseColor = vec4(mix(evilFire, happyFire, u_happyWeight), 1.0);
    }

    float dist = length(v_DistPos.xyz);
    
    float fogNear = mix(6.0, 14.0, u_happyWeight);
    float fogFar = mix(24.0, 36.0, u_happyWeight);
    float fogFactor = clamp((dist - fogNear) / (fogFar - fogNear), 0.0, 1.0);

    gl_FragColor = mix(baseColor, u_FogColor, fogFactor);
  }`;

let g_lastFrameTime = performance.now() / 1000;
let g_keysPressed = {};
let g_horseYOffset = 3.2; 
let g_happyWeight = 0.0; 

let g_goldCollected = 0;
let g_treasurePositions = [
    {x: 25, z: 25, harvested: false}, // Structure 1: Center room of the Grand Ziggurat
    {x: 6, z: 6, harvested: false},   // Structure 2: Core floor of the Ruined Colosseum Arches
    {x: 16, z: 16, harvested: false}  // Structure 3: Altar perfectly below the central floating island
];

let g_map = [];
let g_blockType = []; // Matrix tracking structural configurations (1=Dirt, 2=Stone, 4=Moss, 5=Torch Post)

function initMapMatrix() {
    g_map = [];
    g_blockType = [];
    
    // Initialize full 32x32 structural grids
    for (let x = 0; x < 32; x++) {
        let hRow = new Array(32).fill(0);
        let tRow = new Array(32).fill(2); 
        if (x === 0 || x === 31) {
            hRow.fill(4);
        } else {
            hRow[0] = 4; hRow[31] = 4;
        }
        g_map.push(hRow);
        g_blockType.push(tRow);
    }

    // Corner Sentinel Towers
    let towers = [{x:3, z:3}, {x:3, z:28}, {x:28, z:3}, {x:28, z:28}];
    towers.forEach(t => {
        g_map[t.x][t.z] = 5;
        g_blockType[t.x][t.z] = 2;
    });

    // GRANDIOSE STRUCTURE 1: The Stepped Dread-Ziggurat (Back-Right Corner)
    for (let x = 21; x <= 29; x++) {
        for (let z = 21; z <= 29; z++) {
            g_map[x][z] = 1;
            g_blockType[x][z] = 2;
            if (x >= 22 && x <= 28 && z >= 22 && z <= 28) g_map[x][z] = 2;
            if (x >= 23 && x <= 27 && z >= 23 && z <= 27) g_map[x][z] = 4;
            if ((x === 22 || x === 28) && (z === 22 || z === 28)) g_map[x][z] = 6;
        }
    }
    g_map[25][21] = 0; g_map[25][22] = 0; g_map[25][23] = 0; g_map[25][24] = 0;
    g_map[25][25] = 1; g_blockType[25][25] = 2;

    // GRANDIOSE STRUCTURE 2: The Sunken Colosseum Arches (Front-Left Corner)
    for (let x = 3; x <= 9; x++) {
        for (let z = 3; z <= 9; z++) {
            if (x === 3 || x === 9 || z === 3 || z === 9) {
                g_map[x][z] = ((x + z) % 2 === 0) ? 4 : 2;
                g_blockType[x][z] = 2;
            } else if (x === 4 || x === 8 || z === 4 || z === 8) {
                g_map[x][z] = 3;
                g_blockType[x][z] = 2;
            }
        }
    }
    g_map[9][6] = 0; g_map[8][6] = 0; g_map[7][6] = 0;
    g_map[6][6] = 1; g_blockType[6][6] = 2;

    // GRANDIOSE STRUCTURE 3: The Stonehenge Ring of Monoliths (Center Arena Enclosure)
    let centerPillarCoords = [
        {x: 12, z: 16}, {x: 20, z: 16}, {x: 16, z: 12}, {x: 16, z: 20},
        {x: 13, z: 13}, {x: 19, z: 19}, {x: 13, z: 19}, {x: 19, z: 13}
    ];
    centerPillarCoords.forEach(p => {
        g_map[p.x][p.z] = 5;
        g_blockType[p.x][p.z] = 2;
    });
    g_map[16][16] = 1; g_blockType[16][16] = 2;

    // COHESIVE DECORATIVE DESIGN 1: Grand Obsidian Archway Gate (Front-Right Corner Space Filler)
    // Two high flanking stone support posts supporting a walkable overhead connector beam bridge
    g_map[22][6] = 4; g_blockType[22][6] = 2; 
    g_map[26][6] = 4; g_blockType[26][6] = 2; 

    // COHESIVE DECORATIVE DESIGN 2: Ancient Ruined Sarcophagus Crypt (Back-Left Corner Space Filler)
    // Structured burial tomb foundational outlines decorated with structural corner torches
    for (let x = 4; x <= 8; x++) {
        for (let z = 23; z <= 27; z++) {
            if (x === 4 || x === 8 || z === 23 || z === 27) {
                g_map[x][z] = 2;
                g_blockType[x][z] = 2;
            }
        }
    }
    let cryptCorners = [{x:4, z:23}, {x:4, z:27}, {x:8, z:23}, {x:8, z:27}];
    cryptCorners.forEach(c => {
        g_map[c.x][c.z] = 3;
        g_blockType[c.x][c.z] = 5; // Torch post identifier layout mapping
    });

    // STRUCTURE PATH LIGHTING: Firelit Torch Posts flanking path junctions and entrance thresholds
    let decorativeTorches = [
        {x: 24, z: 20}, {x: 26, z: 20}, // Flanking the Ziggurat main entrance ramp
        {x: 10, z: 5},  {x: 10, z: 7},  // Flanking the Colosseum side entry gate
        {x: 14, z: 14}, {x: 14, z: 18}, {x: 18, z: 14}, {x: 18, z: 18}  // Illuminating central monolith sectors
    ];
    decorativeTorches.forEach(tp => {
        g_map[tp.x][tp.z] = 3;
        g_blockType[tp.x][tp.z] = 5; 
    });

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

    let u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    let u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
    let u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
    let u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
    let u_whichTexture = gl.getUniformLocation(gl.program, 'u_whichTexture');
    let u_FogColor = gl.getUniformLocation(gl.program, 'u_FogColor');
    let u_happyWeight = gl.getUniformLocation(gl.program, 'u_happyWeight');

    g_camera = new Camera(canvas);

    document.onkeydown = function(ev) {
        g_keysPressed[ev.key.toLowerCase()] = true;
        if (ev.key === 'f' || ev.key === 'F') modifyVoxelBlock(1);
        if (ev.key === 'g' || ev.key === 'G') modifyVoxelBlock(-1);
    };
    
    document.onkeyup = function(ev) {
        g_keysPressed[ev.key.toLowerCase()] = false;
    };

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
        let fps = 1 / (now - g_lastFrameTime);
        g_lastFrameTime = now;
        document.getElementById('fps').innerText = "FPS: " + Math.round(fps);

        processInputStateLoop();
        updateTerrainHeightTrackingLoop();
        
        if (g_goldCollected === 3) {
            if (g_happyWeight < 1.0) {
                g_happyWeight += 0.015; 
                if (g_happyWeight > 1.0) g_happyWeight = 1.0;
            }
            if (g_horseYOffset > 0.0) {
                g_horseYOffset -= 0.05; 
                if (g_horseYOffset < 0.0) g_horseYOffset = 0.0;
            }
        }

        gl.uniform1f(u_happyWeight, g_happyWeight);
        renderScene(gl, u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, u_FragColor, u_whichTexture, u_FogColor);
        requestAnimationFrame(tick);
    }
    tick();
}

function processInputStateLoop() {
    let walkSpeed = 0.08;
    let turnSpeed = 1.5;
    
    let preMoveX = g_camera.eye.elements[0];
    let preMoveZ = g_camera.eye.elements[2];
    let preAtX = g_camera.at.elements[0];
    let preAtZ = g_camera.at.elements[2];
    
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
            g_camera.eye.elements[0] = preMoveX;
            g_camera.eye.elements[2] = preMoveZ;
            g_camera.at.elements[0] = preAtX;
            g_camera.at.elements[2] = preAtZ;
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
    let f = new Vector3();
    f.set(g_camera.at); f.sub(g_camera.eye); f.elements[1] = 0; f.normalize(); f.mul(1.5);
    let mapX = Math.floor((g_camera.eye.elements[0] + f.elements[0]) + 16);
    let mapZ = Math.floor((g_camera.eye.elements[2] + f.elements[2]) + 16);
    
    if (mapX >= 0 && mapX < 32 && mapZ >= 0 && mapZ < 32) {
        let wallHeight = g_map[mapX][mapZ];
        
        if (actionType === -1 && wallHeight > 0) {
            for (let i = 0; i < g_treasurePositions.length; i++) {
                let t = g_treasurePositions[i];
                if (t.x === mapX && t.z === mapZ && !t.harvested) {
                    t.harvested = true;
                    g_goldCollected++;
                    document.getElementById('game-status').innerText = "Relics Cleansed: " + g_goldCollected + " / 3";
                    
                    if (g_goldCollected === 3) {
                        document.getElementById('main-title').innerText = "The Radiant Sanctuary";
                        document.getElementById('main-title').style.color = "#00ffcc";
                        document.getElementById('quest-header').style.color = "#00ffcc";
                        document.getElementById('game-status').style.color = "#00ffcc";
                        document.getElementById('quest-card').style.borderLeftColor = "#00ffcc";
                        document.getElementById('story-text').innerHTML = "<span class='victory-banner'>VICTORY SURGE! The dark energy has dissipated, the floating island has vanished, and the horse safely landed on the plains grid ground!</span>";
                    }
                }
            }
        }

        if (actionType === 1 && wallHeight < 4) {
            g_map[mapX][mapZ]++;
        } else if (actionType === -1 && wallHeight > 0) {
            g_map[mapX][mapZ]--;
        }
        updateTargetTelemetry();
    }
}

function updateTargetTelemetry() {
    let f = new Vector3();
    f.set(g_camera.at); f.sub(g_camera.eye); f.elements[1] = 0; f.normalize(); f.mul(1.5);
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

function drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, matrix, color, textureTypeFlag) {
    gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);
    gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
    gl.uniform1i(u_whichTexture, textureTypeFlag);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, g_vertexBuffer);
    let a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, g_uvBuffer);
    let a_UV = gl.getAttribLocation(gl.program, 'a_UV');
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_UV);
    
    gl.drawArrays(gl.TRIANGLES, 0, 36);
}

function renderScene(gl, u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, u_FragColor, u_whichTexture, u_FogColor) {
    let t = performance.now() / 1000;

    let pulseFactor = Math.sin(t * 0.25) * 0.5 + 0.5;

    let evilSkyR = 0.12 + 0.05 * Math.sin(t * 0.3); 
    let evilSkyG = 0.04;
    let evilSkyB = 0.06;
    
    let happySkyR = 0.45 + 0.05 * Math.cos(t * 0.2); 
    let happySkyG = 0.72;
    let happySkyB = 0.95;
    
    let skyR = mixColors(mixColors(evilSkyR, evilSkyR + 0.04 * pulseFactor, pulseFactor), happySkyR, g_happyWeight);
    let skyG = mixColors(evilSkyG, happySkyG, g_happyWeight);
    let skyB = mixColors(mixColors(evilSkyB, evilSkyB + 0.05 * pulseFactor, pulseFactor), happySkyB, g_happyWeight);

    gl.clearColor(skyR, skyG, skyB, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform4f(u_FogColor, skyR, skyG, skyB, 1.0);

    gl.uniformMatrix4fv(u_ViewMatrix, false, g_camera.viewMatrix.elements);
    gl.uniformMatrix4fv(u_ProjectionMatrix, false, g_camera.projectionMatrix.elements);

    // Sky Box
    let skyMat = new Matrix4();
    skyMat.translate(-500, -500, -500);
    skyMat.scale(1000, 1000, 1000);
    drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, skyMat, [skyR, skyG, skyB, 1.0], 0);

    // Procedural Ground terrain plane maps
    for (let x = 0; x < 32; x++) {
        for (let z = 0; z < 32; z++) {
            let groundTerrainMatrix = new Matrix4();
            let terrainHeight = 0.25 * Math.sin(x * 0.35) * Math.cos(z * 0.35);
            groundTerrainMatrix.translate(x - 16, terrainHeight - 0.1, z - 16);
            groundTerrainMatrix.scale(1.0, 0.1, 1.0);
            drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, groundTerrainMatrix, [1.0, 1.0, 1.0, 1.0], 1);
        }
    }

    // Main Voxel Citadel Rendering Loops
    for (let x = 0; x < 32; x++) {
        for (let z = 0; z < 32; z++) {
            let wallHeight = g_map[x][z];
            let baseTerrainOffset = 0.25 * Math.sin(x * 0.35) * Math.cos(z * 0.35);
            
            for (let y = 0; y < wallHeight; y++) {
                let wallMat = new Matrix4();
                wallMat.translate(x - 16, y + baseTerrainOffset, z - 16);
                
                let activeTex = g_blockType[x][z]; 
                let isTreasure = false;
                
                for (let i = 0; i < g_treasurePositions.length; i++) {
                    let treasure = g_treasurePositions[i];
                    if (treasure.x === x && treasure.z === z && !treasure.harvested && y === (wallHeight - 1)) {
                        isTreasure = true;
                    }
                }
                
                if (isTreasure) {
                    activeTex = 3; 
                    drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, wallMat, [1.0, 1.0, 1.0, 1.0], activeTex);
                } else if (activeTex === 5) {
                    // Multi-sample Torch Post Texturing layout mapping
                    if (y < (wallHeight - 1)) {
                        drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, wallMat, [1.0, 1.0, 1.0, 1.0], 2); // Dark stone stand post base
                    } else {
                        drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, wallMat, [1.0, 1.0, 1.0, 1.0], 5); // Burning pixelated fire element tip
                    }
                } else {
                    drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, wallMat, [1.0, 1.0, 1.0, 1.0], activeTex);
                }
            }

            // Render cross-beam lintel blocks for the Grand Obsidian Archway Gate structure
            if (x >= 23 && x <= 25 && z === 6) {
                let archMat = new Matrix4();
                archMat.translate(x - 16, 3.0 + baseTerrainOffset, z - 16);
                drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, archMat, [1.0, 1.0, 1.0, 1.0], 2);
            }

            // Scriptorium Ziggurat Inner Sanctuary Shading
            if (x >= 23 && x <= 27 && z >= 23 && z <= 27) {
                let caveCeilingMat = new Matrix4();
                caveCeilingMat.translate(x - 16, 4.0 + baseTerrainOffset, z - 16);
                drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, caveCeilingMat, [1.0, 1.0, 1.0, 1.0], 2);
            }

            // High Monolith Spire Hover Accents
            if (wallHeight === 0 && (x > 11 && x < 21) && (z > 11 && z < 21)) {
                if ((x + z) % 4 === 0 && !(x >= 15 && x <= 17 && z >= 15 && z <= 17)) {
                    let islandMat = new Matrix4();
                    islandMat.translate(x - 16, 4.2 + (0.12 * Math.sin(t * 2 + x)), z - 16);
                    drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, islandMat, [1.0, 1.0, 1.0, 1.0], 4);
                }
            }
        }
    }

    // Floating Platform
    if (g_horseYOffset > 0.0) {
        for (let xi = 15; xi <= 17; xi++) {
            for (let zi = 15; zi <= 17; zi++) {
                let islandTerrainOffset = 0.25 * Math.sin(xi * 0.35) * Math.cos(zi * 0.35);
                let customIslandMat = new Matrix4();
                customIslandMat.translate(xi - 16, 3.2 + islandTerrainOffset, zi - 16); 
                drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, customIslandMat, [1.0, 1.0, 1.0, 1.0], 4);
            }
        }
    }

    // Hierarchical Animal
    let animalBaseMatrix = new Matrix4();
    let centerTerrainOffset = 0.25 * Math.sin(16 * 0.35) * Math.cos(16 * 0.35);
    
    animalBaseMatrix.translate(0.0, 0.45 + centerTerrainOffset + g_horseYOffset, 0.0);
    animalBaseMatrix.scale(0.6, 0.6, 0.6);
    
    let torsoMatrix = new Matrix4(animalBaseMatrix).translate(-0.4, 0.0, -0.2);
    drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, new Matrix4(torsoMatrix).scale(0.8, 0.4, 0.4), [0.4, 0.25, 0.15, 1.0], 0);

    let neckMatrix = new Matrix4(torsoMatrix).translate(0.7, 0.35, 0.1);
    neckMatrix.rotate(-25 + (Math.sin(t * 5) * 8), 0, 0, 1);
    drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, new Matrix4(neckMatrix).scale(0.15, 0.5, 0.15), [0.4, 0.25, 0.15, 1.0], 0);

    let headMatrix = new Matrix4(neckMatrix).translate(-0.05, 0.45, -0.02);
    drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, new Matrix4(headMatrix).scale(0.3, 0.25, 0.2), [0.5, 0.35, 0.2, 1.0], 0);

    function drawHierarchicalLeg(xOffset, zOffset, animPhaseOffset) {
        let thighMatrix = new Matrix4(torsoMatrix).translate(xOffset, 0.1, zOffset);
        let dynamicThighRotation = 25 * Math.sin(t * 5 + animPhaseOffset);
        let dynamicCalfRotation = 20 * Math.sin(t * 5 + animPhaseOffset) + 15;
        let dynamicHoofRotation = 10 * Math.sin(t * 5 + animPhaseOffset);
        
        thighMatrix.rotate(dynamicThighRotation, 0, 0, 1);
        drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, new Matrix4(thighMatrix).scale(0.12, -0.35, 0.1), [0.35, 0.2, 0.1, 1.0], 0);

        let calfMatrix = new Matrix4(thighMatrix).translate(0, -0.35, 0).rotate(dynamicCalfRotation, 0, 0, 1);
        drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, new Matrix4(calfMatrix).scale(0.1, -0.3, 0.1), [0.3, 0.15, 0.05, 1.0], 0);

        let hoofMatrix = new Matrix4(calfMatrix).translate(-0.02, -0.3, -0.02).rotate(dynamicHoofRotation, 0, 0, 1);
        drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, new Matrix4(hoofMatrix).scale(0.14, -0.08, 0.14), [0.1, 0.1, 0.1, 1.0], 0);
    }
    drawHierarchicalLeg(0.65, 0.05, 0); 
    drawHierarchicalLeg(0.65, 0.25, Math.PI);
    drawHierarchicalLeg(0.05, 0.05, Math.PI); 
    drawHierarchicalLeg(0.05, 0.25, 0);

    let tailMatrix = new Matrix4(torsoMatrix).translate(0, 0.35, 0.15);
    tailMatrix.rotate(180 + (30 * Math.sin(t * 8)), 0, 0, 1);
    drawCube(gl, u_ModelMatrix, u_FragColor, u_whichTexture, new Matrix4(tailMatrix).scale(0.45, 0.1, 0.1), [0.1, 0.1, 0.1, 1.0], 0);
}

function mixColors(c1, c2, ratio) {
    return c1 * (1.0 - ratio) + c2 * ratio;
}

window.onload = main;