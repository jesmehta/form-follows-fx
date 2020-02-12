let x0, y0, t, step;
let img;

function setup() {
  frameRate(30);
  createCanvas(400, 400);
  colorMode(HSB);
  noStroke();
  x0 = 0;
  y0 = 0;
  t = 0.05;
  step = 1;
  img = createImage(width,height);
  img.loadPixels();
}

function draw() {
  // background(128);
  for (let j = 0; j < height; j = j + step)
  {
    for (let i = 0; i < width; i = i + step)
    {
      let n = noise(x0, y0);
      let f = map(n, 0, 1, 0, 255);
      fill(f);
      ellipse(i, j, step*2, step*2);
      let index = (i + j * width) *4;
      img.pixels[index] = f;
      img.pixels[index + 1] = f;
      img.pixels[index + 2] = f;
      img.pixels[index + 3] = 1;

      x0 += t;
    }
    y0 += t;
    x0 = 0;
  }
  // y0 = 0;     //comment this out to allow change
  img.updatePixels();
  image(img,0,0);
}
