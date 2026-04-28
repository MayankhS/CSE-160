// Shaders
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotationMatrix;
  void main() {
    gl_Position = u_GlobalRotationMatrix * u_ModelMatrix * a_Position;
  }`;

var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }`;

// Global State
let g_globalAngle = 0;
let g_ani = true;
let g_poke = false;
let g_pokeStartTime = 0; // Corrected variable
let g_mouseRotation = [0, 0];
let g_lastFrameTime = performance.now()/1000;
let g_startTime = performance.now()/1000;

// Joint Angles for Sliders
let g_flThigh = 0, g_flCalf = 0, g_flHoof = 0;
let g_neckAngle = 0, g_tailAngle = 0;

// Performance Optimization: Global Buffers
let g_vertexBuffer = null;
let g_cylinderBuffer = null;
let g_cylinderVertCount = 0;

function main() {
    let canvas = document.getElementById('webgl');
    let gl = getWebGLContext(canvas); //
    if (!gl) return;
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) return;

    gl.enable(gl.DEPTH_TEST); //
    gl.clearColor(0.15, 0.15, 0.15, 1.0);

    // Initialize Buffers ONCE
    initBuffers(gl);

    let u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    let u_GlobalRotationMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotationMatrix');
    let u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');

    // UI Listeners
    document.getElementById('angleSlide').oninput = function() { g_globalAngle = this.value; };
    document.getElementById('flThighSlide').oninput = function() { g_flThigh = this.value; };
    document.getElementById('flCalfSlide').oninput = function() { g_flCalf = this.value; };
    document.getElementById('flHoofSlide').oninput = function() { g_flHoof = this.value; };
    document.getElementById('neckSlide').oninput = function() { g_neckAngle = this.value; };
    document.getElementById('tailSlide').oninput = function() { g_tailAngle = this.value; };
    document.getElementById('aniOn').onclick = function() { g_ani = true; };
    document.getElementById('aniOff').onclick = function() { g_ani = false; };
    
    // Interaction
    canvas.onmousedown = function(ev) { 
        if(ev.shiftKey) { 
            g_poke = true; 
            g_pokeStartTime = performance.now()/1000; 
        } 
    };
    canvas.onmousemove = function(ev) { 
        if(ev.buttons == 1) { 
            g_mouseRotation[0] -= ev.movementX; 
            g_mouseRotation[1] -= ev.movementY; 
        } 
    };

    requestAnimationFrame(() => tick(gl, u_ModelMatrix, u_GlobalRotationMatrix, u_FragColor));
}

function initBuffers(gl) {
    // Cube Buffer
    g_vertexBuffer = gl.createBuffer();
    let cubeVertices = new Float32Array([
        0,0,0, 1,1,0, 1,0,0,  0,0,0, 0,1,0, 1,1,0, // Front
        0,0,1, 1,0,1, 1,1,1,  0,0,1, 1,1,1, 0,1,1, // Back
        0,1,0, 0,1,1, 1,1,1,  0,1,0, 1,1,1, 1,1,0, // Top
        0,0,0, 1,0,0, 1,0,1,  0,0,0, 1,0,1, 0,0,1, // Bottom
        1,0,0, 1,1,0, 1,1,1,  1,0,0, 1,1,1, 1,0,1, // Right
        0,0,0, 0,0,1, 0,1,1,  0,0,0, 0,1,1, 0,1,0  // Left
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, g_vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVertices, gl.STATIC_DRAW);

    // Cylinder Buffer (Non-cube primitive requirement)
    g_cylinderBuffer = gl.createBuffer();
    let cylVerts = [];
    let segs = 12;
    for (let i = 0; i < segs; i++) {
        let a1 = (i / segs) * 2 * Math.PI, a2 = ((i + 1) / segs) * 2 * Math.PI;
        let x1 = Math.cos(a1), z1 = Math.sin(a1), x2 = Math.cos(a2), z2 = Math.sin(a2);
        cylVerts.push(x1, 0, z1, x2, 1, z2, x1, 1, z1, x1, 0, z1, x2, 0, z2, x2, 1, z2); // Sides
        cylVerts.push(0, 1, 0, x1, 1, z1, x2, 1, z2, 0, 0, 0, x2, 0, z2, x1, 0, z1); // Caps
    }
    g_cylinderVertCount = cylVerts.length / 3;
    gl.bindBuffer(gl.ARRAY_BUFFER, g_cylinderBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cylVerts), gl.STATIC_DRAW);
}

function drawPart(gl, buffer, vertCount, matrix, u_ModelMatrix, u_FragColor, color) {
    gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements); //
    gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    let a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    gl.drawArrays(gl.TRIANGLES, 0, vertCount);
}

function renderScene(gl, u_ModelMatrix, u_GlobalRotationMatrix, u_FragColor) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    let t = performance.now() / 1000;

    let globalRotMat = new Matrix4().rotate(g_globalAngle, 0, 1, 0)
                                     .rotate(g_mouseRotation[0], 0, 1, 0)
                                     .rotate(g_mouseRotation[1], 1, 0, 0);
    gl.uniformMatrix4fv(u_GlobalRotationMatrix, false, globalRotMat.elements);

    // --- BODY ---
    let bodyMat = new Matrix4().translate(-0.4, -0.2, 0.0);
    drawPart(gl, g_vertexBuffer, 36, new Matrix4(bodyMat).scale(0.8, 0.4, 0.4), u_ModelMatrix, u_FragColor, [0.4, 0.25, 0.15, 1.0]);

    // --- NECK (Non-cube Cylinder) ---
    let neckMat = new Matrix4(bodyMat).translate(0.7, 0.35, 0.2);
    neckMat.rotate(-25 + (g_ani ? Math.sin(t * 5) * 10 : g_neckAngle) + (g_poke ? Math.sin(t * 40) * 15 : 0), 0, 0, 1);
    drawPart(gl, g_cylinderBuffer, g_cylinderVertCount, new Matrix4(neckMat).scale(0.12, 0.5, 0.12), u_ModelMatrix, u_FragColor, [0.4, 0.25, 0.15, 1.0]);

    // --- HEAD ---
    let headMat = new Matrix4(neckMat).translate(-0.1, 0.45, -0.1);
    drawPart(gl, g_vertexBuffer, 36, new Matrix4(headMat).scale(0.35, 0.25, 0.2), u_ModelMatrix, u_FragColor, [0.5, 0.35, 0.2, 1.0]);

    // --- LEGS (3-Level Chain) ---
    function drawLeg(x, z, offset) {
        let thigh = new Matrix4(bodyMat).translate(x, 0.1, z);
        let a1 = g_ani ? 25 * Math.sin(t * 5 + offset) : g_flThigh;
        let a2 = g_ani ? 20 * Math.sin(t * 5 + offset) + 15 : g_flCalf;
        let a3 = g_ani ? 10 * Math.sin(t * 5 + offset) : g_flHoof;
        
        thigh.rotate(a1, 0, 0, 1);
        drawPart(gl, g_vertexBuffer, 36, new Matrix4(thigh).scale(0.12, -0.35, 0.1), u_ModelMatrix, u_FragColor, [0.35, 0.2, 0.1, 1.0]);

        let calf = new Matrix4(thigh).translate(0, -0.35, 0).rotate(a2, 0, 0, 1);
        drawPart(gl, g_vertexBuffer, 36, new Matrix4(calf).scale(0.1, -0.3, 0.1), u_ModelMatrix, u_FragColor, [0.3, 0.15, 0.05, 1.0]);

        let hoof = new Matrix4(calf).translate(-0.02, -0.3, -0.02).rotate(a3, 0, 0, 1);
        drawPart(gl, g_vertexBuffer, 36, new Matrix4(hoof).scale(0.14, -0.08, 0.14), u_ModelMatrix, u_FragColor, [0.1, 0.1, 0.1, 1.0]);
    }
    drawLeg(0.65, 0.05, 0); drawLeg(0.65, 0.25, Math.PI);
    drawLeg(0.05, 0.05, Math.PI); drawLeg(0.05, 0.25, 0);

    // --- TAIL (Fixed: Swings OUTWARD behind horse) ---
    let tailMat = new Matrix4(bodyMat).translate(0, 0.35, 0.2);
    tailMat.rotate(180 + (g_ani ? 30 * Math.sin(t * 8) : g_tailAngle), 0, 0, 1);
    drawPart(gl, g_vertexBuffer, 36, new Matrix4(tailMat).scale(0.45, 0.1, 0.1), u_ModelMatrix, u_FragColor, [0.1, 0.1, 0.1, 1.0]);
}

function tick(gl, u_M, u_GR, u_FC) {
    let now = performance.now() / 1000;
    if (g_poke && (now - g_pokeStartTime > 1.5)) g_poke = false;

    // Performance indicator optimization
    let fps = 1 / (now - g_lastFrameTime);
    g_lastFrameTime = now;
    document.getElementById('fps').innerText = "FPS: " + Math.round(fps);

    renderScene(gl, u_M, u_GR, u_FC);
    requestAnimationFrame(() => tick(gl, u_M, u_GR, u_FC)); //
}