var song;
var fft;
var backgroundImage;
var scaleFactor = 0.19;
var zoomSpeed = 0.00005;
var ghostTrails = [];
var fadeAmount = 30;

function preload() {
    audio1 = loadSound('final-mix.mp3');
    backgroundImage = loadImage('Digital for Kai-min.png');
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    fft = new p5.FFT();
    audio1.play();
}

function draw() {
    imageMode(CENTER);
    scaleFactor += zoomSpeed;
    image(backgroundImage, width / 2, height / 2, backgroundImage.width * scaleFactor, backgroundImage.height * scaleFactor);
    strokeWeight(10);
    noFill();

    var wave = fft.waveform();
    var maxRadius = min(width, height) * 0.2;

    ghostTrails.push({ wave: wave.slice(), radius: maxRadius });

    for (var t = 0; t < ghostTrails.length; t++) {
        var alpha = 255 - t * fadeAmount;
        stroke(255, 100, 30, alpha);
        beginShape();
        for (var i = 0; i < ghostTrails[t].wave.length; i++) {
            var angle = map(i, 0, ghostTrails[t].wave.length, 0, TWO_PI);
            var x = width / 2 + cos(angle) * (ghostTrails[t].radius + ghostTrails[t].wave[i] * 100);
            var y = height / 2 + sin(angle) * (ghostTrails[t].radius + ghostTrails[t].wave[i] * 100);
            vertex(x, y);
        }
        endShape();
        
        ghostTrails[t].radius -= 10;
    }

    if (ghostTrails.length > 30) {
        ghostTrails.splice(0, 1);
    }

    drawAdditionalWaveform(wave, maxRadius * 4, 0, 0.2, 10);
    drawAdditionalWaveform(wave, maxRadius * 1, 255, 204, 100, 0.1);
    drawAdditionalWaveform(wave, maxRadius * 0.2, 255, 220, 100, 0.1, 7);
}

function drawAdditionalWaveform(wave, radius, r, g, b, scaleFactor, weight) {
    stroke(r, g, b);
    strokeWeight(weight);
    beginShape();
    for (var i = 0; i < wave.length; i += 5) {
        var angle = map(i, 0, wave.length, 0, TWO_PI);
        var x = width / 2 + cos(angle) * (radius + wave[i] * 50);
        var y = height / 2 + sin(angle) * (radius + wave[i] * 50);
        vertex(x, y);
    }
    endShape();
}
