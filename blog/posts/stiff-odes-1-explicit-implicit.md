---
slug: stiff-odes-1-explicit-implicit
category: research
date: November 2026
title: Why Your ODE Solver Blows Up
excerpt: Part 1 of 3. Explicit and implicit integration built from scratch, with interactive stability regions, a Newton solve you can step through, and a two-timescale system that destroys forward Euler. No numerical analysis background assumed.
readTime: 24 min
tags: [Numerical Methods, Stiff ODEs, Implicit Integration, Stability, Interactive]
---

<script>var D=String.fromCharCode(36);window.MathJax={tex:{inlineMath:[[D,D]],displayMath:[['\\[','\\]']],processEscapes:false},options:{skipHtmlTags:['script','noscript','style','textarea','pre','code']},svg:{fontCache:'global'}};</script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js"></script>

<style>
.viz{border:1px solid var(--line2);background:var(--bg2);padding:1.6rem;margin:3rem 0}
.viz-title{font-family:var(--mono);font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:1.1rem}
.viz-ctrl{display:flex;align-items:center;gap:1rem;margin:.75rem 0;font-family:var(--mono);font-size:.68rem;color:var(--text-muted);letter-spacing:.06em}
.viz-ctrl input[type=range]{flex:1;accent-color:#c9a84c;height:2px;min-width:70px}
.viz-val{min-width:5.2rem;text-align:right;color:var(--text);font-variant-numeric:tabular-nums}
.viz-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:.7rem;margin-top:1.3rem}
.viz-stat{border:1px solid var(--line);padding:.7rem .8rem;background:var(--bg3)}
.viz-stat-l{font-family:var(--mono);font-size:.54rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-muted);line-height:1.5}
.viz-stat-v{font-family:var(--mono);font-size:1rem;color:var(--text);margin-top:.3rem;font-variant-numeric:tabular-nums}
.viz-seg{display:flex;border:1px solid var(--line2);width:fit-content;margin-bottom:1.1rem;flex-wrap:wrap}
.viz-seg button{font-family:var(--mono);font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;padding:.5rem .95rem;background:none;border:none;border-right:1px solid var(--line2);color:var(--text-muted);cursor:pointer;transition:background .2s,color .2s}
.viz-seg button:last-child{border-right:none}
.viz-seg button:hover{color:var(--text)}
.viz-seg button.on{background:var(--gold-glow);color:var(--gold)}
.viz-btn{font-family:var(--mono);font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;padding:.5rem 1rem;background:none;border:1px solid var(--line2);color:var(--text-dim);cursor:pointer;transition:border-color .2s,color .2s;margin-right:.5rem}
.viz-btn:hover{border-color:var(--gold);color:var(--gold)}
.viz-note{font-family:var(--mono);font-size:.64rem;color:var(--text-muted);margin-top:1rem;line-height:1.75;letter-spacing:.02em}
.viz-legend{display:flex;flex-wrap:wrap;gap:1.2rem;font-family:var(--mono);font-size:.6rem;color:var(--text-muted);margin-bottom:.9rem;letter-spacing:.06em}
.viz-legend i{display:flex;align-items:center;gap:.45rem;font-style:normal}
.viz-sw{width:18px;height:0;border-top-width:2px;border-top-style:solid;display:inline-block}
.viz svg{display:block;width:100%;height:auto;margin:0;border:none}
.viz canvas{display:block;width:100%;height:auto;border:1px solid var(--line)}
.mathd{margin:2.2rem 0;overflow-x:auto;overflow-y:hidden;color:var(--text);font-family:var(--mono);font-size:.9rem}
mjx-container{color:var(--text)}
mjx-container svg{max-width:100%}
mjx-container[display='true']{margin:0!important}
.post-content table{width:100%;border-collapse:collapse;margin:2.5rem 0;font-size:.93rem}
.post-content th{font-family:var(--mono);font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);text-align:left;padding:.7rem .8rem;border-bottom:1px solid var(--line2);font-weight:400}
.post-content td{padding:.7rem .8rem;border-bottom:1px solid var(--line);color:var(--text-dim);vertical-align:top}
.post-content td code{font-size:.8em}
.series-nav{border:1px solid var(--line2);background:var(--bg2);padding:1.3rem 1.6rem;margin:2.5rem 0;font-family:var(--mono);font-size:.68rem;line-height:2;color:var(--text-muted);letter-spacing:.04em}
.series-nav b{color:var(--gold);font-weight:400}
.series-nav em{color:var(--text-dim);font-style:italic}
</style>

<div class="series-nav">A three-part series on stiff ODE integration.<br><b>Part 1 &mdash; Why your ODE solver blows up.</b> Explicit vs implicit, stability, the Newton solve. <em>You are here.</em><br>Part 2 &mdash; <a href="/blog/html/stiff-odes-2-extrapolation-bdf.html">How real solvers take big steps.</a> Order, extrapolation, BDF.<br>Part 3 &mdash; <a href="/blog/html/stiff-odes-3-fast-bdf.html">Making BDF fast.</a> Sparse Jacobians, Krylov, analytic derivatives.</div>

Here is a thing that happens to everyone who writes their first simulation.

You have a differential equation. You code up the obvious marching scheme &mdash; take the current state, compute the rate of change, step forward. You test it on something gentle and it works beautifully. Then you point it at a real problem and the solution explodes into alternating garbage within forty steps. You cut the timestep by ten. It still explodes, just later. You cut it by a thousand and now it works, but your run takes nine hours.

Nothing is wrong with your code. You have met **stiffness**, and the fix is not a smaller timestep &mdash; it is a different kind of method.

I spent my PhD on this question, specifically on teaching a reinforcement learning agent to pick integrators for combustion chemistry on the fly. The most useful thing I learned is that all of this rests on about four ideas. Not forty. Four. Everything else is bookkeeping. This post builds all four from nothing.

## What a solver actually does

An initial value problem is a rule for the rate of change plus a starting point:

<div class="mathd">
\[ \frac{dy}{dt} = f(t, y), \qquad y(t_0) = y_0 \]
</div>

We want $y$ at later times. Almost never can we get it in closed form, so we settle for values on a discrete ladder of times spaced by a step $\Delta t$, and we accept some error at each rung.

The whole game comes from one honest question: **to get from $t_n$ to $t_{n+1}$, what slope should I use?**

Integrating the ODE exactly over one step gives an exact statement:

<div class="mathd">
\[ y_{n+1} = y_n + \int_{t_n}^{t_{n+1}} f(t, y(t))\, dt \]
</div>

That integral is unknowable &mdash; it depends on the solution we have not computed yet. Every method ever published is a different guess at it. And the first decision you make, before any question of accuracy, is *where you sample the slope*.

<div class="viz"><div class="viz-title">Figure 1 &mdash; The one decision that splits every method in two</div><svg viewBox="0 0 680 292" role="img"><title>Explicit versus implicit stencils</title><desc>Two panels. On the left, explicit Euler evaluates the slope at the known starting point and follows that tangent to the new point. On the right, implicit Euler needs the slope at the unknown arrival point, so the step becomes an equation to solve.</desc><text x="40" y="34" style="font-family:var(--mono);font-size:10.5px;fill:#c4956a;letter-spacing:.1em">EXPLICIT &mdash; SLOPE WHERE YOU ARE</text><line x1="40" y1="232" x2="312" y2="232" stroke="rgba(232,228,220,0.22)" stroke-width="1"/><line x1="92" y1="62" x2="92" y2="240" stroke="rgba(232,228,220,0.1)" stroke-width="1" stroke-dasharray="3 4"/><line x1="252" y1="62" x2="252" y2="240" stroke="rgba(232,228,220,0.1)" stroke-width="1" stroke-dasharray="3 4"/><text x="92" y="256" text-anchor="middle" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">t&#8345;</text><text x="252" y="256" text-anchor="middle" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">t&#8345;&#8330;&#8321;</text><path d="M62 192 C112 162 152 112 192 94 C227 80 267 74 297 72" fill="none" stroke="rgba(232,228,220,0.3)" stroke-width="1.5" stroke-dasharray="5 4"/><line x1="92" y1="174" x2="252" y2="106" stroke="#c4956a" stroke-width="1.6"/><circle cx="92" cy="174" r="4.5" fill="#c4956a"/><circle cx="252" cy="106" r="4.5" fill="none" stroke="#c4956a" stroke-width="1.6"/><text x="106" y="186" style="font-family:var(--mono);font-size:10px;fill:#c4956a">known</text><text x="140" y="126" style="font-family:var(--mono);font-size:10px;fill:#c4956a">slope f(y&#8345;)</text><text x="262" y="102" style="font-family:var(--mono);font-size:10px;fill:#c4956a">y&#8345;&#8330;&#8321;</text><text x="40" y="284" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">one function call &mdash; it is a formula</text><line x1="340" y1="20" x2="340" y2="284" stroke="rgba(255,255,255,0.12)" stroke-width="1"/><text x="372" y="34" style="font-family:var(--mono);font-size:10.5px;fill:#82c9a0;letter-spacing:.1em">IMPLICIT &mdash; SLOPE WHERE YOU LAND</text><line x1="372" y1="232" x2="644" y2="232" stroke="rgba(232,228,220,0.22)" stroke-width="1"/><line x1="424" y1="62" x2="424" y2="240" stroke="rgba(232,228,220,0.1)" stroke-width="1" stroke-dasharray="3 4"/><line x1="584" y1="62" x2="584" y2="240" stroke="rgba(232,228,220,0.1)" stroke-width="1" stroke-dasharray="3 4"/><text x="424" y="256" text-anchor="middle" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">t&#8345;</text><text x="584" y="256" text-anchor="middle" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">t&#8345;&#8330;&#8321;</text><path d="M394 192 C444 162 484 112 524 94 C559 80 599 74 629 72" fill="none" stroke="rgba(232,228,220,0.3)" stroke-width="1.5" stroke-dasharray="5 4"/><line x1="424" y1="174" x2="584" y2="86" stroke="#82c9a0" stroke-width="1.6"/><line x1="562" y1="98" x2="612" y2="70" stroke="#82c9a0" stroke-width="1.1" stroke-dasharray="4 3"/><circle cx="424" cy="174" r="4.5" fill="#82c9a0"/><circle cx="584" cy="86" r="4.5" fill="none" stroke="#82c9a0" stroke-width="1.6"/><text x="438" y="186" style="font-family:var(--mono);font-size:10px;fill:#82c9a0">known</text><text x="470" y="128" style="font-family:var(--mono);font-size:10px;fill:#82c9a0">slope f(y&#8345;&#8330;&#8321;)</text><text x="470" y="144" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">but y&#8345;&#8330;&#8321; is the unknown</text><text x="592" y="82" style="font-family:var(--mono);font-size:10px;fill:#82c9a0">y&#8345;&#8330;&#8321;</text><text x="372" y="284" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">solve an equation &mdash; every single step</text></svg><div class="viz-note">Left: the slope is something you can compute, so the step is a formula. Right: the slope depends on where you land, so the step is an equation. Every difference that follows &mdash; cost, stability, the need for a Jacobian &mdash; comes out of that one choice.</div></div>

Take the simplest option: assume the slope is constant across the step and equal to its value at the start. That is **explicit Euler**, or forward Euler:

<div class="mathd">
\[ y_{n+1} = y_n + \Delta t\, f(t_n, y_n) \]
</div>

You get the same formula by truncating a Taylor expansion after the linear term, which also tells you the error per step is $O(\Delta t^2)$. It is the most natural thing in the world: stand where you are, look where the solution is heading, walk that way for $\Delta t$.

Now take the other option: use the slope at the *end* of the step. That is **implicit Euler**, or backward Euler:

<div class="mathd">
\[ y_{n+1} = y_n + \Delta t\, f(t_{n+1}, y_{n+1}) \]
</div>

Same order of accuracy. Completely different animal, because $y_{n+1}$ sits on both sides. You cannot evaluate this formula; you have to *solve* it. Hold that thought &mdash; we pay for it later, and it is worth every cent.

Here is the first thing to play with. The test problem is $\dot y = -y$ with $y(0) = 1$, exact solution $y = e^{-t}$, the most boring decay imaginable. Slide the step size and watch what each method does to it.

<div class="viz"><div class="viz-title">Interactive 1 &mdash; One step at a time</div><div class="viz-seg" id="w1seg"><button data-m="exp" class="on">Explicit Euler</button><button data-m="imp">Implicit Euler</button><button data-m="trap">Trapezoid</button></div><div class="viz-legend"><i><span class="viz-sw" style="border-top-color:rgba(232,228,220,0.4);border-top-style:dashed"></span>exact decay</i><i><span class="viz-sw" id="w1lsw" style="border-top-color:#c4956a"></span>numerical solution</i><i><span class="viz-sw" style="border-top-color:rgba(201,168,76,0.55);border-top-style:dashed"></span>slope used for the first step</i></div><svg viewBox="0 0 680 292" role="img"><title>Numerical steps against the exact exponential decay</title><desc>A dashed exact decay curve with numerical iterates drawn as a polyline with dots, controlled by a step-size slider and a method selector.</desc><line x1="56" y1="140" x2="648" y2="140" stroke="rgba(232,228,220,0.22)" stroke-width="1"/><line x1="56" y1="28" x2="56" y2="254" stroke="rgba(232,228,220,0.22)" stroke-width="1"/><text x="48" y="82" text-anchor="end" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">1</text><text x="48" y="144" text-anchor="end" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">0</text><text x="48" y="206" text-anchor="end" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">-1</text><text x="56" y="283" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">t = 0</text><text x="648" y="283" text-anchor="end" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">t = 5</text><path id="w1ex" d="" fill="none" stroke="rgba(232,228,220,0.4)" stroke-width="1.4" stroke-dasharray="5 4"/><path id="w1tan" d="" fill="none" stroke="rgba(201,168,76,0.6)" stroke-width="1.2" stroke-dasharray="4 3"/><path id="w1num" d="" fill="none" stroke="#c4956a" stroke-width="1.7"/><g id="w1dots"></g></svg><div class="viz-ctrl"><label for="w1dt">step size</label><input type="range" id="w1dt" min="5" max="280" step="1" value="60"><span class="viz-val" id="w1dtv">0.60</span></div><div class="viz-stats"><div class="viz-stat"><div class="viz-stat-l">Growth factor per step</div><div class="viz-stat-v" id="w1r">0.400</div></div><div class="viz-stat"><div class="viz-stat-l">Steps to reach t = 5</div><div class="viz-stat-v" id="w1n">9</div></div><div class="viz-stat"><div class="viz-stat-l">Error at t = 5</div><div class="viz-stat-v" id="w1e">4.0e-3</div></div><div class="viz-stat"><div class="viz-stat-l">Verdict</div><div class="viz-stat-v" id="w1v" style="font-size:.74rem">stable, monotone</div></div></div><div class="viz-note">Push the step past 1.0 on explicit Euler: the solution starts alternating sign, because one tangent step now overshoots straight past zero. Push past 2.0 and the overshoot grows every step &mdash; that is the blowup, on the gentlest equation in existence. Then switch to implicit Euler and try to break it. You cannot.</div></div>

<script>
(function(){
var PX=function(t){return 56+t/5*592;}, PY=function(v){return 140-v*62;};
var seg=document.getElementById('w1seg'), method='exp';
var ex=[]; for(var i=0;i<=200;i++){var t=i*0.025; ex.push(PX(t).toFixed(1)+' '+PY(Math.exp(-t)).toFixed(1));}
document.getElementById('w1ex').setAttribute('d','M'+ex.join(' L'));
var COL={exp:'#c4956a',imp:'#82c9a0',trap:'#b09fd6'};
function fac(dt){ if(method==='exp')return 1-dt; if(method==='imp')return 1/(1+dt); return (1-dt/2)/(1+dt/2); }
function draw(){
  var dt=+document.getElementById('w1dt').value/100;
  document.getElementById('w1dtv').textContent=dt.toFixed(2);
  var g=fac(dt), col=COL[method];
  document.getElementById('w1num').setAttribute('stroke',col);
  document.getElementById('w1lsw').style.borderTopColor=col;
  var pts=[], y=1, t=0;
  while(t<=5.0001 && pts.length<4000){
    if(Math.abs(y)>1.78) break;
    pts.push([PX(t),PY(y)]); y*=g; t+=dt;
  }
  var stepn=Math.max(1,Math.ceil(pts.length/800)), thin=[];
  for(var i=0;i<pts.length;i+=stepn) thin.push(pts[i]);
  if(pts.length && thin[thin.length-1]!==pts[pts.length-1]) thin.push(pts[pts.length-1]);
  document.getElementById('w1num').setAttribute('d', thin.length?'M'+thin.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' L'):'');
  document.getElementById('w1dots').innerHTML = (pts.length<=70?pts:[]).map(function(p){
    return '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.4" fill="'+col+'"/>';}).join('');
  var tanD='';
  if(method==='exp'){ var L=Math.min(1.3,2.6/Math.max(dt,0.3)); tanD='M'+PX(0).toFixed(1)+' '+PY(1).toFixed(1)+' L'+PX(dt*L).toFixed(1)+' '+PY(1-dt*L).toFixed(1); }
  else if(method==='imp'){ var y1=1/(1+dt), b=Math.min(dt*1.3,1.1); tanD='M'+PX(dt).toFixed(1)+' '+PY(y1).toFixed(1)+' L'+PX(Math.max(0,dt-b)).toFixed(1)+' '+PY(y1+y1*b).toFixed(1); }
  document.getElementById('w1tan').setAttribute('d',tanD);
  document.getElementById('w1r').textContent=g.toFixed(3);
  document.getElementById('w1n').textContent=Math.ceil(5/dt).toLocaleString();
  var yend=Math.pow(g,Math.round(5/dt)), err=Math.abs(yend-Math.exp(-5));
  var v=document.getElementById('w1v'), e=document.getElementById('w1e');
  if(Math.abs(g)>1){ e.textContent='diverged'; v.textContent='unstable'; v.style.color='#d4705f'; }
  else if(g<0){ e.textContent=err.toExponential(1); v.textContent='stable, oscillating'; v.style.color='#c9a84c'; }
  else { e.textContent=err.toExponential(1); v.textContent='stable, monotone'; v.style.color='#82c9a0'; }
}
seg.addEventListener('click',function(e){ if(e.target.tagName!=='BUTTON')return;
  [].forEach.call(seg.children,function(b){b.classList.remove('on');}); e.target.classList.add('on');
  method=e.target.getAttribute('data-m'); draw(); });
document.getElementById('w1dt').addEventListener('input',draw);
draw();
})();
</script>

Three things to notice, because they are the whole post in miniature.

**Accuracy and stability are different problems.** At a step of 0.4 the explicit solution is visibly wrong but perfectly well behaved. At a step of 2.5 it is not wrong, it is *destroyed*. Shrinking the step fixes accuracy gradually; stability is a cliff you either fall off or do not.

**The cliff has an exact location.** Explicit Euler on this problem dies at exactly $\Delta t = 2$. Not approximately. We will derive that number in a moment.

**Implicit Euler has no cliff.** Set the step to 280 and it still decays politely to zero. It is less accurate at large steps &mdash; look how it cuts the corner &mdash; but it never betrays you. That property is the entire reason stiff solvers exist.

## A system with two clocks

One equation cannot show you stiffness, because stiffness is about the *ratio* of timescales. So here is the smallest system that can, and it will be our working example for the rest of the series:

<div class="mathd">
\[ \dot y_1 = -y_1, \qquad \dot y_2 = 999\,y_1 - 1000\,y_2, \qquad y(0) = (1,\, 0) \]
</div>

Think of it chemically. $y_1$ is a fuel that decays slowly on its own. $y_2$ is a radical, produced from the fuel and destroyed a thousand times faster than the fuel disappears. This pattern &mdash; a slow reservoir feeding a fast intermediate &mdash; is the structure of essentially every reacting-flow problem, every control system with a fast actuator, and every circuit with a small capacitor.

It is linear, so we can write the exact answer down:

<div class="mathd">
\[ y_1(t) = e^{-t}, \qquad y_2(t) = e^{-t} - e^{-1000t} \]
</div>

Two exponentials, two timescales: one that lives for seconds and one that is over in about five milliseconds. The matrix form makes the two clocks explicit:

<div class="mathd">
\[ \dot{\mathbf y} = A\mathbf y, \qquad A = \begin{bmatrix} -1 & 0 \\ 999 & -1000 \end{bmatrix} \]
</div>

Its eigenvalues are $-1$ and $-1000$. Those two numbers are the clocks, and the **stiffness ratio** is their quotient: 1000. Once you know them, you know everything about how hard this problem is to integrate &mdash; which is the second of our four ideas, and the subject of the next section.

### What the eigenvalues are attached to

I just used the word eigenvalue without unpacking it, and everything from here on leans on it, so let us do this properly. It is the one piece of linear algebra the whole series needs.

An **eigenvector** of a matrix $A$ is a direction that $A$ does not rotate. It only stretches it:

<div class="mathd">
\[ A\mathbf v = \lambda\,\mathbf v \]
</div>

The stretch factor $\lambda$ is the **eigenvalue** belonging to that direction. A generic vector gets turned *and* stretched when you multiply it by a matrix; eigenvectors are the special directions where the turning part vanishes and the matrix acts like a plain number.

Our $A$ is lower triangular, so its eigenvalues are just the diagonal entries. Putting each back into $(A - \lambda I)\mathbf v = 0$ gives the directions they belong to. For $\lambda = -1$ the equation reduces to $999 v_1 = 999 v_2$, and for $\lambda = -1000$ it reduces to $999 v_1 = 0$:

<div class="mathd">
\[ \lambda_1 = -1,\ \ \mathbf v_1 = \begin{pmatrix} 1 \\ 1 \end{pmatrix} \qquad\qquad \lambda_2 = -1000,\ \ \mathbf v_2 = \begin{pmatrix} 0 \\ 1 \end{pmatrix} \]
</div>

Now the part that matters. Those two directions are not parallel, so **every** vector in the plane can be written as a combination of them, in exactly one way. That is precisely what it means to be a basis. So whatever the starting state is, there exist two numbers $c_1$ and $c_2$ with

<div class="mathd">
\[ \mathbf y_0 = c_1 \mathbf v_1 + c_2 \mathbf v_2 \]
</div>

and those numbers are nothing exotic &mdash; they are just the coordinates of $\mathbf y_0$ measured along the two eigen-directions instead of along the usual axes. For our initial condition $\mathbf y_0 = (1,\,0)$, matching components gives $c_1 = 1$ from the first row and then $c_1 + c_2 = 0$ from the second:

<div class="mathd">
\[ \begin{pmatrix} 1 \\ 0 \end{pmatrix} = 1 \cdot \begin{pmatrix} 1 \\ 1 \end{pmatrix} \;+\; (-1) \cdot \begin{pmatrix} 0 \\ 1 \end{pmatrix}, \qquad c_1 = 1,\quad c_2 = -1 \]
</div>

Why go to the trouble? Because **along an eigen-direction the system is one-dimensional.** A component sitting on $\mathbf v_i$ obeys the scalar equation $\dot c = \lambda_i c$, whose solution is $c\,e^{\lambda_i t}$, and it never leaves that direction. So the full solution is simply the two components shrinking independently, each on its own clock:

<div class="mathd">
\[ \mathbf y(t) = c_1 e^{\lambda_1 t} \mathbf v_1 + c_2 e^{\lambda_2 t} \mathbf v_2 = e^{-t} \begin{pmatrix} 1 \\ 1 \end{pmatrix} - e^{-1000t} \begin{pmatrix} 0 \\ 1 \end{pmatrix} \]
</div>

Read off the components and you get $y_1 = e^{-t}$ and $y_2 = e^{-t} - e^{-1000t}$ &mdash; the exact solution quoted a moment ago, now derived instead of announced.

**These two independently decaying pieces are what everyone means by the "modes" of a system.** From here on, "the fast mode" means the $\mathbf v_2$ component and "the slow mode" means the $\mathbf v_1$ component, and the numbers $c_i$ and vectors $\mathbf v_i$ in the next section are exactly these.

<div class="viz"><div class="viz-title">Interactive 2 &mdash; The state is a sum of two modes</div><div class="viz-legend"><i><span class="viz-sw" style="border-top-color:rgba(232,228,220,0.3);border-top-style:dashed"></span>eigen-directions</i><i><span class="viz-sw" style="border-top-color:#82c9a0"></span>slow mode, along v&#8321;</i><i><span class="viz-sw" style="border-top-color:#c4956a"></span>fast mode, along v&#8322;</i><i><span class="viz-sw" style="border-top-color:#b09fd6"></span>trajectory</i></div><svg viewBox="0 0 680 352" role="img"><title>The solution decomposed into two eigen-modes</title><desc>The state plotted in the plane as the sum of a component along the slow eigenvector and a component along the fast eigenvector, with a time slider.</desc><g id="wmgrid"></g><path id="wmtraj" d="" fill="none" stroke="#b09fd6" stroke-width="1.5" opacity="0.75"/><line id="wmA" x1="0" y1="0" x2="0" y2="0" stroke="#82c9a0" stroke-width="2.4"/><line id="wmB" x1="0" y1="0" x2="0" y2="0" stroke="#c4956a" stroke-width="2.4"/><circle id="wmP" cx="0" cy="0" r="5.5" fill="#b09fd6"/><g id="wmlbl"></g></svg><div class="viz-ctrl"><label for="wmt">time t</label><input type="range" id="wmt" min="0" max="100" step="1" value="0"><span class="viz-val" id="wmtv">0.00000</span></div><div class="viz-stats"><div class="viz-stat"><div class="viz-stat-l">Slow coefficient c&#8321;e^(&minus;t)</div><div class="viz-stat-v" id="wmc1" style="font-size:.9rem;color:#82c9a0">1.000</div></div><div class="viz-stat"><div class="viz-stat-l">Fast coefficient c&#8322;e^(&minus;1000t)</div><div class="viz-stat-v" id="wmc2" style="font-size:.9rem;color:#c4956a">&minus;1.000</div></div><div class="viz-stat"><div class="viz-stat-l">State y&#8321;, y&#8322;</div><div class="viz-stat-v" id="wmy" style="font-size:.85rem">1.000, 0.000</div></div><div class="viz-stat"><div class="viz-stat-l">Fast mode remaining</div><div class="viz-stat-v" id="wmrem" style="font-size:.9rem">100%</div></div></div><div class="viz-note">At t = 0 the state sits at (1, 0), reached by going one unit along v&#8321; and then one unit back down along v&#8322;. Nudge the slider: the orange arrow collapses almost immediately &mdash; it is gone by about five milliseconds &mdash; while the green one has barely moved. After that the state simply slides down the v&#8321; line toward the origin, and nothing about the fast mode matters any more. That is the picture of stiffness, and it is why forcing a solver to keep resolving the orange arrow for the next five seconds is such a waste.</div></div>

<script>
(function(){
var X0=-0.10, X1=1.20, Y0=-0.18, Y1=1.12, SC=223;
function px(a){ return 60+(a-X0)*SC; }
function py(b){ return 320-(b-Y0)*SC; }
function state(t){ var sl=Math.exp(-t), fa=-Math.exp(-1000*t); return {sl:sl,fa:fa,y1:sl,y2:sl+fa}; }
var g='';
g+='<line x1="'+px(X0).toFixed(1)+'" y1="'+py(0).toFixed(1)+'" x2="'+px(X1).toFixed(1)+'" y2="'+py(0).toFixed(1)+'" stroke="rgba(232,228,220,0.22)" stroke-width="1"/>';
g+='<line x1="'+px(0).toFixed(1)+'" y1="'+py(Y0).toFixed(1)+'" x2="'+px(0).toFixed(1)+'" y2="'+py(Y1).toFixed(1)+'" stroke="rgba(232,228,220,0.22)" stroke-width="1"/>';
g+='<line x1="'+px(-0.08).toFixed(1)+'" y1="'+py(-0.08).toFixed(1)+'" x2="'+px(1.10).toFixed(1)+'" y2="'+py(1.10).toFixed(1)+'" stroke="rgba(232,228,220,0.3)" stroke-width="1" stroke-dasharray="4 4"/>';
g+='<text x="'+px(1.10).toFixed(1)+'" y="'+(py(1.10)-8).toFixed(1)+'" text-anchor="end" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">v&#8321; = (1, 1)</text>';
g+='<text x="'+(px(0)+8).toFixed(1)+'" y="'+py(1.08).toFixed(1)+'" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">v&#8322; = (0, 1)</text>';
g+='<text x="'+px(1.18).toFixed(1)+'" y="'+(py(0)+16).toFixed(1)+'" text-anchor="end" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">y&#8321; (fuel)</text>';
g+='<text x="396" y="40" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">y&#8322; (radical) is the vertical axis</text>';
g+='<text x="396" y="62" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">The state is always</text>';
g+='<text x="396" y="80" style="font-family:var(--mono);font-size:10px;fill:#82c9a0">green arrow</text>';
g+='<text x="396" y="98" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">plus</text>';
g+='<text x="396" y="116" style="font-family:var(--mono);font-size:10px;fill:#c4956a">orange arrow</text>';
document.getElementById('wmgrid').innerHTML=g;
var td=[];
for(var i=0;i<=240;i++){
  var t=1e-5*Math.pow(5/1e-5, i/240), s=state(t);
  td.push(px(s.y1).toFixed(1)+' '+py(s.y2).toFixed(1));
}
document.getElementById('wmtraj').setAttribute('d','M'+px(1).toFixed(1)+' '+py(0).toFixed(1)+' L'+td.join(' L'));
function draw(){
  var u=+document.getElementById('wmt').value/100;
  var t=(u===0)?0:1e-5*Math.pow(5/1e-5,u);
  document.getElementById('wmtv').textContent=t<0.001?t.toExponential(2):t.toFixed(5);
  var s=state(t);
  var A=document.getElementById('wmA');
  A.setAttribute('x1',px(0).toFixed(1)); A.setAttribute('y1',py(0).toFixed(1));
  A.setAttribute('x2',px(s.sl).toFixed(1)); A.setAttribute('y2',py(s.sl).toFixed(1));
  var B=document.getElementById('wmB');
  B.setAttribute('x1',px(s.sl).toFixed(1)); B.setAttribute('y1',py(s.sl).toFixed(1));
  B.setAttribute('x2',px(s.y1).toFixed(1)); B.setAttribute('y2',py(s.y2).toFixed(1));
  var P=document.getElementById('wmP');
  P.setAttribute('cx',px(s.y1).toFixed(1)); P.setAttribute('cy',py(s.y2).toFixed(1));
  document.getElementById('wmc1').textContent=s.sl.toFixed(3);
  document.getElementById('wmc2').textContent=s.fa.toFixed(3);
  document.getElementById('wmy').textContent=s.y1.toFixed(3)+', '+s.y2.toFixed(3);
  var rem=Math.abs(s.fa)*100;
  document.getElementById('wmrem').textContent=rem<0.1?rem.toExponential(1)+'%':rem.toFixed(1)+'%';
}
document.getElementById('wmt').addEventListener('input',draw);
draw();
})();
</script>

Here is the thing that makes stiffness so counterintuitive. After about 5 ms the fast exponential is dead; $e^{-1000t}$ at $t = 0.005$ is already $0.0067$, and by $t = 0.01$ it is $4.5 \times 10^{-5}$. From then on the solution is just $e^{-t}$ in both components &mdash; smooth, slow, boring, perfectly described by a step size of 0.05. The fast mode has *no influence on the answer* past the first instant.

But explicit Euler does not care that a mode is dead. It only cares that the mode *exists*.

## The amplification factor: where the cliff comes from

This is the key derivation in the whole subject, and it takes four lines.

Apply explicit Euler to the linear system $\dot{\mathbf y} = A\mathbf y$:

<div class="mathd">
\[ \mathbf y_{n+1} = \mathbf y_n + \Delta t\, A\mathbf y_n = (I + \Delta t\, A)\,\mathbf y_n \quad\Longrightarrow\quad \mathbf y_n = (I + \Delta t\, A)^n\, \mathbf y_0 \]
</div>

Now use the one fact that makes everything tractable: $I + \Delta t A$ has **exactly the same eigenvectors as $A$**, with eigenvalues $1 + \lambda_i \Delta t$. So expand the initial condition in the eigenvector basis exactly as we did above, $\mathbf y_0 = \sum_i c_i \mathbf v_i$ &mdash; for our system that was $c_1 = 1$ on $\mathbf v_1 = (1,1)$ and $c_2 = -1$ on $\mathbf v_2 = (0,1)$ &mdash; and the whole thing decouples:

<div class="mathd">
\[ \mathbf y_n = \sum_i c_i \,(1 + \lambda_i \Delta t)^n\, \mathbf v_i \]
</div>

Each mode is simply multiplied by its own number, once per step. A geometric sequence stays bounded exactly when the magnitude of its ratio is at most one. Writing $z = \lambda \Delta t$ and calling $R(z)$ the **amplification factor** &mdash; the number one step multiplies a mode by &mdash; the condition is:

<div class="mathd">
\[ R(z) = 1 + z, \qquad |R(\lambda_i \Delta t)| \le 1 \ \text{ for every eigenvalue } \lambda_i \]
</div>

For a real negative eigenvalue this unpacks to $-2 \le \lambda\Delta t \le 0$, which is the step-size limit:

<div class="mathd">
\[ \Delta t \le \frac{2}{|\lambda|} \]
</div>

There is the cliff. On $\dot y = -y$ we have $\lambda = -1$, so the limit is $\Delta t = 2$ &mdash; exactly where Interactive 1 fell apart.

And here is why it is so brutal on our two-clock system. The constraint has to hold for **every** eigenvalue, so the *fastest* one wins:

<div class="mathd">
\[ \Delta t \le \frac{2}{|{-1000}|} = 0.002 \]
</div>

To integrate to $t = 5$ you therefore need at least 2500 steps. But the fast mode is numerically dead after about ten of them. **Roughly 2490 of those 2500 steps exist for no reason except to stop a mode that contributes nothing to the answer from exploding.** That sentence is the definition of stiffness, and it is the third of our four ideas.

### Why the number is 2, intuitively

Forget the algebra for a second. Explicit Euler walks along the tangent line. For $\dot y = -ay$ with $y_n > 0$, the tangent at $y_n$ hits zero after a time $1/a$. Step exactly that far and you land perfectly on the equilibrium. Step *twice* that far and you land the same distance on the other side &mdash; you have reflected across zero without losing any magnitude. Step further than that and you come down further from equilibrium than you started, with the sign flipped. Repeat, and the oscillation grows without bound. The factor of two is the point where overshoot exactly cancels decay.

### The deeper reason: R(z) is a bad impostor of the exponential

Over one exact step, each mode is multiplied by $e^{\lambda \Delta t} = e^{z}$. Explicit Euler multiplies it by $1 + z$, which is just the first-order Taylor polynomial of $e^z$. Near $z = 0$ that is a fine approximation. Far out on the negative real axis it is a catastrophe: as $z \to -\infty$ the true factor $e^z$ goes to zero, while $|1 + z|$ goes to infinity. The method does the exact opposite of what the physics does, and the more strongly damped the mode is, the more violently the method amplifies it.

Every method has its own $R(z)$. Comparing them is the cleanest way to understand what a method is actually for. The set of $z$ where $|R(z)| \le 1$ is called the method's **stability region**, and you can go look at them.

<div class="viz"><div class="viz-title">Interactive 3 &mdash; Stability regions in the complex plane</div><div class="viz-seg" id="w2seg"><button data-m="exp" class="on">Explicit Euler</button><button data-m="imp">Implicit Euler</button><button data-m="trap">Trapezoid</button></div><canvas id="w2c" width="680" height="425" role="img" aria-label="The stability region of the selected method drawn in the complex plane, with the two scaled eigenvalues of the working example marked."></canvas><div class="viz-ctrl"><label for="w2dt">step size</label><input type="range" id="w2dt" min="0" max="100" step="1" value="46"><span class="viz-val" id="w2dtv">0.0010</span></div><div class="viz-stats"><div class="viz-stat"><div class="viz-stat-l">Fast mode &nbsp;z = &minus;1000&middot;&Delta;t</div><div class="viz-stat-v" id="w2zf">&minus;1.00</div></div><div class="viz-stat"><div class="viz-stat-l">Slow mode &nbsp;z = &minus;1&middot;&Delta;t</div><div class="viz-stat-v" id="w2zs">&minus;0.0010</div></div><div class="viz-stat"><div class="viz-stat-l">Steps to reach t = 5</div><div class="viz-stat-v" id="w2n">5,000</div></div><div class="viz-stat"><div class="viz-stat-l">Verdict</div><div class="viz-stat-v" id="w2v" style="font-size:.74rem">stable</div></div></div><div class="viz-note">The shaded area is where a mode survives the step without growing. On explicit Euler it is a disk of radius 1 centred at &minus;1 &mdash; so the fast eigenvalue falls out of it the moment the step exceeds 0.002, and no amount of care elsewhere saves you. On implicit Euler the shaded area is everything except a small disk in the right half plane: the entire left half plane is stable, at any step size. Trapezoid gives you exactly the left half plane and not one point more.</div></div>

<script>
(function(){
var cv=document.getElementById('w2c'), seg=document.getElementById('w2seg'), method='exp';
var RE0=-6, RE1=2, IM0=-2.5, IM1=2.5, W=680, H=425;
var DPR=Math.min(2, window.devicePixelRatio||1);
cv.width=W*DPR; cv.height=H*DPR; cv.style.width='100%';
var ctx=cv.getContext('2d');
var COL={exp:[196,149,106],imp:[130,201,160],trap:[176,159,214]};
function absR(x,y){
  if(method==='exp'){ var a=1+x; return Math.sqrt(a*a+y*y); }
  if(method==='imp'){ var b=1-x; var d=Math.sqrt(b*b+y*y); return d===0?Infinity:1/d; }
  var nr=1+x/2, ni=y/2, dr=1-x/2, di=-y/2;
  var nd=Math.sqrt(nr*nr+ni*ni), dd=Math.sqrt(dr*dr+di*di);
  return dd===0?Infinity:nd/dd;
}
function px(re){ return (re-RE0)/(RE1-RE0)*W; }
function py(im){ return (IM1-im)/(IM1-IM0)*H; }
function render(){
  var iw=cv.width, ih=cv.height, img=ctx.createImageData(iw,ih), d=img.data, c=COL[method];
  for(var j=0;j<ih;j++){
    var im=IM1-(j/ih)*(IM1-IM0);
    for(var i=0;i<iw;i++){
      var re=RE0+(i/iw)*(RE1-RE0), m=absR(re,im), o=(j*iw+i)*4;
      if(m<=1){
        var edge=m>0.965;
        d[o]=c[0]; d[o+1]=c[1]; d[o+2]=c[2]; d[o+3]=edge?170:44;
      } else { d[o+3]=0; }
    }
  }
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,iw,ih);
  ctx.putImageData(img,0,0);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  // grid + axes
  ctx.lineWidth=1; ctx.strokeStyle='rgba(232,228,220,0.07)';
  for(var g=Math.ceil(RE0);g<=RE1;g++){ ctx.beginPath(); ctx.moveTo(px(g),0); ctx.lineTo(px(g),H); ctx.stroke(); }
  for(var k=Math.ceil(IM0);k<=IM1;k++){ ctx.beginPath(); ctx.moveTo(0,py(k)); ctx.lineTo(W,py(k)); ctx.stroke(); }
  ctx.strokeStyle='rgba(232,228,220,0.3)';
  ctx.beginPath(); ctx.moveTo(0,py(0)); ctx.lineTo(W,py(0)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px(0),0); ctx.lineTo(px(0),H); ctx.stroke();
  ctx.fillStyle='rgba(232,228,220,0.45)'; ctx.font='10px ui-monospace,monospace';
  for(var g2=Math.ceil(RE0);g2<=RE1;g2++){ if(g2!==0) ctx.fillText(String(g2), px(g2)+4, py(0)+14); }
  ctx.fillText('Re(z)', W-48, py(0)-8);
  ctx.fillText('Im(z)', px(0)+6, 14);
  // eigenvalue markers
  var u=+document.getElementById('w2dt').value/100;
  var dt=Math.pow(10,-4+u*(Math.log(0.05)/Math.LN10+4));
  document.getElementById('w2dtv').textContent=dt.toFixed(5);
  var zf=-1000*dt, zs=-dt;
  var okf=absR(zf,0)<=1, oks=absR(zs,0)<=1;
  function dot(z,ok,label){
    var offscale=z<RE0+0.06, xx=offscale?px(RE0)+9:px(z);
    ctx.beginPath(); ctx.arc(xx,py(0),5.5,0,6.2832);
    ctx.fillStyle=ok?'#82c9a0':'#d4705f'; ctx.fill();
    ctx.strokeStyle='rgba(13,13,14,0.9)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle=ok?'#82c9a0':'#d4705f'; ctx.font='10px ui-monospace,monospace';
    ctx.fillText(label+(offscale?' (off scale)':''), xx+9, py(0)-11);
    if(offscale){ ctx.beginPath(); ctx.moveTo(xx-4,py(0)); ctx.lineTo(xx-9,py(0)-4); ctx.lineTo(xx-9,py(0)+4); ctx.closePath(); ctx.fill(); }
  }
  dot(zs,oks,'slow'); dot(zf,okf,'fast');
  document.getElementById('w2zf').textContent=(zf>-100?zf.toFixed(2):zf.toFixed(0));
  document.getElementById('w2zs').textContent=zs.toFixed(5);
  document.getElementById('w2n').textContent=Math.ceil(5/dt).toLocaleString();
  var v=document.getElementById('w2v');
  if(okf&&oks){ v.textContent='stable'; v.style.color='#82c9a0'; }
  else { v.textContent='fast mode explodes'; v.style.color='#d4705f'; }
}
seg.addEventListener('click',function(e){ if(e.target.tagName!=='BUTTON')return;
  [].forEach.call(seg.children,function(b){b.classList.remove('on');}); e.target.classList.add('on');
  method=e.target.getAttribute('data-m'); render(); });
document.getElementById('w2dt').addEventListener('input',render);
render();
})();
</script>

Spend a minute with that one. Select explicit Euler and walk the step size up from the left: the slow mode barely moves off the origin, while the fast mode races leftward and falls out of the disk at $\Delta t = 0.002$. Then switch to implicit Euler without touching the slider. The fast mode is suddenly deep inside the stable region no matter how far left it goes, because for implicit Euler "far left" *is* the stable region.

That is the whole argument for implicit methods, in one picture.

## Implicit Euler: ask where you are going

Run the same derivation on $y_{n+1} = y_n + \Delta t\, f(y_{n+1})$ with $f = Ay$:

<div class="mathd">
\[ (I - \Delta t\, A)\,\mathbf y_{n+1} = \mathbf y_n \quad\Longrightarrow\quad R(z) = \frac{1}{1 - z} \]
</div>

Ask when $|R(z)| \le 1$ and you get $|1 - z| \ge 1$: everything *outside* a unit disk centred at $+1$. That region contains the entire left half plane. Any eigenvalue with a negative real part is stable at **any** step size whatsoever.

A method whose stability region contains the whole left half plane is called **A-stable**, and that is the property you are buying when you pay for an implicit method.

Implicit Euler has a second, less advertised property that matters just as much in practice. As $z \to -\infty$, $R(z) = 1/(1-z) \to 0$. The stiffer the mode, the harder the method crushes it &mdash; which is exactly what the true solution does. A method with $R(\infty) = 0$ is called **L-stable**. Compare the three at $z = -400$, a perfectly ordinary value for combustion chemistry at a millisecond step:

| Method | $R(z)$ | At $z = -400$ | What the exact solution does |
|---|---|---|---|
| Explicit Euler | $1 + z$ | $-399$ &mdash; amplifies 399&times; per step | $e^{-400} \approx 10^{-174}$ |
| Trapezoid | $\dfrac{1+z/2}{1-z/2}$ | $-0.990$ &mdash; decays, but barely, and flips sign | effectively zero |
| Implicit Euler | $\dfrac{1}{1-z}$ | $0.0025$ &mdash; crushed, as it should be | effectively zero |

The trapezoid row is worth staring at. Trapezoid is A-stable and second-order accurate, strictly better than implicit Euler on both counts by the usual metrics &mdash; and yet on a very stiff mode it returns $-0.990$, meaning that dead mode sits there ringing, decaying by one percent per step and flipping sign every step, polluting your solution for thousands of steps. This is a real failure mode with a real name (it is why Crank&ndash;Nicolson gets a bad reputation in stiff problems), and it is the reason production stiff solvers are built on BDF rather than on trapezoid. That story is Part 2.

## The bill: you have to solve an equation

Nothing is free. Look again at what implicit Euler asks for:

<div class="mathd">
\[ y_{n+1} = y_n + \Delta t\, f(t_{n+1},\, y_{n+1}) \]
</div>

If $f$ is linear you can rearrange and solve a linear system, which is what we did above. Real problems are not linear. Chemical kinetics has products of concentrations and Arrhenius exponentials in it; the unknown is tangled inside $f$ in a way no rearrangement will undo.

So you move everything to one side and hunt for a root. Define the **residual**

<div class="mathd">
\[ G(y) = y - y_n - \Delta t\, f(t_{n+1},\, y) \]
</div>

and find the $y$ that makes it zero. The standard tool is Newton's method, which repeatedly replaces $G$ by its tangent line and jumps to where that tangent crosses zero:

<div class="mathd">
\[ y^{(k+1)} = y^{(k)} - \frac{G(y^{(k)})}{G'(y^{(k)})}, \qquad G'(y) = I - \Delta t\, \frac{\partial f}{\partial y} \]
</div>

And there it is. $\partial f / \partial y$ is the **Jacobian** &mdash; the matrix of every partial derivative of every rate with respect to every state variable. This is the fourth and last big idea, and the entire third part of this series is about the fact that for a 50-species chemical mechanism this object is a 50&times;50 matrix that you must form, factor, and solve against, over and over, inside every single timestep.

Try the machinery on a one-variable version. Take $\dot y = -K y^2$ with $K = 50$, which is what two radicals destroying each other looks like, and ask implicit Euler to take one step from $y_n = 1$.

<div class="viz"><div class="viz-title">Interactive 4 &mdash; Inside one implicit step</div><div class="viz-legend"><i><span class="viz-sw" style="border-top-color:#82c9a0"></span>residual G(y)</i><i><span class="viz-sw" style="border-top-color:rgba(201,168,76,0.75);border-top-style:dashed"></span>Newton tangent</i><i><span class="viz-sw" style="border-top-color:#c9a84c"></span>true root</i></div><svg viewBox="0 0 680 330" role="img"><title>Newton iteration on the implicit Euler residual</title><desc>The residual function plotted against the unknown, with Newton iterates shown as vertical drops to the curve and tangent lines back to the horizontal axis.</desc><g id="w3grid"></g><path id="w3g" d="" fill="none" stroke="#82c9a0" stroke-width="1.8"/><g id="w3iter"></g><g id="w3lbl"></g></svg><div class="viz-ctrl"><label for="w3dt">step size</label><input type="range" id="w3dt" min="2" max="200" step="1" value="20"><span class="viz-val" id="w3dtv">0.20</span></div><div><button class="viz-btn" id="w3step">Take a Newton step</button><button class="viz-btn" id="w3reset">Reset</button></div><div class="viz-stats"><div class="viz-stat"><div class="viz-stat-l">Newton iterations</div><div class="viz-stat-v" id="w3k">0</div></div><div class="viz-stat"><div class="viz-stat-l">Current guess</div><div class="viz-stat-v" id="w3y">1.000000</div></div><div class="viz-stat"><div class="viz-stat-l">Residual |G|</div><div class="viz-stat-v" id="w3r">1.0e+1</div></div><div class="viz-stat"><div class="viz-stat-l">True root</div><div class="viz-stat-v" id="w3t">0.270156</div></div></div><div class="viz-note">Press the button and watch the residual collapse: roughly 1e&#8722;1, then 1e&#8722;3, then 1e&#8722;7, then machine zero. The number of correct digits doubles every iteration &mdash; that is quadratic convergence, and it is why Newton is worth the Jacobian. Now push the step size up. The initial guess gets worse, the curve gets more bent, and you need more iterations. This is the real reason implicit solvers cannot take arbitrarily large steps: stability says yes, but the nonlinear solve says no.</div></div>

<script>
(function(){
var K=50, yn=1, X0=-0.06, X1=1.16, iters=[1], dt=0.2;
function G(y){ return y - yn + dt*K*y*y; }
function dG(y){ return 1 + 2*dt*K*y; }
function root(){ return (-1+Math.sqrt(1+4*dt*K*yn))/(2*dt*K); }
function px(x){ return 60+(x-X0)/(X1-X0)*580; }
var gTop, gBot;
function py(g){ return 40+(gTop-g)/(gTop-gBot)*250; }
function esc(n){ return n.toFixed(1); }
function render(){
  document.getElementById('w3dtv').textContent=dt.toFixed(2);
  gTop=Math.max(G(X1),0.35); gBot=Math.min(G(0)*1.25,-0.3);
  var grid='', d=[];
  grid+='<line x1="'+px(X0)+'" y1="'+py(0).toFixed(1)+'" x2="'+px(X1)+'" y2="'+py(0).toFixed(1)+'" stroke="rgba(232,228,220,0.25)" stroke-width="1"/>';
  grid+='<line x1="'+px(0)+'" y1="34" x2="'+px(0)+'" y2="296" stroke="rgba(232,228,220,0.18)" stroke-width="1"/>';
  for(var gx=0.25;gx<1.14;gx+=0.25){
    grid+='<line x1="'+px(gx).toFixed(1)+'" y1="34" x2="'+px(gx).toFixed(1)+'" y2="296" stroke="rgba(232,228,220,0.06)" stroke-width="1"/>';
    grid+='<text x="'+px(gx).toFixed(1)+'" y="316" text-anchor="middle" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.4)">'+gx.toFixed(2)+'</text>';
  }
  grid+='<text x="640" y="'+(py(0)-8).toFixed(1)+'" text-anchor="end" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.4)">G(y) = 0</text>';
  grid+='<text x="60" y="26" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.4)">residual G(y)</text>';
  document.getElementById('w3grid').innerHTML=grid;
  for(var i=0;i<=140;i++){ var x=X0+(X1-X0)*i/140; d.push(px(x).toFixed(1)+' '+py(G(x)).toFixed(1)); }
  document.getElementById('w3g').setAttribute('d','M'+d.join(' L'));
  var r=root(), s='';
  s+='<line x1="'+px(r).toFixed(1)+'" y1="34" x2="'+px(r).toFixed(1)+'" y2="296" stroke="#c9a84c" stroke-width="1" stroke-dasharray="3 4"/>';
  s+='<circle cx="'+px(r).toFixed(1)+'" cy="'+py(0).toFixed(1)+'" r="4" fill="#c9a84c"/>';
  for(var k=0;k<iters.length;k++){
    var yk=iters[k], gk=G(yk);
    if(yk<X0-0.3||yk>X1+0.3) continue;
    s+='<line x1="'+px(yk).toFixed(1)+'" y1="'+py(0).toFixed(1)+'" x2="'+px(yk).toFixed(1)+'" y2="'+py(gk).toFixed(1)+'" stroke="rgba(232,228,220,0.3)" stroke-width="1" stroke-dasharray="2 3"/>';
    s+='<circle cx="'+px(yk).toFixed(1)+'" cy="'+py(gk).toFixed(1)+'" r="3.6" fill="#82c9a0"/>';
    var nx=yk-gk/dG(yk);
    s+='<line x1="'+px(yk).toFixed(1)+'" y1="'+py(gk).toFixed(1)+'" x2="'+px(nx).toFixed(1)+'" y2="'+py(0).toFixed(1)+'" stroke="rgba(201,168,76,0.75)" stroke-width="1.2" stroke-dasharray="4 3"/>';
    s+='<circle cx="'+px(nx).toFixed(1)+'" cy="'+py(0).toFixed(1)+'" r="3" fill="none" stroke="#c9a84c" stroke-width="1.2"/>';
    s+='<text x="'+px(yk).toFixed(1)+'" y="'+(py(gk)-9).toFixed(1)+'" text-anchor="middle" style="font-family:var(--mono);font-size:9.5px;fill:rgba(232,228,220,0.55)">y'+k+'</text>';
  }
  document.getElementById('w3iter').innerHTML=s;
  var cur=iters[iters.length-1];
  document.getElementById('w3k').textContent=String(iters.length-1);
  document.getElementById('w3y').textContent=cur.toFixed(6);
  var res=Math.abs(G(cur));
  document.getElementById('w3r').textContent=res<1e-15?'0':res.toExponential(1);
  document.getElementById('w3t').textContent=r.toFixed(6);
}
document.getElementById('w3step').addEventListener('click',function(){
  var y=iters[iters.length-1];
  if(iters.length<9) iters.push(y-G(y)/dG(y));
  render();
});
document.getElementById('w3reset').addEventListener('click',function(){ iters=[1]; render(); });
document.getElementById('w3dt').addEventListener('input',function(){
  dt=+this.value/100; iters=[1]; render();
});
render();
})();
</script>

Count the cost of one implicit step, then: a handful of Newton iterations, each needing one evaluation of $f$, one evaluation of the Jacobian, and one linear solve. Against explicit Euler's single function call. Somewhere between ten and fifty times the work per step.

That is the trade, stated plainly:

> Explicit methods are cheap per step and can be forced to take absurdly many steps. Implicit methods are expensive per step and get to choose how many to take.

On a non-stiff problem the explicit method wins easily. On a stiff one it is not close.

## Head to head

Everything so far has been theory. Here is the experiment: all three methods on the two-clock system, against the exact solution we wrote down earlier, at whatever step size you choose.

Start at a small step where everyone agrees. Then walk the step size up past 0.002 and watch exactly one of the three curves detonate. Use the zoom to see the first twenty milliseconds, where the fast transient lives &mdash; notice that implicit Euler misses the shape of that transient entirely at large steps, and *that is fine*, because the transient is not the answer. It gets the thing you care about right while refusing to be destabilised by the thing you do not.

<div class="viz"><div class="viz-title">Interactive 5 &mdash; The race</div><div class="viz-seg" id="w4zoom"><button data-z="full" class="on">Full run, t &le; 5</button><button data-z="tran">First 20 ms</button></div><div class="viz-legend"><i><span class="viz-sw" style="border-top-color:rgba(232,228,220,0.45);border-top-style:dashed"></span>exact</i><i><span class="viz-sw" style="border-top-color:#c4956a"></span>explicit Euler</i><i><span class="viz-sw" style="border-top-color:#82c9a0"></span>implicit Euler</i><i><span class="viz-sw" style="border-top-color:#b09fd6"></span>trapezoid</i></div><svg viewBox="0 0 680 300" role="img"><title>Three integrators against the exact solution of the stiff system</title><desc>The radical concentration over time, computed by explicit Euler, implicit Euler and trapezoid at a selectable step size, compared with the exact solution.</desc><line x1="56" y1="222" x2="648" y2="222" stroke="rgba(232,228,220,0.22)" stroke-width="1"/><line x1="56" y1="30" x2="56" y2="276" stroke="rgba(232,228,220,0.22)" stroke-width="1"/><text x="48" y="102" text-anchor="end" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">1</text><text x="48" y="226" text-anchor="end" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">0</text><text x="56" y="22" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.4)">radical concentration y&#8322;</text><text x="56" y="294" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">t = 0</text><text x="648" y="294" text-anchor="end" id="w4tend" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">t = 5</text><path id="w4ex" d="" fill="none" stroke="rgba(232,228,220,0.45)" stroke-width="1.5" stroke-dasharray="5 4"/><path id="w4trap" d="" fill="none" stroke="#b09fd6" stroke-width="1.5"/><path id="w4imp" d="" fill="none" stroke="#82c9a0" stroke-width="1.6"/><path id="w4exp" d="" fill="none" stroke="#c4956a" stroke-width="1.6"/></svg><div class="viz-ctrl"><label for="w4dt">step size</label><input type="range" id="w4dt" min="0" max="100" step="1" value="40"><span class="viz-val" id="w4dtv">0.00100</span></div><div class="viz-stats"><div class="viz-stat"><div class="viz-stat-l">Steps to reach t = 5</div><div class="viz-stat-v" id="w4n">5,000</div></div><div class="viz-stat"><div class="viz-stat-l">Explicit &mdash; worst error</div><div class="viz-stat-v" id="w4ee" style="font-size:.85rem;color:#c4956a">4.0e-4</div></div><div class="viz-stat"><div class="viz-stat-l">Implicit &mdash; worst error</div><div class="viz-stat-v" id="w4ie" style="font-size:.85rem;color:#82c9a0">5.0e-4</div></div><div class="viz-stat"><div class="viz-stat-l">Trapezoid &mdash; worst error</div><div class="viz-stat-v" id="w4te" style="font-size:.85rem;color:#b09fd6">2.5e-4</div></div></div><div class="viz-note">The explicit curve vanishes from the plot the instant the step passes 0.002, because it has left the visible range on its way to 10&#8311;&#8304;&#8304;. Everything to the right of that point on the slider is territory only an implicit method can enter. Note also that trapezoid stays bounded at every step size &mdash; it is A-stable &mdash; but look at the first 20 ms at a large step and you will catch it ringing: alternating above and below, decaying far too slowly. That is the L-stability problem from the table above, visible in the wild.</div></div>

<script>
(function(){
var TEND=5, zoom='full';
function exact(t){ return Math.exp(-t)-Math.exp(-1000*t); }
function px(t,W){ return 56+t/W*592; }
function py(v){ return 272-(v+0.4)*124.2; }
function run(dt,kind){
  var y1=1, y2=0, t=0, pts=[[0,0]], worst=0, bad=false, n=Math.ceil(TEND/dt);
  if(n>200000) n=200000;
  for(var i=0;i<n;i++){
    var a1,a2;
    if(kind==='exp'){ a1=y1+dt*(-y1); a2=y2+dt*(999*y1-1000*y2); }
    else if(kind==='imp'){ a1=y1/(1+dt); a2=(y2+dt*999*a1)/(1+1000*dt); }
    else { a1=y1*(1-dt/2)/(1+dt/2); a2=(y2*(1-500*dt)+499.5*dt*(y1+a1))/(1+500*dt); }
    y1=a1; y2=a2; t+=dt;
    if(!isFinite(y2)||Math.abs(y2)>1e6){ bad=true; break; }
    var e=Math.abs(y2-exact(t)); if(e>worst) worst=e;
    if(Math.abs(y2)>4){ bad=true; pts.push([t,y2]); break; }
    pts.push([t,y2]);
  }
  return {pts:pts, worst:worst, bad:bad};
}
function pathFor(res,W){
  var out=[], pts=res.pts;
  var vis=[]; for(var i=0;i<pts.length;i++){ if(pts[i][0]<=W*1.001) vis.push(pts[i]); else break; }
  if(vis.length<2) return '';
  var st=Math.max(1,Math.ceil(vis.length/750));
  for(var j=0;j<vis.length;j+=st){
    var v=vis[j][1]; if(v>1.6||v<-0.45) { out.push(null); continue; }
    out.push(px(vis[j][0],W).toFixed(1)+' '+py(v).toFixed(1));
  }
  var segs=[], cur=[];
  for(var k=0;k<out.length;k++){ if(out[k]===null){ if(cur.length>1)segs.push('M'+cur.join(' L')); cur=[]; } else cur.push(out[k]); }
  if(cur.length>1) segs.push('M'+cur.join(' L'));
  return segs.join(' ');
}
function fmt(r){ return r.bad?'diverged':(r.worst>1e3?'diverged':r.worst.toExponential(1)); }
function draw(){
  var u=+document.getElementById('w4dt').value/100;
  var dt=Math.pow(10,-4+u*(Math.log(0.2)/Math.LN10+4));
  document.getElementById('w4dtv').textContent=dt.toFixed(5);
  var W=(zoom==='full')?TEND:0.02;
  document.getElementById('w4tend').textContent=(zoom==='full')?'t = 5':'t = 0.02';
  var ed=[]; for(var i=0;i<=300;i++){ var t=W*i/300; ed.push(px(t,W).toFixed(1)+' '+py(exact(t)).toFixed(1)); }
  document.getElementById('w4ex').setAttribute('d','M'+ed.join(' L'));
  var re=run(dt,'exp'), ri=run(dt,'imp'), rt=run(dt,'trap');
  document.getElementById('w4exp').setAttribute('d',pathFor(re,W));
  document.getElementById('w4imp').setAttribute('d',pathFor(ri,W));
  document.getElementById('w4trap').setAttribute('d',pathFor(rt,W));
  document.getElementById('w4n').textContent=Math.ceil(TEND/dt).toLocaleString();
  document.getElementById('w4ee').textContent=fmt(re);
  document.getElementById('w4ie').textContent=fmt(ri);
  document.getElementById('w4te').textContent=fmt(rt);
}
document.getElementById('w4zoom').addEventListener('click',function(e){
  if(e.target.tagName!=='BUTTON')return;
  [].forEach.call(this.children,function(b){b.classList.remove('on');}); e.target.classList.add('on');
  zoom=e.target.getAttribute('data-z'); draw(); });
document.getElementById('w4dt').addEventListener('input',draw);
draw();
})();
</script>

Put numbers on it. To integrate this system to $t = 5$ with a tolerance you would actually accept:

| | Step limited by | Step size | Steps | Work per step |
|---|---|---|---|---|
| Explicit Euler | stability of the *fast* mode | 0.002 | 2,500 | 1 function call |
| Implicit Euler | accuracy of the *slow* mode | 0.05 | 100 | ~3 Newton iterations, each with a Jacobian and a linear solve |

Twenty-five times fewer steps, each maybe fifteen times more expensive. On this toy the two roughly cancel. Now change one number &mdash; make the fast eigenvalue $-10^6$ instead of $-10^3$, which is utterly ordinary for real chemistry &mdash; and explicit Euler needs 2.5 million steps while implicit Euler still needs 100. The implicit method's step size never learned about the fast mode at all. **That is the whole point: implicit methods decouple your step size from the stiffness of your problem.**

## The four ideas

That is Part 1. If you remember nothing else:

1. **A method is a choice of where to sample the slope.** Sample where you are and you get a formula; sample where you land and you get an equation. Everything else follows from that.
2. **Each mode of a linear system gets multiplied by $R(\lambda \Delta t)$ once per step.** The method is fully characterised by that one function.
3. **Stiffness is when the fastest mode constrains your step long after it stops affecting the answer.** It is a ratio of timescales, not a size, and no amount of accuracy tolerance makes it go away.
4. **Implicit methods buy stability with a nonlinear solve, and the price of that solve is the Jacobian.** Newton converges quadratically, which makes it affordable; forming and factoring $\partial f/\partial y$ is what makes it expensive.

### What Part 2 covers

Implicit Euler is first-order accurate, which is poor. To halve the error you double the work, forever. Real solvers &mdash; CVODE, LSODE, DASSL, the stiff integrators inside every CFD code &mdash; are not implicit Euler. They are **BDF** methods: implicit, high-order, and built out of the solution history rather than a single previous point. Part 2 derives them from scratch, explains what "order" actually buys you, covers Richardson extrapolation and the extrapolation tableau as the other route to high order, and shows why nobody uses BDF past order six.

Part 3 then takes the single most expensive line in the whole algorithm &mdash; solve a linear system with $I - \Delta t J$ &mdash; and makes it fast: analytic Jacobians, sparsity and graph colouring, sparse direct factorisation, Krylov methods with matrix-free products, and preconditioning.
