let x0, y0, t, step;
let img;
let b;                    //no of bandgaps
// let pd;                   //pixel Density

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
  b = 8;
  // background(128);
  // stroke(128);


}

function draw() {
  // background(128);
  for (let j = 0; j < height; j = j + step)
  {
    for (let i = 0; i < width; i = i + step)
    {
      let n = noise(x0, y0);

      let f_ = int(map(n, 0, 1, 0, b));
      let f = int(map(f_,0,b,0,128));

      img.set(i,j,color(f));


      x0 += t;
    }
    y0 += t;
    x0 = 0;
  }
  // y0 = 0;     //comment this out to allow change
  img.updatePixels();
  image(img,0,0);
}
