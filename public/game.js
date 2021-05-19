
const colors = ['#262312', '#D9C99A', '#F2E1AE', '#BFA87E', '#0D0D0D', '#B30054', '#19B52C'];
var socket;
var GAMEMODE;
var fontMarker;
let latency, timeInfo;

const FRAME_DELAY = 2;

const gunInfo = [
    {name:'shotgun', shootReload:3},
    {name:'standard', shootReload:5}
];
function setup() {
    createCanvas(1000,700);
    background(colors[0]);
    loadHome();
    fontMarker = loadFont('./assets/MarkerFeltThin.ttf');
    //socket = io.connect('http://localhost:3000');
    frameRate(30);
    ping = 0;
}
let nameInput, username;
function loadHome() {
    GAMEMODE = 'HOME';
    nameInput = createInput('unnamed player');
    nameInput.position(width/2-50, height*1/2+20);
    nameInput.size(100);
    nameInput.show();
    nameInput.input(function() {
        if(this.value().length > 14) {
            this.value(this.value().substring(0, 14));
        }
    });
}
let gameStates = [];

let player;
let players = {};
let bullets = [];
let leaderboard = [];
let scroll = {x: 0, y:0};
let killedBy;
let gunEquipHome;
let weaponSelected = 0;
function loadServer() {
    GAMEMODE='LOAD';
    nameInput.hide();
    socket = io.connect("http://localhost:3000");
    socket.on('newConnected', function(data){
        if(data.id == socket.id) {
            console.log('connected, now creating player');
            console.log(socket.id);
            socket.emit('createPlayer', { player:new Player(nameInput.value(), socket.id, 0, 0, 0, weaponSelected)});    
        }
    });
    
    socket.on('startClient', function(data) {
        if(data.id == socket.id) {
            player = (data.user);
            players[player.id] = player;
            gameStates = [];
            for(let i = 0; i < FRAME_DELAY; i++) {
                gameStates.push({players, bullets, leaderboard});
            }
            socket.on('heartbeat', tick);
            loadGame();
        }
    });
    socket.on('pong', function(data){
        if(data.id == socket.id) {
            const newTime = new Date();
            ping =  newTime.getMilliseconds()-timeInfo.getMilliseconds();
        }
    });
    socket.on('playerDied', function(data) {
        if(data.player.id == socket.id) {
            player = data.player;
            killedBy = data.killedBy;
            loadDead();
        }
    });
}
function loadGame() {
    GAMEMODE='GAME';
    
    scroll = {x:0, y:0};
    gunReady = true;
    shootReload = gunInfo[player.weapon].shootReload;
    
}
function loadDead() {
    GAMEMODE='DEAD';
    console.log('oops! you died!');
}
function loadRestart() {
    GAMEMODE="LOAD";
    player.weapon = weaponSelected;
    socket.emit('restartPlayer', {player});
    socket.on('playerRestarted', function(data) {
        if(data.user.id == socket.id) {
            player.weapon = weaponSelected;
            player = data.user;
            loadGame();
        }
    }); 
}
function tick(data) {
    addGameState(data);
    console.log(gameStates.length);
    let current = getGameState();
    players = current.players;
    bullets = current.bullets;
    leaderboard = current.leaderboard;
    player.health = players[player.id].health;
    player.ammo = players[player.id].ammo;
    player.reloadCounter = players[player.id].reloadCounter;
    player.redTime = players[player.id].redTime;
    player.kills = players[player.id].kills;
    
    socket.emit('updatePlayer', { player } );
    if(frameCount%30 == 0) {
        timeInfo = new Date();
        socket.emit('ping', { id:player.id });
    }
    //
}
function getGameState() {
    if(gameStates.length > 0) {
        if(gameStates.length > FRAME_DELAY+1) {
            gameStates.splice(0, gameStates.length-FRAME_DELAY);
        }
        let first = gameStates[0];
        if(gameStates.length > 1) {
            gameStates.splice(0, 1);
        }
        return first;
    }
}
function addGameState(gameState) {
    gameStates.push(gameState);
}

function draw() {
    background(colors[0]);
    if(GAMEMODE=='HOME') {
        // name box
        rectMode(CENTER);
        fill(colors[4]);
        stroke(colors[2]); strokeWeight(10);
        rect(width/2, height/2, 400, 140);

        // title
        textAlign(CENTER, CENTER);
        textFont(fontMarker);
        textSize(100);
        fill(colors[2]); noStroke();
        text("SHOOTOUT", width/2, height*1/4);

        // username
        textSize(50);
        text(nameInput.value(), width/2, height*1/2-20);

        // lower box
        fill(colors[4]);
        stroke(colors[2]); strokeWeight(10);
        rect(width/2, height/2+200, 300, 200);

        // instructions
        fill(colors[2]);
        textSize(20); noStroke();
        text("INSTRUCTIONS\nWASD - move\nclick - shoot\n", width/2, height/2+250);

        // play btn
        if(    mouseX > width/2-60     && mouseX < width/2+60
            && mouseY < height/2+150+20 && mouseY > height/2+150-20) {
            fill(colors[2]);
        } else { fill(colors[3]) };
        noStroke();
        rect(width/2, height/2+150, 120, 40);
        textSize(30);
        fill(colors[4]); noStroke();
        text("Play", width/2, height/2+150);
        
        drawWeaponSelection();
    }
    if(GAMEMODE=='LOAD') {
        rectMode(CENTER);
        fill(colors[4]);
        stroke(colors[2]); strokeWeight(10);
        rect(width/2, height/2, 400, 140);

        textSize(50);
        text("Loading...", width/2, height*1/2);
    }
    if(GAMEMODE=="GAME") {
        scroll.x += (player.x-width/2-scroll.x)*0.1;
        scroll.y += (player.y-height/2-scroll.y)*0.1;
        background(colors[4]);
        drawBullets();
        updatePlayer(player);
        drawPlayer(player);
        drawPlayers();

        if(player.redTime > 0){
            noFill();
            stroke(255,0,0, player.redTime/20*255/2);
            strokeWeight(100);
            rect(width/2,height/2,width,height);

            stroke(255,0,0, player.redTime/20*255);
            strokeWeight(50);
            rect(width/2,height/2,width,height);

        }

        // self player data
        fill(255); noStroke();
        textSize(50);
        text(player.username, width/2, height-90);
        textSize(30);
        
        text(player.kills+" kills", width/2, height-50);
        if(player.health > 9) {
            let h = player.health / 100 * 300;
            stroke(colors[5]);
            strokeWeight(15);
            line(width/2-150, height-25, width/2-150+h, height-25);
        }
        
        drawAmmo();
        // bottom left text
        fill(255); noStroke(); textSize(30);
        text('ammo:'+player.ammo, 80, height-50);
        text('reload:'+player.reloadCounter, 80, height-30);
        text('ping: ' + ping + 'ms', 80, height-70);

        drawLeaderboard()
    }
    if(GAMEMODE=='DEAD') {
        // background
        background(colors[4]);
        drawBullets();
        drawPlayers();
        fill(255); noStroke();
        textSize(50);
        text(player.username, width/2, height-90);
        textSize(30);
        text("0 kills", width/2, height-50);
        if(player.health > 9) {
            let h = player.health / 100 * 300;
            stroke(colors[5]);
            strokeWeight(15);
            line(width/2-150, height-25, width/2-150+h, height-25);
        }
        drawAmmo();
        fill(255); noStroke(); textSize(30);
        text('ammo:'+player.ammo, 80, height-50);
        text('reload:'+player.reloadCounter, 80, height-30);
        text('ping: ' + ping + 'ms', 80, height-70);

        // fade
        let transparentCol = color(colors[0]);
        transparentCol.setAlpha(50);
        fill(transparentCol);
        noStroke();
        rect(width/2, height/2, width-30, height-30);

        // center text
        fill(colors[4]);
        stroke(colors[2]); strokeWeight(10);
        rect(width/2, height/2-30, 500, 200);
        noStroke();
        fill(255);
        textSize(50);
        text("Killed By: " + killedBy, width/2, height*1/2-80);
        textSize(40);
        text("kill streak: " + player.kills, width/2, height*1/2-30);
        // playBtn
        if(    mouseX > width/2-60     && mouseX < width/2+60
            && mouseY < height/2+30+20 && mouseY > height/2+30-20) {
            fill(colors[2]);
        } else { fill(colors[3]) };
        noStroke();
        rect(width/2, height/2+30, 120, 40);
        textSize(30);
        fill(colors[4]); noStroke();
        text("Play", width/2, height/2+30);

        drawLeaderboard()
        drawWeaponSelection();
    }
}

function drawPlayers() {
    for(let key in players) {
        let p = players[key];
        if(p.health < 0) {
            strokeWeight(5);
            stroke(colors[3]) 
            let cntr = {x:p.x-scroll.x, y:p.y-scroll.y}
            line(cntr.x-30, cntr.y-30, cntr.x+30, cntr.y+30);
            line(cntr.x+30, cntr.y-30, cntr.x-30, cntr.y+30);
            continue;
        }
        if(p.id == socket.id) continue;
        drawPlayer(p);
        
        // health bar
        if(p.health > 0) {
            let h = p.health / 100 * 60;
            noFill();
            stroke(colors[5]); strokeWeight(10); 
            line(p.x-30-scroll.x, p.y+30-scroll.y, p.x-30+h-scroll.x, p.y+30-scroll.y);
        }
        // username
        fill(255); noStroke();
        textSize(20);
        text(p.username, p.x-scroll.x, p.y-scroll.y-35);
    }
}
function drawBullets() {
    for(let i = 0; i < bullets.length; i++) {
        let p = {x: bullets[i].x-scroll.x, y: bullets[i].y-scroll.y};
        if(p.x < width+10 && p.x > -10 && p.y < height+10 && p.y > -10) {
            drawBullet(bullets[i]);
        }
    }
}
function drawLeaderboard() {
    for(let i = 0; i < leaderboard.length; i++) {
        fill(colors[3]);
        noStroke();
        rect(width-120, 40+i*40, 180, 30);
        fill(colors[0]);
        textSize(15);
        textAlign(LEFT, CENTER);
        text(leaderboard[i].username, width-120-80, 40+i*40);
        textAlign(RIGHT,CENTER);
        text(leaderboard[i].kills, width-40, 40+i*40);
        textAlign(CENTER,CENTER);
    }
}
function drawWeaponSelection() {
    rectMode(CENTER);
    fill(colors[4]);
    stroke(colors[2]); strokeWeight(10);
    rect(width-175, height-150, 250, 150);

    fill(colors[3]); noStroke(0);
    ellipse(width-175, height-150-35, 25,25);

    fill(colors[3]); noStroke(0);
    ellipse(width-175, height-150+40, 25,25);

    if(abs(mouseX - (width-175)) < 100 && abs(mouseY - (height-150)) < 75) {
        if(dist(mouseX, mouseY, width-175, height-150-35) < 25/2) {
            fill(colors[1]); noStroke(0);
            ellipse(width-175, height-150-35, 25,25);
        }
        if(dist(mouseX, mouseY, width-175, height-150+40) < 25/2) {
            fill(colors[1]); noStroke(0);
            ellipse(width-175, height-150+40, 25,25);
        }
    }

    

    textAlign(CENTER,CENTER);
    textSize(30);
    noFill();
    fill(colors[2]); noStroke();
    text(gunInfo[weaponSelected].name, width-175, height-150);
    fill(colors[4]); noStroke();
    text("^", width-175, height-150-30);
    push();
    translate(width-175, height-150+35);
    rotate(3.141592653);
    fill(colors[4]); noStroke();
    text("^",0,0);
    pop();
}

function Player(username, id, x, y, dir, weapon) {
    this.username = username;
    this.id = id;
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.weapon = weapon;
    this.health = 100;
    if(weapon == 0) 
        this.ammo = 2;
    if(weapon == 1) 
        this.ammo = 12;
    this.reloadCounter = -1;
    this.redTime = 0;
    this.kills = 0;
}

function updatePlayer(user) {
    if(player.weapon == 1 && mouseIsPressed) {
        if(player.ammo > 0) {
            shoot = true;
        }
    }
    let speed = 10;
    if(keyup) {
        user.y -= speed;
    }
    if(keydown) {
        user.y += speed;
    }
    if(keyleft) {
        user.x -= speed;
    }
    if(keyright) {
        user.x += speed;
    }
    if(mouseX-(user.x-scroll.x) >= 0) {
        user.dir = atan((mouseY-(user.y-scroll.y))/(mouseX-(user.x-scroll.x)));
    } else {
        user.dir = 3.1415926535+atan((mouseY-(user.y-scroll.y))/(mouseX-(user.x-scroll.x)));
    }
    shootReload--;
    if(shoot &&shootReload<0) {
        socket.emit('playerShoot', { id:player.id } );
        shoot = false;
        shootReload=gunInfo[user.weapon].shootReload;
        
    }
}
function drawPlayer(user) {
    fill(colors[1]);
    noStroke();
    if(user.redTime > 0) {
        strokeWeight(user.redTime/4);
        stroke(255,0,0);
    }
    ellipse(user.x-scroll.x, user.y-scroll.y, 30,30);
    stroke(colors[1]);
    strokeWeight(5);
    line(user.x-scroll.x, user.y-scroll.y, user.x-scroll.x+cos(user.dir)*20, user.y-scroll.y+sin(user.dir)*20); 
}
function drawBullet(bullet) {
    fill(colors[3]);
    noStroke();
    ellipse(bullet.x-scroll.x, bullet.y-scroll.y, 5,5);
}
function drawAmmo() {
    if(player.weapon == 0) {
        fill(255);
        noStroke();
        textAlign(RIGHT,CENTER);
        textSize(30);
        text('Shotgun', width-20, height-40);
        textAlign(CENTER,CENTER);
        fill(0);
        stroke(colors[3]); strokeWeight(4);
        rect(width-40, height-100, 30, 50);
        rect(width-80, height-100, 30, 50);
        if(player.ammo > 0) {
            noStroke();
            fill(colors[6]);
            rect(width-40, height-100, 26, 50);
            if(player.ammo > 1) {
                rect(width-80, height-100, 26, 50);
            }
        } else {
            if(player.reloadCounter > 0) {
                let h = 50 - player.reloadCounter / 60 * 50;
                noStroke();
                fill(colors[5]);
                rect(width-40, height-100, 26, h);
                rect(width-80, height-100, 26, h);
            }
        }
    }
    if(player.weapon == 1) {
        fill(255);
        noStroke();
        textAlign(RIGHT,CENTER);
        textSize(30);
        text('Standard', width-20, height-40);
        textAlign(CENTER,CENTER);
    }
}
let keyup, keydown, keyleft, keyright;

function keyPressed() {
    if(GAMEMODE=='GAME') {
        if(key=='w') keyup = true;
        if(key=='s') keydown = true;
        if(key=='a') keyleft = true;
        if(key=='d') keyright = true;
        if(key=='r' && player.reloadCounter==-1 && player.ammo < 2) socket.emit('playerReload', {id:player.id});
    }
}
function keyReleased() {
    if(GAMEMODE=='GAME') {

        if(key=='w') keyup = false;
        if(key=='s') keydown = false;
        if(key=='a') keyleft = false;
        if(key=='d') keyright = false;
    }
}
let shoot = false;
let shootReload = 0;
function mouseReleased() {
    if(GAMEMODE=='GAME') {
        
        if(player.ammo > 0) {
            shoot = true;
        } else if (player.reloadCounter == -1) {
            socket.emit('playerReload', {id:player.id});
        }
    }
    if(GAMEMODE=='HOME' || GAMEMODE=='DEAD') {
        if(abs(mouseX - (width-175)) < 100 && abs(mouseY - (height-150)) < 75) {
            if(dist(mouseX, mouseY, width-175, height-150-35) < 25/2) {
                weaponSelected--;
                if(weaponSelected < 0) {
                    weaponSelected = gunInfo.length-1;
                }
            }
            if(dist(mouseX, mouseY, width-175, height-150+40) < 25/2) {
                weaponSelected++;
                if(weaponSelected >= gunInfo.length) {
                    weaponSelected = 0;
                }
            }
            
        }
    }
}

function mouseClicked() {
    // home play btn
    if(    mouseX > width/2-60     && mouseX < width/2+60
        && mouseY < height/2+150+20 && mouseY > height/2+150-20 && GAMEMODE=='HOME') {
        loadServer();
    }
   // dead play btn
    if(    mouseX > width/2-60     && mouseX < width/2+60
        && mouseY < height/2+30+20 && mouseY > height/2+30-20 && GAMEMODE=='DEAD') {
        loadRestart();
    }
    
}