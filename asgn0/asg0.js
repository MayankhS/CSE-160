var canvas;
var ctx;

function main() {
    canvas = document.getElementById('cnv1');
    ctx = canvas.getContext('2d');
    
    // Clear to black initially
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 400, 400);
}

function drawVector(v, color) {
    ctx.strokeStyle = color;
    let cx = 200; // Center X
    let cy = 200; // Center Y
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    // Objective 2: Scale coordinates by 20. 
    // We subtract Y because in Canvas, "down" is positive.
    ctx.lineTo(cx + v.elements[0] * 20, cy - v.elements[1] * 20);
    ctx.stroke();
}

function handleDrawEvent() {
    // Clear canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 400, 400);
    
    // Objective 3 & 4: Get input values and draw v1/v2
    let v1 = new Vector3([document.getElementById('v1x').value, document.getElementById('v1y').value, 0]);
    let v2 = new Vector3([document.getElementById('v2x').value, document.getElementById('v2y').value, 0]);
    
    drawVector(v1, "red");
    drawVector(v2, "blue");
}

function handleDrawOperationEvent() {
    handleDrawEvent(); // Clear and redraw the basics
    
    let v1 = new Vector3([document.getElementById('v1x').value, document.getElementById('v1y').value, 0]);
    let v2 = new Vector3([document.getElementById('v2x').value, document.getElementById('v2y').value, 0]);
    let op = document.getElementById('operation').value;
    let s = parseFloat(document.getElementById('scalar').value);

    // Objective 5-8 Logic
    if (op === "add") {
        let v3 = new Vector3(v1.elements).add(v2);
        drawVector(v3, "green");
    } else if (op === "sub") {
        let v3 = new Vector3(v1.elements).sub(v2);
        drawVector(v3, "green");
    } else if (op === "mul") {
        drawVector(new Vector3(v1.elements).mul(s), "green");
        drawVector(new Vector3(v2.elements).mul(s), "green");
    } else if (op === "div") {
        drawVector(new Vector3(v1.elements).div(s), "green");
        drawVector(new Vector3(v2.elements).div(s), "green");
    } else if (op === "mag") {
        console.log("v1 Magnitude:", v1.magnitude(), "v2 Magnitude:", v2.magnitude());
    } else if (op === "norm") {
        drawVector(new Vector3(v1.elements).normalize(), "green");
        drawVector(new Vector3(v2.elements).normalize(), "green");
    } else if (op === "angle") {
        let dot = Vector3.dot(v1, v2);
        let angle = Math.acos(dot / (v1.magnitude() * v2.magnitude())) * (180 / Math.PI);
        console.log("Angle:", angle);
    } else if (op === "area") {
        let area = Vector3.cross(v1, v2).magnitude() / 2;
        console.log("Area of triangle:", area);
    }
}