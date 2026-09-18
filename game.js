/* Neon Swarm - https://github.com/matii1942/Neon-Swarm
   MIT licensed. Simulation and canvas renderer - no DOM framework in here. */
/*
  Exposes window.NeonSwarm = { Game, loadHigh, W, H }.
  Game owns every entity, the fixed 480x640 logical canvas and the frame loop;
  it reports HUD changes upward through the onHud callback so React can stay idle.
*/
(function(){
"use strict";
var W=480,H=640;
var COLS=10,COLW=42,ROWH=34,TOPY=104;
var FONT='"Press Start 2P",monospace';

/* ---------------- sound ---------------- */
function Sfx(){this.ctx=null;this.muted=false;}
Sfx.prototype.ensure=function(){
  if(this.ctx)return this.ctx;
  try{var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;this.ctx=new AC();}catch(e){this.ctx=null;}
  return this.ctx;
};
Sfx.prototype.tone=function(type,f0,f1,dur,vol){
  if(this.muted)return;var c=this.ensure();if(!c)return;
  if(c.state==="suspended"){try{c.resume();}catch(e){}}
  var t=c.currentTime,o=c.createOscillator(),g=c.createGain();
  o.type=type;o.frequency.setValueAtTime(f0,t);
  if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol,t+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+dur+0.02);
};
Sfx.prototype.noise=function(dur,vol,f){
  if(this.muted)return;var c=this.ensure();if(!c)return;
  if(c.state==="suspended"){try{c.resume();}catch(e){}}
  var n=Math.floor(c.sampleRate*dur),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);
  for(var i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
  var s=c.createBufferSource();s.buffer=b;
  var bp=c.createBiquadFilter();bp.type="bandpass";bp.frequency.value=f;bp.Q.value=0.8;
  var g=c.createGain();g.gain.value=vol;
  s.connect(bp);bp.connect(g);g.connect(c.destination);s.start();
};
Sfx.prototype.shoot=function(){this.tone("square",880,300,0.09,0.05);};
Sfx.prototype.pop=function(){this.noise(0.22,0.16,900);this.tone("triangle",420,140,0.16,0.05);};
Sfx.prototype.bossPop=function(){this.noise(0.34,0.2,520);this.tone("sawtooth",300,90,0.3,0.06);};
Sfx.prototype.die=function(){this.noise(0.6,0.24,260);this.tone("sawtooth",220,50,0.55,0.08);};
Sfx.prototype.buff=function(){var s=this;[523,659,784,1046].forEach(function(f,i){setTimeout(function(){s.tone("square",f,f,0.1,0.05);},i*70);});};
Sfx.prototype.beam=function(){this.tone("sine",180,900,0.55,0.05);};
Sfx.prototype.caught=function(){this.tone("sawtooth",700,120,0.7,0.07);};
Sfx.prototype.stage=function(){var s=this;[392,523].forEach(function(f,i){setTimeout(function(){s.tone("square",f,f,0.14,0.05);},i*130);});};
Sfx.prototype.rescue=function(){var s=this;[659,880,1175].forEach(function(f,i){setTimeout(function(){s.tone("triangle",f,f,0.16,0.06);},i*90);});};

/* ---------------- helpers ---------------- */
function clamp(v,a,b){return v<a?a:v>b?b:v;}
function rnd(a,b){return a+Math.random()*(b-a);}
function loadHigh(){try{var v=localStorage.getItem("neonSwarmHigh");return v?parseInt(v,10)||0:0;}catch(e){return 0;}}
function saveHigh(v){try{localStorage.setItem("neonSwarmHigh",String(v));}catch(e){}}

/* formation layout: 4 boss, 16 butterflies, 20 bees */
function buildSlots(){
  var s=[],cx=W/2,i,c;
  for(i=0;i<4;i++){c=3+i;s.push({kind:"boss",col:c,row:0});}
  for(var r=1;r<=2;r++)for(c=1;c<=8;c++)s.push({kind:"but",col:c,row:r});
  for(r=3;r<=4;r++)for(c=0;c<COLS;c++)s.push({kind:"bee",col:c,row:r});
  s.forEach(function(o){o.sx=cx+(o.col-(COLS-1)/2)*COLW;o.sy=TOPY+o.row*ROWH;});
  return s;
}
/* sampled entry curves */
function entryPath(type,i){
  var p=[],t,x,y,side=i%2?1:-1;
  if(type===0){ /* sweep up from bottom corner, loop, settle */
    for(t=0;t<=1.001;t+=0.05){
      y=H+40-t*(H*0.82);
      x=(side<0?W*0.16:W*0.84)+side*Math.sin(t*Math.PI*2.1)*102;
      p.push({x:clamp(x,18,W-18),y:y});
    }
  }else if(type===1){ /* dive in from the top, split wide */
    for(t=0;t<=1.001;t+=0.05){
      y=-50+t*(H*0.46);
      x=W/2+side*Math.sin(t*Math.PI*1.7)*150;
      p.push({x:clamp(x,18,W-18),y:y});
    }
  }else{ /* in from the side, arc across */
    for(t=0;t<=1.001;t+=0.05){
      x=(side<0?-40:W+40)+side*-1*t*(W*0.9);
      y=H*0.18+Math.sin(t*Math.PI)*H*0.3;
      p.push({x:x,y:y});
    }
  }
  return p;
}
function divePath(x0,y0,px,dir){
  var p=[],t,amp=rnd(60,130);
  for(t=0;t<=1.001;t+=0.045){
    var y=y0+t*(H+90-y0);
    var x=x0+Math.sin(t*Math.PI*1.65)*amp*dir+(px-x0)*t*0.6;
    p.push({x:clamp(x,16,W-16),y:y});
  }
  return p;
}

/* ---------------- engine ---------------- */
function Game(canvas,onHud,onMode){
  this.cv=canvas;this.cx=canvas.getContext("2d");
  this.onHud=onHud;this.onMode=onMode;this.sfx=new Sfx();
  this.keys={};this.time=0;this.raf=0;this.last=0;
  this.high=loadHigh();this.mode="title";
  this.stars=[];for(var i=0;i<110;i++){var L=i%3;this.stars.push({x:Math.random()*W,y:Math.random()*H,l:L,s:18+L*34+Math.random()*12});}
  this.resize();
  this.reset(true);
  this.bindInput();
  this.pushHud(true);
  var self=this;
  this.loop=function(ts){
    if(!self.last)self.last=ts;
    var dt=Math.min(0.034,(ts-self.last)/1000);self.last=ts;
    self.tick(dt);self.draw();
    self.raf=requestAnimationFrame(self.loop);
  };
  this.raf=requestAnimationFrame(this.loop);
}
Game.prototype.resize=function(){
  var dpr=Math.min(2,window.devicePixelRatio||1);
  this.cv.width=W*dpr;this.cv.height=H*dpr;
  this.cx.setTransform(dpr,0,0,dpr,0,0);
};
Game.prototype.reset=function(demo){
  this.score=0;this.stage=1;this.lives=3;this.nextExtra=20000;
  this.bullets=[];this.ebullets=[];this.parts=[];this.pops=[];this.drops=[];this.rescues=[];
  this.player={x:W/2,y:H-52,dual:false,shield:0,rapid:0,spread:0,dead:false,respawn:0,inv:0,cool:0};
  this.perfect=true;this.banner=null;this.waveT=0;this.attackT=1.4;
  this.spawnWave(demo);
};
Game.prototype.spawnWave=function(demo){
  var slots=buildSlots(),self=this;
  this.enemies=slots.map(function(s,i){
    var g=Math.floor(i/8);
    var e={kind:s.kind,sx:s.sx,sy:s.sy,x:s.sx,y:s.sy,a:0,hp:s.kind==="boss"?2:1,
           phase:Math.random()*6.28,captured:false,fire:rnd(0.3,1.1),beamT:0};
    if(demo){e.state="form";}
    else{
      e.state="wait";e.delay=g*0.72+(i%8)*0.09;
      e.path=entryPath(g%3,i);e.wi=0;e.x=e.path[0].x;e.y=e.path[0].y;
    }
    return e;
  });
  this.speed=1+(this.stage-1)*0.11;
  this.attackT=2.2;
};
Game.prototype.destroy=function(){cancelAnimationFrame(this.raf);this.unbind();};
Game.prototype.bindInput=function(){
  var self=this,k=this.keys;
  this.kd=function(e){
    var c=e.code;
    if(["ArrowLeft","ArrowRight","Space","KeyA","KeyD","ArrowUp","ArrowDown"].indexOf(c)>=0)e.preventDefault();
    k[c]=true;
    if(c==="Enter"||(c==="Space"&&self.mode!=="playing")){self.primary();}
    if(c==="KeyP"||c==="Escape"){self.togglePause();}
  };
  this.ku=function(e){k[e.code]=false;};
  window.addEventListener("keydown",this.kd);window.addEventListener("keyup",this.ku);
  this.pd=function(e){
    self.cv.setPointerCapture&&self.cv.setPointerCapture(e.pointerId);
    self.touch=true;self.movePointer(e);
    if(self.mode!=="playing")self.primary();
  };
  this.pm=function(e){if(self.touch)self.movePointer(e);};
  this.pu=function(){self.touch=false;self.tx=null;};
  this.cv.addEventListener("pointerdown",this.pd);
  this.cv.addEventListener("pointermove",this.pm);
  window.addEventListener("pointerup",this.pu);
  this.vis=function(){if(document.hidden&&self.mode==="playing")self.setMode("paused");};
  document.addEventListener("visibilitychange",this.vis);
};
Game.prototype.unbind=function(){
  window.removeEventListener("keydown",this.kd);window.removeEventListener("keyup",this.ku);
  this.cv.removeEventListener("pointerdown",this.pd);this.cv.removeEventListener("pointermove",this.pm);
  window.removeEventListener("pointerup",this.pu);document.removeEventListener("visibilitychange",this.vis);
};
Game.prototype.movePointer=function(e){
  var r=this.cv.getBoundingClientRect();
  this.tx=clamp((e.clientX-r.left)/r.width*W,18,W-18);
};
Game.prototype.setMode=function(m){this.mode=m;this.onMode(m);};
Game.prototype.primary=function(){
  this.sfx.ensure();
  if(this.mode==="title"||this.mode==="over"){
    this.reset(false);this.setMode("playing");
    this.banner={text:"STAGE 1",t:1.5};this.sfx.stage();this.pushHud(true);
  }else if(this.mode==="paused"){this.setMode("playing");}
};
Game.prototype.togglePause=function(){
  if(this.mode==="playing")this.setMode("paused");
  else if(this.mode==="paused")this.setMode("playing");
};
Game.prototype.setMute=function(m){this.sfx.muted=m;};
Game.prototype.pushHud=function(force){
  var p=this.player;
  var h={score:this.score,high:this.high,stage:this.stage,lives:Math.max(0,this.lives),
         dual:p.dual,shield:p.shield>0,rapid:p.rapid,spread:p.spread};
  var s=JSON.stringify(h);
  if(force||s!==this.hudCache){this.hudCache=s;this.onHud(h);}
};
Game.prototype.addScore=function(n,x,y){
  this.score+=n;
  if(x!=null)this.pops.push({x:x,y:y,t:0.8,n:n});
  if(this.score>=this.nextExtra){this.lives++;this.nextExtra+=this.nextExtra>=60000?60000:40000;this.sfx.rescue();}
  if(this.score>this.high){this.high=this.score;saveHigh(this.high);}
};
Game.prototype.boom=function(x,y,color,n,spd){
  for(var i=0;i<n;i++){
    var a=Math.random()*6.28,s=rnd(spd*0.3,spd);
    this.parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(0.3,0.75),t:0,c:color,r:rnd(1.2,3)});
  }
};

Game.prototype.tick=function(dt){
  this.time+=dt;
  var i,e;
  for(i=0;i<this.stars.length;i++){var st=this.stars[i];st.y+=st.s*dt;if(st.y>H){st.y=-2;st.x=Math.random()*W;}}
  for(i=this.parts.length-1;i>=0;i--){var p=this.parts[i];p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=40*dt;if(p.t>=p.life)this.parts.splice(i,1);}
  for(i=this.pops.length-1;i>=0;i--){this.pops[i].t-=dt;this.pops[i].y-=14*dt;if(this.pops[i].t<=0)this.pops.splice(i,1);}
  if(this.banner){this.banner.t-=dt;if(this.banner.t<=0&&this.mode!=="over")this.banner=null;}
  if(this.mode==="paused"||this.mode==="over"){this.pushHud();return;}

  var demo=this.mode==="title";
  var sway=Math.sin(this.time*0.65)*17;
  var entering=false;
  for(i=0;i<this.enemies.length;i++){
    e=this.enemies[i];
    var fx=e.sx+sway,fy=e.sy;
    if(e.state==="wait"){e.delay-=dt;entering=true;if(e.delay<=0)e.state="enter";}
    else if(e.state==="enter"||e.state==="dive"){
      entering=entering||e.state==="enter";
      var tgt=e.path[e.wi];
      var sp=(e.state==="dive"?200:225)*this.speed;
      var dx=tgt.x-e.x,dy=tgt.y-e.y,d=Math.hypot(dx,dy);
      if(d<sp*dt*1.15){e.wi++;if(e.wi>=e.path.length){
          if(e.state==="enter"){e.state="toslot";}
          else{e.state="reenter";e.x=clamp(e.sx+rnd(-60,60),18,W-18);e.y=-46;}
        }}
      else{e.x+=dx/d*sp*dt;e.y+=dy/d*sp*dt;e.a=Math.atan2(-dx,dy);}
      if(e.state==="dive"&&!demo){
        e.fire-=dt;
        if(e.fire<=0&&e.y<H-120&&e.y>0){e.fire=rnd(0.55,1.3);this.enemyShoot(e);}
      }
    }
    else if(e.state==="toslot"||e.state==="reenter"){
      entering=entering||e.state==="toslot";
      var ddx=fx-e.x,ddy=fy-e.y,dd=Math.hypot(ddx,ddy),sp2=215*this.speed;
      if(dd<5){e.state="form";e.a=0;}
      else{e.x+=ddx/dd*sp2*dt;e.y+=ddy/dd*sp2*dt;e.a=Math.atan2(-ddx,ddy)*0.6;}
    }
    else if(e.state==="capMove"){
      var tx=clamp(this.capX,70,W-70),ty=H*0.42;
      var mx=tx-e.x,my=ty-e.y,md=Math.hypot(mx,my);
      if(md<6){e.state="beam";e.beamT=0;this.sfx.beam();}
      else{e.x+=mx/md*170*dt;e.y+=my/md*170*dt;e.a=Math.atan2(-mx,my)*0.5;}
    }
    else if(e.state==="beam"){
      e.beamT+=dt;e.a=0;
      var pl=this.player;
      if(e.beamT>1.0&&e.beamT<2.5&&!pl.dead&&pl.inv<=0&&Math.abs(pl.x-e.x)<52){this.capture(e);}
      if(e.beamT>2.9){e.state="reenter";e.x=clamp(e.sx+rnd(-40,40),18,W-18);e.y=-46;}
    }
    else{e.x=fx;e.y=fy;e.a=0;}
  }

  /* attack scheduling */
  if(!demo&&!entering&&!this.player.dead){
    this.attackT-=dt;
    var divers=this.enemies.filter(function(x){return x.state==="dive"||x.state==="capMove"||x.state==="beam";}).length;
    var maxD=Math.min(6,2+Math.floor(this.stage/2));
    if(this.attackT<=0&&divers<maxD){
      this.attackT=Math.max(0.45,1.55-this.stage*0.07);
      var pool=this.enemies.filter(function(x){return x.state==="form";});
      if(pool.length){
        var pick=pool[Math.floor(Math.random()*pool.length)];
        var hasCap=this.enemies.some(function(x){return x.captured;});
        if(pick.kind==="boss"&&!hasCap&&!this.player.dual&&Math.random()<0.55){
          pick.state="capMove";this.capX=this.player.x;
        }else{
          pick.state="dive";pick.wi=0;
          pick.path=divePath(pick.x,pick.y,this.player.x,pick.x<W/2?1:-1);
          pick.fire=rnd(0.25,0.7);
        }
      }
    }
  }

  /* player */
  var pl=this.player;
  if(pl.dead){
    pl.respawn-=dt;
    if(pl.respawn<=0){
      if(this.lives<0){this.gameOver();}
      else{pl.dead=false;pl.x=W/2;pl.inv=2.2;pl.shield=0;pl.rapid=0;pl.spread=0;pl.dual=false;}
    }
  }else{
    var v=270;
    var left=this.keys.ArrowLeft||this.keys.KeyA,right=this.keys.ArrowRight||this.keys.KeyD;
    if(left)pl.x-=v*dt;if(right)pl.x+=v*dt;
    if(this.touch&&this.tx!=null){
      var diff=this.tx-pl.x;
      pl.x+=clamp(diff,-v*dt*1.6,v*dt*1.6);
    }
    pl.x=clamp(pl.x,pl.dual?30:18,W-(pl.dual?30:18));
    pl.inv=Math.max(0,pl.inv-dt);
    pl.rapid=Math.max(0,pl.rapid-dt);pl.spread=Math.max(0,pl.spread-dt);
    pl.cool-=dt;
    var firing=(this.keys.Space||this.keys.KeyZ||this.keys.KeyJ||this.touch)&&!demo;
    var limit=pl.dual||pl.rapid>0?5:2;
    if(firing&&pl.cool<=0&&this.bullets.length<limit){this.shoot();}
  }

  /* bullets */
  for(i=this.bullets.length-1;i>=0;i--){
    var b=this.bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;
    if(b.y<-16||b.x<-12||b.x>W+12){this.bullets.splice(i,1);continue;}
    var hit=false;
    for(var j=0;j<this.enemies.length;j++){
      e=this.enemies[j];var rr=e.kind==="boss"?15:12;
      if(Math.abs(b.x-e.x)<rr&&Math.abs(b.y-e.y)<rr){this.hitEnemy(j,b);hit=true;break;}
    }
    if(hit)this.bullets.splice(i,1);
  }
  for(i=this.ebullets.length-1;i>=0;i--){
    var eb=this.ebullets[i];eb.x+=eb.vx*dt;eb.y+=eb.vy*dt;
    if(eb.y>H+14||eb.x<-14||eb.x>W+14){this.ebullets.splice(i,1);continue;}
    if(this.hitsPlayer(eb.x,eb.y,5)){this.ebullets.splice(i,1);this.playerHit();}
  }
  /* enemy body collision */
  if(!pl.dead&&pl.inv<=0){
    for(i=0;i<this.enemies.length;i++){e=this.enemies[i];
      if(e.state==="form")continue;
      if(this.hitsPlayer(e.x,e.y,13)){this.killEnemy(i,false);this.playerHit();break;}
    }
  }
  /* drops */
  for(i=this.drops.length-1;i>=0;i--){
    var dp=this.drops[i];dp.y+=95*dt;dp.r+=dt*3;
    if(dp.y>H+16){this.drops.splice(i,1);continue;}
    if(this.hitsPlayer(dp.x,dp.y,15)){this.applyBuff(dp.t);this.drops.splice(i,1);}
  }
  for(i=this.rescues.length-1;i>=0;i--){
    var rs=this.rescues[i];rs.y+=130*dt;rs.x+=(pl.x-rs.x)*dt*2.2;
    if(rs.y>H+16){this.rescues.splice(i,1);continue;}
    if(this.hitsPlayer(rs.x,rs.y,17)){this.rescues.splice(i,1);pl.dual=true;this.sfx.rescue();this.pops.push({x:pl.x,y:pl.y-30,t:1.1,n:"DUAL FIGHTER"});}
  }
  /* wave clear */
  if(this.enemies.length===0&&!demo){
    if(this.waveT<=0){
      this.waveT=2.1;
      if(this.perfect){this.addScore(3000,W/2,H*0.5);this.banner={text:"PERFECT +3000",t:1.8};}
      else this.banner={text:"STAGE CLEAR",t:1.5};
    }else{
      this.waveT-=dt;
      if(this.waveT<=0){this.stage++;this.perfect=true;this.spawnWave(false);this.banner={text:"STAGE "+this.stage,t:1.5};this.sfx.stage();}
    }
  }
  this.pushHud();
};
Game.prototype.hitsPlayer=function(x,y,r){
  var p=this.player;if(p.dead)return false;
  var hw=(p.dual?26:11)+r*0.5,hh=12+r*0.5;
  return Math.abs(x-p.x)<hw&&Math.abs(y-p.y)<hh;
};
Game.prototype.shoot=function(){
  var p=this.player;
  p.cool=p.rapid>0?0.115:0.24;
  var xs=p.dual?[p.x-13,p.x+13]:[p.x];
  for(var i=0;i<xs.length;i++){
    if(p.spread>0){
      this.bullets.push({x:xs[i],y:p.y-14,vx:-150,vy:-700});
      this.bullets.push({x:xs[i],y:p.y-14,vx:0,vy:-760});
      this.bullets.push({x:xs[i],y:p.y-14,vx:150,vy:-700});
    }else this.bullets.push({x:xs[i],y:p.y-14,vx:0,vy:-760});
  }
  this.sfx.shoot();
};
Game.prototype.enemyShoot=function(e){
  var p=this.player,dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1,s=230+this.stage*6;
  this.ebullets.push({x:e.x,y:e.y+10,vx:dx/d*s,vy:Math.abs(dy/d*s)});
};
Game.prototype.hitEnemy=function(idx,b){
  var e=this.enemies[idx];
  e.hp--;
  if(e.hp>0){this.boom(b.x,b.y,"#ffffff",5,90);this.sfx.shoot();e.hurt=0.12;return;}
  this.killEnemy(idx,true);
};
Game.prototype.killEnemy=function(idx,byShot){
  var e=this.enemies[idx];
  var diving=e.state!=="form";
  var base=e.kind==="bee"?50:e.kind==="but"?80:150;
  var pts=diving?(e.kind==="boss"?400:base*2):base;
  if(e.captured)pts+=1000;
  var col=e.kind==="bee"?"#35f0ff":e.kind==="but"?"#ff2fb0":"#7cff4f";
  this.boom(e.x,e.y,col,e.kind==="boss"?26:16,e.kind==="boss"?220:170);
  if(byShot)this.addScore(pts,e.x,e.y);
  if(e.kind==="boss")this.sfx.bossPop();else this.sfx.pop();
  if(e.captured)this.rescues.push({x:e.x,y:e.y+10});
  if(byShot&&Math.random()<0.11){
    var r=Math.random(),t=r<0.3?"rapid":r<0.6?"spread":r<0.9?"shield":"life";
    this.drops.push({x:e.x,y:e.y,t:t,r:0});
  }
  this.enemies.splice(idx,1);
};
Game.prototype.applyBuff=function(t){
  var p=this.player;
  if(t==="rapid")p.rapid=13;
  else if(t==="spread")p.spread=13;
  else if(t==="shield")p.shield=1;
  else{this.lives++;}
  this.sfx.buff();
  this.pops.push({x:p.x,y:p.y-32,t:1,n:t==="life"?"1UP":t.toUpperCase()});
};
Game.prototype.capture=function(boss){
  var p=this.player;
  boss.captured=true;boss.state="reenter";boss.x=clamp(boss.sx,18,W-18);boss.y=-46;
  this.boom(p.x,p.y,"#7cff4f",18,150);
  this.sfx.caught();
  this.lives--;this.perfect=false;
  p.dead=true;p.respawn=1.7;p.dual=false;
  this.pops.push({x:W/2,y:H*0.6,t:1.4,n:"CAPTURED!"});
};
Game.prototype.playerHit=function(){
  var p=this.player;
  if(p.shield>0){p.shield=0;p.inv=1.1;this.boom(p.x,p.y-4,"#7cff4f",14,160);this.sfx.pop();this.pushHud(true);return;}
  this.boom(p.x,p.y,"#dff6ff",26,210);this.sfx.die();
  this.lives--;this.perfect=false;
  p.dead=true;p.respawn=1.7;p.dual=false;
};
Game.prototype.gameOver=function(){
  this.setMode("over");this.banner=null;
  if(this.score>this.high){this.high=this.score;saveHigh(this.high);}
  this.pushHud(true);
};

/* ---------------- drawing ---------------- */
Game.prototype.draw=function(){
  var c=this.cx,i;
  c.fillStyle="#04050e";c.fillRect(0,0,W,H);
  /* nebula */
  var g=c.createRadialGradient(W*0.5,H*0.1,10,W*0.5,H*0.1,H*0.8);
  g.addColorStop(0,"rgba(36,54,136,.30)");g.addColorStop(1,"rgba(4,5,14,0)");
  c.fillStyle=g;c.fillRect(0,0,W,H);
  for(i=0;i<this.stars.length;i++){
    var s=this.stars[i];
    c.globalAlpha=0.3+s.l*0.28;
    c.fillStyle=s.l===2?"#dff6ff":s.l===1?"#8fd7ff":"#5d6fae";
    c.fillRect(s.x,s.y,s.l===2?2:1,s.l===2?2:1);
  }
  c.globalAlpha=1;

  /* drops */
  for(i=0;i<this.drops.length;i++)this.drawDrop(this.drops[i]);
  /* enemy beams behind sprites */
  for(i=0;i<this.enemies.length;i++){var e=this.enemies[i];if(e.state==="beam")this.drawBeam(e);}
  /* enemies */
  for(i=0;i<this.enemies.length;i++)this.drawEnemy(this.enemies[i]);
  /* bullets */
  c.save();c.shadowBlur=9;
  for(i=0;i<this.bullets.length;i++){var b=this.bullets[i];
    c.shadowColor="#dff6ff";c.fillStyle="#ffffff";c.fillRect(b.x-1.5,b.y-8,3,11);}
  for(i=0;i<this.ebullets.length;i++){var eb=this.ebullets[i];
    c.shadowColor="#ff5d5d";c.fillStyle="#ff9c9c";
    c.beginPath();c.arc(eb.x,eb.y,3.2,0,6.283);c.fill();}
  c.restore();
  /* rescues */
  for(i=0;i<this.rescues.length;i++){this.drawShip(this.rescues[i].x,this.rescues[i].y,"#ff2fb0",1);}
  /* player */
  if(!this.player.dead){
    var p=this.player,vis=p.inv<=0||Math.floor(this.time*14)%2===0;
    if(vis){
      if(p.dual){this.drawShip(p.x-13,p.y,"#dff6ff",1);this.drawShip(p.x+13,p.y,"#dff6ff",1);}
      else this.drawShip(p.x,p.y,"#dff6ff",1);
    }
    if(p.shield>0){
      c.save();c.strokeStyle="rgba(124,255,79,.85)";c.lineWidth=1.6;c.shadowBlur=14;c.shadowColor="#7cff4f";
      c.beginPath();c.arc(p.x,p.y-2,p.dual?34:22,0,6.283);c.stroke();c.restore();
    }
  }
  /* particles */
  c.save();c.shadowBlur=8;
  for(i=0;i<this.parts.length;i++){var pt=this.parts[i],a=1-pt.t/pt.life;
    c.globalAlpha=a;c.fillStyle=pt.c;c.shadowColor=pt.c;
    c.beginPath();c.arc(pt.x,pt.y,pt.r*a+0.4,0,6.283);c.fill();}
  c.restore();c.globalAlpha=1;
  /* score pops */
  c.textAlign="center";
  for(i=0;i<this.pops.length;i++){var po=this.pops[i];
    c.globalAlpha=clamp(po.t,0,1);c.font='9px '+FONT;c.fillStyle="#ffc83d";
    c.fillText(typeof po.n==="number"?String(po.n):po.n,po.x,po.y);}
  c.globalAlpha=1;
  /* banner */
  if(this.banner){
    c.save();c.font='16px '+FONT;c.textAlign="center";
    c.shadowColor="#35f0ff";c.shadowBlur=18;c.fillStyle="#dff6ff";
    c.fillText(this.banner.text,W/2,H*0.44);c.restore();
  }
  if(this.mode==="playing"&&this.player.dead&&this.lives>=0){
    c.save();c.font='10px '+FONT;c.textAlign="center";c.fillStyle="#7b8bc7";
    c.fillText("SHIPS LEFT "+Math.max(0,this.lives),W/2,H*0.62);c.restore();
  }
};
Game.prototype.drawShip=function(x,y,col,sc){
  var c=this.cx;
  c.save();c.translate(x,y);c.scale(sc,sc);
  c.shadowBlur=12;c.shadowColor=col;
  c.fillStyle=col;
  c.beginPath();c.moveTo(0,-14);c.lineTo(5,-2);c.lineTo(9,10);c.lineTo(3,7);c.lineTo(-3,7);c.lineTo(-9,10);c.lineTo(-5,-2);c.closePath();c.fill();
  c.fillStyle="#35f0ff";c.fillRect(-1.6,-9,3.2,9);
  c.fillStyle="rgba(255,200,61,.95)";
  var f=2+Math.random()*4;
  c.beginPath();c.moveTo(-2.4,8);c.lineTo(0,8+f);c.lineTo(2.4,8);c.closePath();c.fill();
  c.restore();
};
Game.prototype.drawEnemy=function(e){
  var c=this.cx;
  var flap=1+Math.sin(this.time*9+e.phase)*0.2;
  c.save();c.translate(e.x,e.y);c.rotate(e.a);
  c.shadowBlur=11;
  var main=e.kind==="bee"?"#35f0ff":e.kind==="but"?"#ff2fb0":"#7cff4f";
  if(e.hurt>0){main="#ffffff";e.hurt-=0.016;}
  c.shadowColor=main;c.fillStyle=main;
  if(e.kind==="bee"){
    c.beginPath();c.moveTo(0,9);c.lineTo(5,0);c.lineTo(0,-8);c.lineTo(-5,0);c.closePath();c.fill();
    c.fillStyle="rgba(255,200,61,.9)";c.shadowColor="#ffc83d";
    c.beginPath();c.moveTo(4,-1);c.lineTo(12*flap,-7*flap);c.lineTo(9*flap,3);c.closePath();c.fill();
    c.beginPath();c.moveTo(-4,-1);c.lineTo(-12*flap,-7*flap);c.lineTo(-9*flap,3);c.closePath();c.fill();
  }else if(e.kind==="but"){
    c.beginPath();c.moveTo(0,10);c.lineTo(4,0);c.lineTo(0,-9);c.lineTo(-4,0);c.closePath();c.fill();
    c.fillStyle="rgba(223,246,255,.92)";c.shadowColor="#dff6ff";
    c.beginPath();c.moveTo(3,-3);c.lineTo(14*flap,-2);c.lineTo(11*flap,6);c.lineTo(3,4);c.closePath();c.fill();
    c.beginPath();c.moveTo(-3,-3);c.lineTo(-14*flap,-2);c.lineTo(-11*flap,6);c.lineTo(-3,4);c.closePath();c.fill();
    c.fillStyle=main;c.shadowColor=main;
    c.beginPath();c.arc(0,-6,2.6,0,6.283);c.fill();
  }else{
    c.beginPath();c.moveTo(0,12);c.lineTo(7,2);c.lineTo(0,-11);c.lineTo(-7,2);c.closePath();c.fill();
    c.fillStyle="rgba(53,240,255,.9)";c.shadowColor="#35f0ff";
    c.beginPath();c.moveTo(5,-2);c.lineTo(16*flap,-8);c.lineTo(13*flap,4);c.closePath();c.fill();
    c.beginPath();c.moveTo(-5,-2);c.lineTo(-16*flap,-8);c.lineTo(-13*flap,4);c.closePath();c.fill();
    c.fillStyle="#ff2fb0";c.shadowColor="#ff2fb0";
    c.beginPath();c.arc(0,1,3.1,0,6.283);c.fill();
    c.strokeStyle="rgba(255,47,176,.8)";c.lineWidth=1.3;
    c.beginPath();c.moveTo(-3,-9);c.lineTo(-6,-15);c.moveTo(3,-9);c.lineTo(6,-15);c.stroke();
  }
  c.restore();
  if(e.captured)this.drawShip(e.x,e.y+26,"#ff2fb0",0.85);
};
Game.prototype.drawBeam=function(e){
  var c=this.cx,t=clamp(e.beamT/1.0,0,1),w=54*t,alpha=e.beamT>2.5?Math.max(0,(2.9-e.beamT)/0.4):0.5*t;
  c.save();
  var g=c.createLinearGradient(0,e.y,0,H);
  g.addColorStop(0,"rgba(124,255,79,"+(0.55*alpha)+")");
  g.addColorStop(1,"rgba(124,255,79,0)");
  c.fillStyle=g;
  c.beginPath();c.moveTo(e.x-8,e.y+8);c.lineTo(e.x+8,e.y+8);c.lineTo(e.x+w,H);c.lineTo(e.x-w,H);c.closePath();c.fill();
  c.strokeStyle="rgba(223,246,255,"+(0.35*alpha)+")";c.lineWidth=1;
  for(var i=0;i<5;i++){
    var yy=e.y+16+((this.time*150+i*70)%(H-e.y-16));
    var ww=8+(yy-e.y)/(H-e.y)*(w-8);
    c.beginPath();c.moveTo(e.x-ww,yy);c.lineTo(e.x+ww,yy);c.stroke();
  }
  c.restore();
};
Game.prototype.drawDrop=function(d){
  var c=this.cx;
  var col=d.t==="rapid"?"#ffc83d":d.t==="spread"?"#35f0ff":d.t==="shield"?"#7cff4f":"#ff2fb0";
  var lab=d.t==="rapid"?"R":d.t==="spread"?"W":d.t==="shield"?"S":"1";
  c.save();c.translate(d.x,d.y);c.rotate(Math.sin(d.r)*0.3);
  c.shadowBlur=14;c.shadowColor=col;
  c.strokeStyle=col;c.lineWidth=1.8;c.fillStyle="rgba(4,5,14,.75)";
  c.beginPath();c.rect(-9,-9,18,18);c.fill();c.stroke();
  c.shadowBlur=0;c.fillStyle=col;c.font='9px '+FONT;c.textAlign="center";c.textBaseline="middle";
  c.fillText(lab,0,1);
  c.restore();c.textBaseline="alphabetic";
};

window.NeonSwarm = { Game: Game, loadHigh: loadHigh, W: W, H: H };
})();
