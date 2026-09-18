/* Neon Swarm - https://github.com/matii1942/Neon-Swarm
   MIT licensed. React shell: cabinet chrome, HUD and overlays. */
/*
  The React layer draws no gameplay - it renders the cabinet around the canvas
  and re-renders only when a displayed HUD value actually changes.
*/
(function(){
"use strict";
var Game = window.NeonSwarm.Game;
var loadHigh = window.NeonSwarm.loadHigh;
var clamp = function(v,a,b){return v<a?a:v>b?b:v;};

var h=React.createElement;

function Buff(props){
  var pct=props.max?clamp(props.t/props.max,0,1)*100:100;
  return h("div",{className:"buff "+props.k},
    h("i",{style:{width:pct+"%"}}),
    h("span",null,props.label));
}

function App(){
  var canvasRef=React.useRef(null);
  var gameRef=React.useRef(null);
  var st=React.useState({score:0,high:loadHigh(),stage:1,lives:3,dual:false,shield:false,rapid:0,spread:0});
  var hud=st[0],setHud=st[1];
  var ms=React.useState("title");var mode=ms[0],setMode=ms[1];
  var sn=React.useState(true);var sound=sn[0],setSound=sn[1];

  React.useEffect(function(){
    var g=new Game(canvasRef.current,setHud,setMode);
    gameRef.current=g;
    var onResize=function(){g.resize();};
    window.addEventListener("resize",onResize);
    try{
      if(window.claude&&window.claude.hot&&window.claude.hot.snapshot){
        window.claude.hot.snapshot(function(){return{high:g.high};});
      }
    }catch(e){}
    return function(){window.removeEventListener("resize",onResize);g.destroy();};
  },[]);

  React.useEffect(function(){if(gameRef.current)gameRef.current.setMute(!sound);},[sound]);

  function press(){gameRef.current&&gameRef.current.primary();}

  var overlay=null;
  if(mode==="title"){
    overlay=h("div",{className:"overlay"},
      h("p",{className:"otitle"},"NEON SWARM"),
      h("p",{className:"osub"},"Forty-strong formation. Bees, butterflies, and four ",h("b",null,"boss galagas")," that will try to tractor-beam your fighter out of the sky."),
      h("div",{className:"keys"},
        h("kbd",null,"← → / A D"),h("span",null,"move"),
        h("kbd",null,"SPACE / Z"),h("span",null,"fire"),
        h("kbd",null,"P"),h("span",null,"pause"),
        h("kbd",null,"drag"),h("span",null,"touch: move + autofire")),
      h("button",{className:"cta",onClick:press},"INSERT COIN"),
      h("p",{className:"osub blink"},"press ENTER or tap the screen"));
  }else if(mode==="paused"){
    overlay=h("div",{className:"overlay"},
      h("p",{className:"otitle"},"PAUSED"),
      h("button",{className:"cta",onClick:press},"RESUME"),
      h("p",{className:"osub"},"P or ESC also resumes."));
  }else if(mode==="over"){
    var best=hud.score>0&&hud.score>=hud.high;
    overlay=h("div",{className:"overlay"},
      h("p",{className:"otitle bad"},"GAME OVER"),
      h("p",{className:"osub"},"Score ",h("b",null,hud.score.toLocaleString())," · Stage ",h("b",null,hud.stage),
        best?h("span",null," · ",h("b",{style:{color:"#ffc83d"}},"NEW HIGH SCORE")):null),
      h("button",{className:"cta alt",onClick:press},"PLAY AGAIN"));
  }

  var buffs=[];
  if(hud.dual)buffs.push(h(Buff,{key:"d",k:"dual",label:"DUAL FIGHTER"}));
  if(hud.shield)buffs.push(h(Buff,{key:"s",k:"shield",label:"SHIELD"}));
  if(hud.rapid>0)buffs.push(h(Buff,{key:"r",k:"rapid",label:"RAPID "+Math.ceil(hud.rapid),t:hud.rapid,max:13}));
  if(hud.spread>0)buffs.push(h(Buff,{key:"w",k:"spread",label:"SPREAD "+Math.ceil(hud.spread),t:hud.spread,max:13}));
  if(!buffs.length)buffs.push(h("span",{key:"n",style:{fontSize:"10px",color:"#55639a",letterSpacing:".14em"}},"NO POWER-UPS ACTIVE"));

  var ships=[];
  for(var i=0;i<Math.min(6,hud.lives);i++)ships.push(h("span",{key:i,style:{
    display:"inline-block",width:0,height:0,marginRight:"7px",
    borderLeft:"6px solid transparent",borderRight:"6px solid transparent",
    borderBottom:"13px solid #dff6ff",filter:"drop-shadow(0 0 5px rgba(53,240,255,.9))"}}));
  if(hud.lives>6)ships.push(h("span",{key:"x",style:{fontSize:"11px",color:"#7b8bc7"}},"+"+(hud.lives-6)));

  return h("div",{className:"cabinet"},
    h("div",{className:"marquee"},
      h("div",null,
        h("h1",{className:"wordmark"},"NEON ",h("em",null,"SWARM")),
        h("p",{className:"tagline"},"formation shooter · 40 hostiles · stage after stage")),
      h("button",{className:"soundbtn","data-on":sound?"1":"0",onClick:function(){setSound(!sound);},
        "aria-pressed":sound?"true":"false"},sound?"SOUND ON":"SOUND OFF")),
    h("div",{className:"hud"},
      h("div",null,h("div",{className:"k"},"Score"),h("div",{className:"v"},hud.score.toLocaleString())),
      h("div",null,h("div",{className:"k"},"High"),h("div",{className:"v hi"},hud.high.toLocaleString())),
      h("div",null,h("div",{className:"k"},"Stage"),h("div",{className:"v st"},String(hud.stage).padStart(2,"0")))),
    h("div",{className:"screenwrap"},
      h("div",{className:"screen"},
        h("canvas",{ref:canvasRef,id:"screen","aria-label":"Neon Swarm game screen"}),
        h("div",{className:"crt"}),h("div",{className:"glare"}),overlay)),
    h("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"12px",flexWrap:"wrap"}},
      h("div",{style:{display:"flex",alignItems:"center",gap:"9px"}},
        h("span",{className:"k",style:{fontSize:"8.5px",letterSpacing:".2em",color:"#7b8bc7"}},"SHIPS"),
        h("span",null,ships)),
      h("div",{className:"buffs"},buffs)),
    h("div",{className:"legend"},
      h("div",null,h("span",{className:"swatch",style:{color:"#35f0ff"}}),h("span",null,h("b",null,"Bee")," 50 / 100 diving")),
      h("div",null,h("span",{className:"swatch",style:{color:"#ff2fb0"}}),h("span",null,h("b",null,"Butterfly")," 80 / 160")),
      h("div",null,h("span",{className:"swatch",style:{color:"#7cff4f"}}),h("span",null,h("b",null,"Boss")," 150 / 400 · 2 hits")),
      h("div",null,h("span",{className:"swatch",style:{color:"#ffc83d"}}),h("span",null,h("b",null,"R")," rapid fire")),
      h("div",null,h("span",{className:"swatch",style:{color:"#35f0ff"}}),h("span",null,h("b",null,"W")," spread shot")),
      h("div",null,h("span",{className:"swatch",style:{color:"#7cff4f"}}),h("span",null,h("b",null,"S")," shield")),
      h("div",null,h("span",{className:"swatch",style:{color:"#ff2fb0"}}),h("span",null,h("b",null,"1")," extra ship")),
      h("div",null,h("span",{className:"swatch",style:{color:"#ff2fb0"}}),h("span",null,"Shoot a boss holding your captured ship to fly ",h("b",null,"dual")))),
    h("p",{className:"foot"},"Clear all forty for a PERFECT bonus · extra ship at 20,000"));
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
})();
