let x0, y0, t, step;
let img;
let b;                    //no of bandgaps
// let pd;                   //pixel Density
let elev;                 //exponent for sealevel

function setup() {
  frameRate(30);
  createCanvas(400, 400);
  colorMode(HSB);
  noStroke();

  x0 = 0;
  y0 = 0;
  t = 0.02;
  step = 1;
  img = createImage(width,height);
  img.loadPixels();
  b = 8;
  // background(128);
  // stroke(128);


}

function draw() {
  // background(128);
  b = int(map(mouseX,0,width,2,15));
  elev = map(mouseY,0,height,0.1,5);
  // elev = 1.7;
  // b = 12;
  print(b, elev);
  for (let j = 0; j < height; j = j + step)
  {
    for (let i = 0; i < width; i = i + step)
    {
      let n0 = noise(x0, y0);
      let n = pow(n0,elev);

      // e = (1 + e - d) / 2
      let ds = dist(i,j,width/2,height/2);
      let d = ds/(width*0.5);
      let isle = (1+n-d)/2;

      let f_ = int(map(isle, 0, 1, 0, b));

      let f = (map(f_,0,b,0,255));

      img.set(i,j,color(f));

      x0 += t;
    }
    y0 += t;
    x0 = 0;
  }
  y0 = 0;     //comment this out to allow change
  img.updatePixels();
  image(img,0,0);
}

function mouseClicked()
{
  saveFile();
}

function saveFile()
{
  let el = int(elev*100)/100;
  saveCanvas("contour " + b + " " + el + " " + timeStamp() +".jpg");
  print("file saved");
}

function timeStamp()
{
  let m = checkPad(month());
  let d = checkPad(day());
  let h = checkPad(hour());
  let mm = checkPad(minute());
  let s = checkPad(second());

  let t = year()+m+d+"_"+h+mm+s;
  return t;
}

function checkPad(k)
{
  let p = str(k);
  if (k<10)
  {
    p = "0" + str(k);
  }
  return p;
}
