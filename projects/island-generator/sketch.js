/*
Notes :
- Isle factor eliminated and brought back.
Initially used to focus landmass as an island,
now with changed "point of origin" that the distances are measured from,
i.e island high points are at 1/3 width and height instead of centre

- When unused, was used to map 0-255 of thre max height, usually 150 was good, so hardcoded

- value of t, the Perlin increment, gives interesting variations
ranging from very smooth to chaotic

- colour version was attempted, and works,
switching between colour and BW did not work
Col version looks like thermal imaging.

- To Do - Update the draw loop to
a. Make as many functions as possible
b. Only re-Draw canvas when updates are needed else it's wasteful on processing power
b2. Some things can be computed in setup and maintained
(all things can be, but then no live updates)

c. Mouse-click to Island focus ?
d. Islanding was interesting when using distance from an edge as well, instead of points
e. Multiple islands when clicked, and distance from the nearest is used in IsleElev



*/
let x0, y0, t, step;
let img;
let b;                          //no of bandgaps
// let pd;                      //pixel Density
let elev;                       //exponent for sealevel
let slBands, slElev, slIsle;  //sliders
let pBands, pElev, pIsle;
let btSave, btNew, btCol;
let fillFlag;

function setup() {
  frameRate(30);
  createCanvas(420, 594);
  colorMode(HSB);
  noStroke();

  x0 = 0;
  y0 = 0;
  t = 0.01;
  step = 1;
  img = createImage(width,height);
  img.loadPixels();
  b = 8;
  // background(128);
  // stroke(128);

  createP(""); //spacing

  pBands = createP("Bands");
  slBands = createSlider(2,30,18,1);

  pElev = createP("Elevation exponent");
  slElev = createSlider(0.3,3,1,0.1);

  pIsle = createP("Max Elevation (255)");
  // slIsle = createSlider(0,255,150,1);
  slIsle = createSlider(0,3,1,0.1);

  createP(""); //spacing

  btSave = createButton("Save Image");
  btSave.mouseClicked(saveFile);

  btNew = createButton("New Scape");
  btNew.mouseClicked(newRandom);

  // btCol = createButton("MonoColour");
  // btCol.mouseClicked(fillSet);
  // fillFlag = TRUE;

  createP("key s to save file"); //spacing


}

function draw() {
  // background(128);
  x_ = x0;
  y_ = y0;

  b = slBands.value();
  elev = slElev.value();
  let d;

  print(b, elev);
  for (let j = 0; j < height; j = j + step)
  {
    for (let i = 0; i < width; i = i + step)
    {
      let n0 = noise(x_, y_);    //generate noise
      n = pow(n0,elev);          //exponent to elevate

      // let maxElev = slIsle.value();
      let maxElev = 150;
      let ds = dist(i,j,width/3,height/3);
      let isleFac = slIsle.value();
      d = ds/(width*isleFac);
      isl = (1+n-d)/2;             //island-ification
      // isl = n;

      fb = int(map(isl, 0, 1, 0, b));  //banding

      // if(fillFlag == TRUE)
      // {
      //   f = (map(fb,0,b,0,maxElev));       //map fill\
      //   img.set(i,j,color(f));
      // }
      // else {
      //   f = (map(fb,0,b,0,360));       //map fill
      //   img.set(i,j,color(f,100,100));
      // }


      f = (map(fb,0,b,0,maxElev));       //map fill\

      img.set(i,j,color(f));        //set fill

      x_ += t;
    }
    y_ += t;
    x_ = x0;
  }
  y_ = y0;     //comment this out to allow change

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

function newRandom()
{
  x0 = random(0,20);
  y0 = random(0,20);
}

function fillSet()
{
  fillFlag = !fillFlag;
}
