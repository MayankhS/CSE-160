// Global Variables
let canvas, gl, a_Position, u_FragColor, u_Size;

// Shaders
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform float u_Size;
  void main() {
    gl_Position = a_Position;
    gl_PointSize = u_Size;
  }`;

var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }`;

// --- SHAPE CLASSES ---

class Point {
  constructor() {
    this.type = 'point';
    this.position = [0.0, 0.0, 0.0];
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.size = 5.0;
  }
  render() {
    gl.disableVertexAttribArray(a_Position);
    gl.vertexAttrib3f(a_Position, this.position[0], this.position[1], 0.0);
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniform1f(u_Size, this.size);
    gl.drawArrays(gl.POINTS, 0, 1);
  }
}

class Triangle {
  constructor() {
    this.type = 'triangle';
    this.position = [0.0, 0.0, 0.0];
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.size = 5.0;
  }
  render() {
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniform1f(u_Size, this.size);
    let d = this.size / 200.0; // scale size
    drawTriangle([this.position[0], this.position[1]+d, this.position[0]-d, this.position[1]-d, this.position[0]+d, this.position[1]-d]);
  }
}

class Circle {
  constructor() {
    this.type = 'circle';
    this.position = [0.0, 0.0, 0.0];
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.size = 5.0;
    this.segments = g_selectedSegments;
  }
  render() {
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    let d = this.size / 200.0;
    let step = 360 / this.segments;
    for (var angle = 0; angle < 360; angle += step) {
      let center = [this.position[0], this.position[1]];
      let angle1 = angle;
      let angle2 = angle + step;
      let v1 = [Math.cos(angle1 * Math.PI / 180) * d + center[0], Math.sin(angle1 * Math.PI / 180) * d + center[1]];
      let v2 = [Math.cos(angle2 * Math.PI / 180) * d + center[0], Math.sin(angle2 * Math.PI / 180) * d + center[1]];
      drawTriangle([center[0], center[1], v1[0], v1[1], v2[0], v2[1]]);
    }
  }
}

// Helper to draw a single triangle via buffer
function drawTriangle(vertices) {
  var n = 3;
  var vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);
  gl.drawArrays(gl.TRIANGLES, 0, n);
}

// --- MAIN ENGINE ---

let g_shapesList = [];
let g_selectedColor = [1.0, 0.0, 0.0, 1.0];
let g_selectedSize = 10;
let g_selectedType = 'point';
let g_selectedSegments = 10;

function setupWebGL() {
  canvas = document.getElementById('webgl');
  gl = canvas.getContext("webgl", { preserveDrawingBuffer: true});
}

function connectVariablesToGLSL() {
  initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE);
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_Size = gl.getUniformLocation(gl.program, 'u_Size');
}

function main() {
  setupWebGL();
  connectVariablesToGLSL();

  // Button Listeners
  document.getElementById('pointButton').onclick = function() { g_selectedType = 'point'; };
  document.getElementById('triButton').onclick = function() { g_selectedType = 'triangle'; };
  document.getElementById('circleButton').onclick = function() { g_selectedType = 'circle'; };
  document.getElementById('clearButton').onclick = function() { g_shapesList = []; renderAllShapes(); };

  // Slider Listeners
  document.getElementById('redSlide').addEventListener('input', function() { g_selectedColor[0] = this.value/100; });
  document.getElementById('greenSlide').addEventListener('input', function() { g_selectedColor[1] = this.value/100; });
  document.getElementById('blueSlide').addEventListener('input', function() { g_selectedColor[2] = this.value/100; });
  document.getElementById('sizeSlide').addEventListener('input', function() { g_selectedSize = this.value; });
  document.getElementById('segmentSlide').addEventListener('input', function() { g_selectedSegments = this.value; });

  canvas.onmousedown = click;
  canvas.onmousemove = function(ev) { if(ev.buttons == 1) { click(ev); } };

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function click(ev) {
  let [x, y] = convertCoordinatesEventToGL(ev);
  let shape;
  if (g_selectedType == 'point') shape = new Point();
  else if (g_selectedType == 'triangle') shape = new Triangle();
  else shape = new Circle();

  shape.position = [x, y];
  shape.color = [...g_selectedColor];
  shape.size = g_selectedSize;
  g_shapesList.push(shape);

  renderAllShapes();
}

function convertCoordinatesEventToGL(ev) {
  var x = ev.clientX, y = ev.clientY;
  var rect = ev.target.getBoundingClientRect();
  x = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
  y = (canvas.height/2 - (y - rect.top))/(canvas.height/2);
  return [x, y];
}

function renderAllShapes() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  for(var i = 0; i < g_shapesList.length; i++) {
    g_shapesList[i].render();
  }
}