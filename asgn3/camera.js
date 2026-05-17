class Camera {
  constructor(canvas) {
    this.fov = 60.0;
    this.eye = new Vector3([0.0, 0.7, 6.0]);
    this.at = new Vector3([0.0, 0.7, 5.0]);
    this.up = new Vector3([0.0, 1.0, 0.0]);

    this.viewMatrix = new Matrix4();
    this.projectionMatrix = new Matrix4();
    
    this.canvas = canvas;
    this.updateProjection();
    this.updateView();
  }

  updateView() {
    this.viewMatrix.setLookAt(
      this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
      this.at.elements[0], this.at.elements[1], this.at.elements[2],
      this.up.elements[0], this.up.elements[1], this.up.elements[2]
    );
  }

  updateProjection() {
    if (this.canvas) {
      this.projectionMatrix.setPerspective(
        this.fov, 
        this.canvas.width / this.canvas.height, 
        0.1, 
        1000.0
      );
    }
  }

  moveForward(speed) {
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    f.elements[1] = 0; 
    f.normalize();
    f.mul(speed);
    
    this.eye.add(f);
    this.at.add(f);
    this.updateView();
  }

  moveBackwards(speed) {
    let b = new Vector3();
    b.set(this.eye);
    b.sub(this.at);
    b.elements[1] = 0; 
    b.normalize();
    b.mul(speed);
    
    this.eye.add(b);
    this.at.add(b);
    this.updateView();
  }

  moveLeft(speed) {
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    f.elements[1] = 0;
    
    let s = Vector3.cross(this.up, f); 
    s.elements[1] = 0; 
    s.normalize();
    s.mul(speed);
    
    this.eye.add(s);
    this.at.add(s);
    this.updateView();
  }

  moveRight(speed) {
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    f.elements[1] = 0;
    
    let s = Vector3.cross(f, this.up);
    s.elements[1] = 0; 
    s.normalize();
    s.mul(speed);
    
    this.eye.add(s);
    this.at.add(s);
    this.updateView();
  }

  panLeft(alpha) {
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    
    let rotationMatrix = new Matrix4();
    rotationMatrix.setRotate(alpha, this.up.elements[0], this.up.elements[1], this.up.elements[2]);
    
    let f_prime = rotationMatrix.multiplyVector3(f);
    
    this.at.set(this.eye);
    this.at.add(f_prime);
    this.updateView();
  }

  panRight(alpha) {
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    
    let rotationMatrix = new Matrix4();
    rotationMatrix.setRotate(-alpha, this.up.elements[0], this.up.elements[1], this.up.elements[2]);
    
    let f_prime = rotationMatrix.multiplyVector3(f);
    
    this.at.set(this.eye);
    this.at.add(f_prime);
    this.updateView();
  }

  panUpDown(alpha) {
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    
    let r = Vector3.cross(f, this.up);
    r.normalize();
    
    let rotationMatrix = new Matrix4();
    rotationMatrix.setRotate(alpha, r.elements[0], r.elements[1], r.elements[2]);
    
    let f_prime = rotationMatrix.multiplyVector3(f);
    
    let horizontalProjectionLength = Math.sqrt(f_prime.elements[0] * f_prime.elements[0] + f_prime.elements[2] * f_prime.elements[2]);
    if (horizontalProjectionLength > 0.1) {
        this.at.set(this.eye);
        this.at.add(f_prime);
        this.updateView();
    }
  }
}