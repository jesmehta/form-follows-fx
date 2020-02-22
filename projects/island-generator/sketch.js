let x0, y0, t, step;
let img;
let b;                          //no of bandgaps
// let pd;                      //pixel Density
let elev;                       //exponent for sealevel
let slBands, slElev, slIsle;  //sliders
let pBands, pElev, pIsle;

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

  createP(""); //spacing

  pBands = createP("Bands");
  slBands = createSlider(2,20,15,1);

  pElev = createP("Elevation exponent");
  slElev = createSlider(0.1,5,1,0.1);

  pIsle = createP("Island factor");
  slIsle = createSlider(0.1,3,1,0.1);


}

function draw() {
  // background(128);
  b = slBands.value();
  elev = slElev.value();
  let d;

  print(b, elev);
  for (let j = 0; j < height; j = j + step)
  {
    for (let i = 0; i < width; i = i + step)
    {
      let n0 = noise(x0, y0);    //generate noise
      n = pow(n0,elev);          //exponent to elevate

      let ds = dist(i,j,width/2,height/2);
      let isleFac = slIsle.value();
      d = ds/(width*isleFac);

      isl = (1+n-d)/2;             //island-ification

      fb = int(map(isl, 0, 1, 0, b));  //banding

      f = (map(fb,0,b,0,255));       //map fill

      img.set(i,j,color(f));        //set fill

      x0 += t;
    }
    y0 += t;
    x0 = 0;
  }
  y0 = 0;     //comment this out to allow change

  img.updatePixels();
  image(img,0,0);

  pBands.html("Bands : " + slBands.value());
  pElev.html("Elevation exponent : " + slElev.value());
  pIsle.html("Island factor : " + slIsle.value());

}

function keyPressed()
{
  if(key == s)
  {
    saveFile();
  }
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
