---
slug: stiff-odes-3-fast-bdf
category: research
date: November 2026
title: Making BDF Fast
excerpt: Part 3 of 3. Inside the one line where stiff solvers spend all their time. Analytic versus finite-difference Jacobians, sparsity and graph colouring, sparse direct factorisation, matrix-free Krylov methods, preconditioning, and the cheapest trick of all — not recomputing the Jacobian.
readTime: 25 min
tags: [Numerical Methods, Sparse Linear Algebra, Krylov, Jacobian, BDF, Interactive]
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

<div class="series-nav">A three-part series on stiff ODE integration.<br>Part 1 &mdash; <a href="/blog/html/stiff-odes-1-explicit-implicit.html">Why your ODE solver blows up.</a> Explicit vs implicit, stability, the Newton solve.<br>Part 2 &mdash; <a href="/blog/html/stiff-odes-2-extrapolation-bdf.html">How real solvers take big steps.</a> Order, extrapolation, BDF.<br><b>Part 3 &mdash; Making BDF fast.</b> Sparse Jacobians, Krylov, analytic derivatives. <em>You are here.</em></div>

By the end of Part 2 we had a working stiff solver: BDF, adaptive order, adaptive step, Newton at its core. It is correct. On a serious problem it is also slow, and all of the slowness lives in one line.

Every Newton iteration, of every step, solves

<div class="mathd">
\[ \underbrace{\left(I - \Delta t\,\beta_0\, J\right)}_{\text{the iteration matrix}}\, \delta \;=\; -G(y^{(k)}), \qquad J = \frac{\partial f}{\partial y} \]
</div>

That is a dense $n \times n$ linear system if you write it naively, where $n$ is the number of state variables. For a 53-species methane mechanism, $n = 54$. For a reduced $n$-heptane mechanism, $n \approx 200$. For a detailed one, $n$ is in the thousands. And in a CFD run you do this in *every cell, every timestep* &mdash; millions of times per second of simulated flow.

This post is about the four things that make that line fast. In rough order of how much they buy you:

1. Do not compute $J$ by finite differences if you can help it.
2. Do not store or factor the zeros &mdash; chemistry Jacobians are mostly zeros.
3. Do not form $J$ at all if you can get away with Krylov methods.
4. Above all: **do not recompute $J$.** Most of the time you can reuse the one you have.

## Where the time actually goes

First, honest accounting. Here is a scaling model of one BDF step. These are not benchmark numbers &mdash; they are the leading-order operation counts with plausible constants, which is enough to show you the *shape* of the problem and where the crossovers sit.

<div class="viz"><div class="viz-title">Interactive 10 &mdash; Cost of one BDF step as the system grows</div><div class="viz-legend"><i><span class="viz-sw" style="border-top-color:#c4956a"></span>dense: FD Jacobian + dense LU</i><i><span class="viz-sw" style="border-top-color:#82c9a0"></span>sparse: analytic Jacobian + sparse LU</i><i><span class="viz-sw" style="border-top-color:#b09fd6"></span>matrix-free: preconditioned Krylov</i></div><svg viewBox="0 0 680 330" role="img"><title>Modelled cost per step against system size</title><desc>Log-log plot of modelled floating point work per BDF step against the number of state variables, for dense, sparse and matrix-free strategies.</desc><g id="w9grid"></g><path id="w9d" d="" fill="none" stroke="#c4956a" stroke-width="1.8"/><path id="w9s" d="" fill="none" stroke="#82c9a0" stroke-width="1.8"/><path id="w9k" d="" fill="none" stroke="#b09fd6" stroke-width="1.8"/><line id="w9v" x1="0" y1="38" x2="0" y2="280" stroke="rgba(201,168,76,0.6)" stroke-width="1.2" stroke-dasharray="4 4"/><g id="w9m"></g></svg><div class="viz-ctrl"><label for="w9n">species n</label><input type="range" id="w9n" min="0" max="100" step="1" value="42"><span class="viz-val" id="w9nv">53</span></div><div class="viz-stats"><div class="viz-stat"><div class="viz-stat-l">Dense cost</div><div class="viz-stat-v" id="w9cd" style="font-size:.88rem;color:#c4956a">&mdash;</div></div><div class="viz-stat"><div class="viz-stat-l">Sparse cost</div><div class="viz-stat-v" id="w9cs" style="font-size:.88rem;color:#82c9a0">&mdash;</div></div><div class="viz-stat"><div class="viz-stat-l">Matrix-free cost</div><div class="viz-stat-v" id="w9ck" style="font-size:.88rem;color:#b09fd6">&mdash;</div></div><div class="viz-stat"><div class="viz-stat-l">Dominant term, dense</div><div class="viz-stat-v" id="w9dom" style="font-size:.78rem">&mdash;</div></div></div><div class="viz-note">Model: one f evaluation costs 10n. Dense builds the Jacobian with n extra f evaluations and factors it in 2n&sup3;/3. Sparse builds it analytically in 25n and factors in 21&middot;n^1.4. Matrix-free runs 15 Krylov iterations, each costing one f evaluation plus orthogonalisation, with a banded preconditioner. Two Newton iterations per step throughout. The exponents are what matter &mdash; 3 versus 1.4 versus 1 &mdash; and no tuning of the constants changes which curve wins in the end.</div></div>

<script>
(function(){
var LN0=1, LN1=3.5, LY0=2, LY1=11;
function px(l){ return 62+(l-LN0)/(LN1-LN0)*570; }
function py(l){ return 38+(LY1-l)/(LY1-LY0)*242; }
function costs(n){
  var fev=10*n, newt=2;
  var dense=fev*(1+n) + (2/3)*n*n*n + newt*(2*n*n) + newt*fev;
  var sparse=25*n + 21*Math.pow(n,1.4) + newt*(20*n) + newt*fev + 200*n;
  var m=15, krylov=newt*m*(fev + 4*m*n + 20*n) + 21*Math.pow(n,1.2) + newt*fev;
  return {dense:dense,sparse:sparse,krylov:krylov};
}
function curve(key){
  var d=[];
  for(var i=0;i<=120;i++){
    var ln=LN0+(LN1-LN0)*i/120, n=Math.pow(10,ln), c=costs(n)[key];
    var ly=Math.log(c)/Math.LN10;
    if(ly<LY0||ly>LY1) continue;
    d.push(px(ln).toFixed(1)+' '+py(ly).toFixed(1));
  }
  return d.length?'M'+d.join(' L'):'';
}
var g='';
for(var e=1;e<=3;e++){
  g+='<line x1="'+px(e).toFixed(1)+'" y1="38" x2="'+px(e).toFixed(1)+'" y2="280" stroke="rgba(232,228,220,0.07)" stroke-width="1"/>';
  g+='<text x="'+px(e).toFixed(1)+'" y="298" text-anchor="middle" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.4)">'+Math.pow(10,e)+'</text>';
}
for(var y=LY0;y<=LY1;y+=2){
  g+='<line x1="62" y1="'+py(y).toFixed(1)+'" x2="632" y2="'+py(y).toFixed(1)+'" stroke="rgba(232,228,220,0.07)" stroke-width="1"/>';
  g+='<text x="54" y="'+(py(y)+3.5).toFixed(1)+'" text-anchor="end" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.4)">1e'+y+'</text>';
}
g+='<text x="347" y="320" text-anchor="middle" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">number of species n</text>';
g+='<text x="62" y="26" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">modelled flops per step</text>';
document.getElementById('w9grid').innerHTML=g;
document.getElementById('w9d').setAttribute('d',curve('dense'));
document.getElementById('w9s').setAttribute('d',curve('sparse'));
document.getElementById('w9k').setAttribute('d',curve('krylov'));
function fmt(c){ return c.toExponential(1).replace('e+',' × 10^'); }
function upd(){
  var u=+document.getElementById('w9n').value/100, ln=LN0+u*(LN1-LN0), n=Math.round(Math.pow(10,ln));
  document.getElementById('w9nv').textContent=n.toLocaleString();
  var L=document.getElementById('w9v'); L.setAttribute('x1',px(ln).toFixed(1)); L.setAttribute('x2',px(ln).toFixed(1));
  var c=costs(n), m='';
  [['dense','#c4956a'],['sparse','#82c9a0'],['krylov','#b09fd6']].forEach(function(kc){
    var ly=Math.log(c[kc[0]])/Math.LN10;
    if(ly>=LY0&&ly<=LY1) m+='<circle cx="'+px(ln).toFixed(1)+'" cy="'+py(ly).toFixed(1)+'" r="4.5" fill="'+kc[1]+'"/>';
  });
  document.getElementById('w9m').innerHTML=m;
  document.getElementById('w9cd').textContent=fmt(c.dense);
  document.getElementById('w9cs').textContent=fmt(c.sparse);
  document.getElementById('w9ck').textContent=fmt(c.krylov);
  var lu=(2/3)*n*n*n, jac=10*n*(1+n), pct=Math.round(100*lu/c.dense), jp=Math.round(100*jac/c.dense);
  document.getElementById('w9dom').textContent='LU '+pct+'%, Jacobian '+jp+'%';
}
document.getElementById('w9n').addEventListener('input',upd);
upd();
})();
</script>

Push the slider to a realistic mechanism size and read the last card. At $n = 53$ the dense factorisation is already around half the cost of a step and the finite-difference Jacobian most of the rest; by $n = 500$ the factorisation is essentially the entire step and everything else is rounding error. The $n^3$ is not a detail. It is the whole problem.

Everything below is an attack on one of those two terms.

## Attack 1: stop computing the Jacobian badly

You need $\partial f_i / \partial y_j$ for every $i$ and $j$. There are three ways to get it, and they are not close to equivalent.

**Finite differences.** Perturb one variable, re-evaluate the whole right-hand side, subtract:

<div class="mathd">
\[ \frac{\partial f}{\partial y_j} \approx \frac{f(y + \sigma e_j) - f(y)}{\sigma}, \qquad \sigma \approx \sqrt{\varepsilon_{\text{mach}}}\,\max(|y_j|,\, y_{\text{typ}}) \]
</div>

Costs $n$ extra evaluations of $f$ per Jacobian. It is what every solver falls back on when you do not supply anything better, and it has a nasty property: you only get about half your digits. The step $\sigma$ has to balance truncation error (which wants $\sigma$ small) against cancellation in the subtraction (which wants $\sigma$ large), and the best you can do is $\sqrt{\varepsilon} \approx 10^{-8}$ relative accuracy. A sloppy Jacobian does not make the *answer* wrong &mdash; Newton converges to the root of $G$ regardless, because $J$ only steers the iteration &mdash; but it absolutely makes Newton converge slower, and slower Newton means more linear solves.

**Analytic.** Differentiate the rate expressions by hand or, far better, generate the code. For mass-action kinetics with Arrhenius rates this is entirely mechanical: every term in $f$ is a product of powers and an exponential, and its derivative is another product of powers. Tools like pyJac, TChem and Cantera's analytic Jacobian do exactly this, emitting straight-line code. Cost: $O(n)$ rather than $O(n^2)$, because you walk the reaction list once instead of re-evaluating $f$ $n$ times. Accuracy: exact to machine precision. If you are running the same mechanism a billion times, this is the single highest-leverage thing you can do.

**Automatic differentiation.** Run $f$ through an AD tool and get exact derivatives without deriving anything. Forward mode costs roughly the same as the finite-difference approach but is exact; reverse mode is cheaper for few outputs, which is not our case. A good middle path when the right-hand side is complicated enough that hand-derivation is error-prone.

| | Cost per Jacobian | Accuracy | Effort |
|---|---|---|---|
| Finite differences | $n$ evaluations of $f$ | ~8 digits | none |
| Finite differences + colouring | ~25 evaluations of $f$ | ~8 digits | need the sparsity pattern |
| Automatic differentiation | ~$n$ evaluations, exact | machine | tooling |
| Analytic / generated code | $O(n)$, one pass | machine | generator, or real work |

That second row is the interesting one, and it needs the next idea.

## Attack 2: most of the Jacobian is zeros

Species $i$ only has a derivative with respect to species $j$ if they appear together in some reaction. In a large mechanism, most pairs of species never meet. The Jacobian is sparse, and it gets sparser as the mechanism grows, because each species keeps participating in roughly the same handful of reactions no matter how many other species exist.

And sparsity buys something beyond skipping zeros in the factorisation. Suppose two columns of $J$ have no nonzero rows in common &mdash; they are *structurally orthogonal*. Then you can perturb **both** variables at once, in a single evaluation of $f$, and read off both columns without ambiguity, because no row receives a contribution from both. Group all the columns this way and the finite-difference Jacobian costs one evaluation per *group* instead of one per column.

Finding the smallest number of groups is exactly graph colouring: build a graph whose vertices are columns, join two columns that share a row, and colour it. This is the Curtis&ndash;Powell&ndash;Reid idea, and it is why every serious solver wants you to hand it a sparsity pattern.

<div class="viz"><div class="viz-title">Interactive 11 &mdash; Sparsity and colouring</div><div class="viz-seg" id="w10seg"><button data-m="plain" class="on">Pattern</button><button data-m="col">Columns coloured</button></div><canvas id="w10c" width="440" height="440" style="width:100%;max-width:440px;margin:0 auto;display:block" role="img" aria-label="Sparsity pattern of a model chemical Jacobian, optionally coloured by structurally orthogonal column groups."></canvas><div class="viz-ctrl"><label for="w10n">species n</label><input type="range" id="w10n" min="24" max="300" step="2" value="53"><span class="viz-val" id="w10nv">53</span></div><div class="viz-stats"><div class="viz-stat"><div class="viz-stat-l">Density</div><div class="viz-stat-v" id="w10d" style="font-size:.9rem">&mdash;</div></div><div class="viz-stat"><div class="viz-stat-l">Colour groups</div><div class="viz-stat-v" id="w10g" style="font-size:.9rem;color:#82c9a0">&mdash;</div></div><div class="viz-stat"><div class="viz-stat-l">f evals: plain &rarr; coloured</div><div class="viz-stat-v" id="w10e" style="font-size:.82rem">&mdash;</div></div><div class="viz-stat"><div class="viz-stat-l">Speedup</div><div class="viz-stat-v" id="w10s" style="font-size:.9rem;color:#c9a84c">&mdash;</div></div></div><div class="viz-note">This is a model mechanism &mdash; reactions drawn mostly between neighbouring species with occasional long-range coupling &mdash; but it behaves like the real thing. Drag n upward and watch two numbers move in opposite directions: density falls, because each species still only talks to a few others, while the colour count barely moves at all. It saturates somewhere in the twenties and stays there. The number of groups is set by how tangled the local coupling is, not by how big the system is, so the saving grows linearly with n forever.</div></div>

<script>
(function(){
var cv=document.getElementById('w10c'), ctx=cv.getContext('2d'), mode='plain';
var DPR=Math.min(2,window.devicePixelRatio||1);
cv.width=440*DPR; cv.height=440*DPR;
function pattern(n){
  var s=12345, rnd=function(){ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  var P=[]; for(var i=0;i<n;i++) P.push(new Uint8Array(n));
  for(var i2=0;i2<n;i2++) P[i2][i2]=1;
  var R=Math.round(2.2*n);
  for(var r=0;r<R;r++){
    var b=Math.floor(rnd()*n), sp=[b];
    for(var q=0;q<2;q++){
      var j = rnd()<0.75 ? (b+1+Math.floor(rnd()*6))%n : Math.floor(rnd()*n);
      sp.push(j);
    }
    for(var a=0;a<sp.length;a++) for(var c=0;c<sp.length;c++) P[sp[a]][sp[c]]=1;
  }
  return P;
}
function colour(P){
  var n=P.length, conf=[];
  for(var j=0;j<n;j++) conf.push(new Set());
  for(var i=0;i<n;i++){
    var cols=[]; for(var j2=0;j2<n;j2++) if(P[i][j2]) cols.push(j2);
    for(var a=0;a<cols.length;a++) for(var b=0;b<cols.length;b++) if(a!==b) conf[cols[a]].add(cols[b]);
  }
  var ord=[]; for(var j3=0;j3<n;j3++) ord.push(j3);
  ord.sort(function(x,y){ return conf[y].size-conf[x].size; });
  var col=new Int32Array(n).fill(-1);
  for(var k=0;k<n;k++){
    var j4=ord[k], used=new Set();
    conf[j4].forEach(function(m){ if(col[m]>=0) used.add(col[m]); });
    var c2=0; while(used.has(c2)) c2++;
    col[j4]=c2;
  }
  var mx=0; for(var z=0;z<n;z++) if(col[z]>mx) mx=col[z];
  return {ncol:mx+1, col:col};
}
function render(){
  var n=+document.getElementById('w10n').value;
  document.getElementById('w10nv').textContent=n;
  var P=pattern(n), C=colour(P), nnz=0, cell=440/n;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,440,440);
  ctx.fillStyle='rgba(255,255,255,0.025)'; ctx.fillRect(0,0,440,440);
  for(var i=0;i<n;i++){
    for(var j=0;j<n;j++){
      if(!P[i][j]) continue;
      nnz++;
      if(mode==='plain') ctx.fillStyle='rgba(201,168,76,0.8)';
      else { var h=(C.col[j]*137.5)%360; ctx.fillStyle='hsl('+h.toFixed(0)+',58%,62%)'; }
      ctx.fillRect(j*cell, i*cell, Math.max(cell-(cell>4?0.6:0),0.7), Math.max(cell-(cell>4?0.6:0),0.7));
    }
  }
  ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.lineWidth=1; ctx.strokeRect(0.5,0.5,439,439);
  document.getElementById('w10d').textContent=(100*nnz/(n*n)).toFixed(1)+'%';
  document.getElementById('w10g').textContent=C.ncol;
  document.getElementById('w10e').textContent=(n+1)+' → '+(C.ncol+1);
  document.getElementById('w10s').textContent=((n+1)/(C.ncol+1)).toFixed(1)+'×';
}
document.getElementById('w10seg').addEventListener('click',function(e){
  if(e.target.tagName!=='BUTTON')return;
  [].forEach.call(this.children,function(b){b.classList.remove('on');}); e.target.classList.add('on');
  mode=e.target.getAttribute('data-m'); render(); });
document.getElementById('w10n').addEventListener('input',render);
render();
})();
</script>

Sparsity pays a second time at factorisation. A sparse LU only touches the structural nonzeros, so instead of $\tfrac{2}{3}n^3$ you pay something closer to $O(n^{1.3})$ to $O(n^{1.5})$ for chemistry-shaped matrices. Two practical details decide whether you actually get that:

**Fill-in and ordering.** LU factors of a sparse matrix are denser than the matrix &mdash; eliminating a variable connects all its neighbours to each other. How much denser depends enormously on the order you eliminate in, and finding the optimal order is NP-hard, so codes use heuristics: approximate minimum degree (AMD), COLAMD, nested dissection. Picking a good ordering can be the difference between 2&times; fill and 50&times; fill.

**Symbolic versus numeric factorisation.** The *pattern* of the factors depends only on the sparsity structure, which never changes across a whole run. So you compute the ordering and the symbolic factorisation **once**, and every subsequent factorisation just pushes new numbers through a fixed structure. This is why KLU is the default sparse solver in SUNDIALS for chemistry: it is built around exactly this reuse pattern.

## Attack 3: never form the Jacobian at all

Here is the observation that opens the door. Newton does not need $J$. Newton needs to *solve a linear system with* $J$. And if you solve that system with an iterative method rather than a direct one, the only thing the iterative method ever asks for is the product of the matrix with a vector.

Which you can get without the matrix:

<div class="mathd">
\[ J v \;\approx\; \frac{f(y + \sigma v) - f(y)}{\sigma} \]
</div>

One extra evaluation of $f$, and you have a Jacobian-vector product to finite-difference accuracy, having never allocated an $n \times n$ array, never filled it, and never factored it. This is **matrix-free** or **Jacobian-free Newton&ndash;Krylov**, and for very large systems it is the only game in town.

The iterative method of choice for these nonsymmetric systems is **GMRES**. It builds a Krylov subspace $\text{span}\{r_0, Ar_0, A^2r_0, \dots\}$ and, at each iteration, returns the vector in that subspace minimising the residual. Its convergence depends almost entirely on how the eigenvalues of $A$ are distributed: tightly clustered spectrum, fast convergence; eigenvalues smeared across orders of magnitude, misery.

And a stiff iteration matrix has eigenvalues smeared across orders of magnitude *by construction*. That is what stiff means. So GMRES applied naively to a stiff problem does exactly what you would fear:

<div class="viz"><div class="viz-title">Interactive 12 &mdash; GMRES on a stiff iteration matrix</div><div class="viz-legend"><i><span class="viz-sw" style="border-top-color:#d4705f"></span>no preconditioner</i><i><span class="viz-sw" style="border-top-color:#c4956a"></span>diagonal (Jacobi)</i><i><span class="viz-sw" style="border-top-color:#82c9a0"></span>banded / block</i><i><span class="viz-sw" style="border-top-color:rgba(201,168,76,0.7);border-top-style:dashed"></span>convergence target</i></div><svg viewBox="0 0 680 320" role="img"><title>GMRES relative residual against iteration count</title><desc>Semi-log plot of the GMRES relative residual versus iteration number for three preconditioning choices on a stiff iteration matrix.</desc><g id="w11grid"></g><path id="w11a" d="" fill="none" stroke="#d4705f" stroke-width="1.8"/><path id="w11b" d="" fill="none" stroke="#c4956a" stroke-width="1.8"/><path id="w11c" d="" fill="none" stroke="#82c9a0" stroke-width="1.8"/></svg><div class="viz-ctrl"><label for="w11s">stiffness, decades</label><input type="range" id="w11s" min="1" max="9" step="1" value="7"><span class="viz-val" id="w11sv">7</span></div><div class="viz-stats"><div class="viz-stat"><div class="viz-stat-l">None &mdash; iters to 1e-10</div><div class="viz-stat-v" id="w11n" style="font-size:.85rem;color:#d4705f">&mdash;</div></div><div class="viz-stat"><div class="viz-stat-l">Jacobi &mdash; iters</div><div class="viz-stat-v" id="w11j" style="font-size:.85rem;color:#c4956a">&mdash;</div></div><div class="viz-stat"><div class="viz-stat-l">Banded &mdash; iters</div><div class="viz-stat-v" id="w11t" style="font-size:.85rem;color:#82c9a0">&mdash;</div></div><div class="viz-stat"><div class="viz-stat-l">Matrix-vector products saved</div><div class="viz-stat-v" id="w11r" style="font-size:.85rem;color:#c9a84c">&mdash;</div></div></div><div class="viz-note">A real 120-variable iteration matrix &mdash; banded transport plus reaction rates spanning the chosen number of decades, plus off-band species coupling &mdash; solved with real GMRES, computed live in your browser. Turn the stiffness down to one or two decades and all three curves converge quickly; that is a non-stiff problem and you do not need any of this. Turn it up and the unpreconditioned curve flattens into a useless crawl while the preconditioned ones barely notice. Every iteration is one evaluation of f, so the vertical gap between those curves is the entire argument for preconditioning.</div></div>

<script>
(function(){
var n=120, MAXIT=70, TARGET=-10;
function build(spread){
  var h=1.0, d=30.0, rows=[];
  for(var i=0;i<n;i++){
    var rate=-Math.pow(10, spread*i/n), m={};
    m[i]=1-h*(rate-2*d);
    if(i>0) m[i-1]=(m[i-1]||0)-h*d;
    if(i<n-1) m[i+1]=(m[i+1]||0)-h*d;
    var c1=(i*7+17)%n, c2=(i*13+43)%n;
    m[c1]=(m[c1]||0)-h*0.35*Math.abs(rate)*0.02;
    m[c2]=(m[c2]||0)-h*0.20*Math.abs(rate)*0.02;
    var idx=[], val=[];
    for(var k in m){ idx.push(+k); val.push(m[k]); }
    rows.push({idx:idx,val:val});
  }
  return rows;
}
function mv(A,x){
  var y=new Float64Array(n);
  for(var i=0;i<n;i++){ var r=A[i], s=0, ix=r.idx, vl=r.val;
    for(var k=0;k<ix.length;k++) s+=vl[k]*x[ix[k]];
    y[i]=s; }
  return y;
}
function nrm(v){ var s=0; for(var i=0;i<v.length;i++) s+=v[i]*v[i]; return Math.sqrt(s); }
function gmres(A,b,M){
  var x=new Float64Array(n), r=M(Float64Array.from(b)), bn=nrm(r);
  if(bn===0) return [1];
  var V=[Float64Array.from(r,function(v){return v/bn;})], cs=[], sn=[], g=[bn], res=[1];
  for(var k=0;k<MAXIT;k++){
    var w=M(mv(A,V[k])), hk=new Float64Array(k+2);
    for(var i=0;i<=k;i++){ var s=0; for(var j=0;j<n;j++) s+=w[j]*V[i][j]; hk[i]=s;
      for(var j2=0;j2<n;j2++) w[j2]-=s*V[i][j2]; }
    hk[k+1]=nrm(w);
    if(hk[k+1]>1e-300) V.push(Float64Array.from(w,function(v){return v/hk[k+1];}));
    for(var i2=0;i2<k;i2++){ var t=cs[i2]*hk[i2]+sn[i2]*hk[i2+1];
      hk[i2+1]=-sn[i2]*hk[i2]+cs[i2]*hk[i2+1]; hk[i2]=t; }
    var den=Math.hypot(hk[k],hk[k+1]); if(den===0) break;
    cs[k]=hk[k]/den; sn[k]=hk[k+1]/den; hk[k]=den;
    g[k+1]=-sn[k]*g[k]; g[k]=cs[k]*g[k];
    var rr=Math.abs(g[k+1])/bn; res.push(rr);
    if(rr<1e-12) break;
  }
  return res;
}
function PX(i){ return 60+i/MAXIT*572; }
function PY(l){ return 36+(0-l)/13*240; }
var g='';
for(var i=0;i<=MAXIT;i+=10){
  g+='<line x1="'+PX(i).toFixed(1)+'" y1="36" x2="'+PX(i).toFixed(1)+'" y2="276" stroke="rgba(232,228,220,0.07)" stroke-width="1"/>';
  g+='<text x="'+PX(i).toFixed(1)+'" y="294" text-anchor="middle" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.4)">'+i+'</text>';
}
for(var e=0;e>=-12;e-=3){
  g+='<line x1="60" y1="'+PY(e).toFixed(1)+'" x2="632" y2="'+PY(e).toFixed(1)+'" stroke="rgba(232,228,220,0.07)" stroke-width="1"/>';
  g+='<text x="52" y="'+(PY(e)+3.5).toFixed(1)+'" text-anchor="end" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.4)">1e'+e+'</text>';
}
g+='<line x1="60" y1="'+PY(TARGET).toFixed(1)+'" x2="632" y2="'+PY(TARGET).toFixed(1)+'" stroke="rgba(201,168,76,0.7)" stroke-width="1.2" stroke-dasharray="5 4"/>';
g+='<text x="346" y="314" text-anchor="middle" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">GMRES iteration (= one f evaluation each)</text>';
g+='<text x="60" y="26" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">relative residual</text>';
document.getElementById('w11grid').innerHTML=g;
function path(res){
  var d=[];
  for(var i=0;i<res.length;i++){
    var l=Math.log(Math.max(res[i],1e-13))/Math.LN10;
    d.push(PX(i).toFixed(1)+' '+PY(Math.max(l,-13)).toFixed(1));
  }
  return d.length?'M'+d.join(' L'):'';
}
function hit(res){ for(var i=0;i<res.length;i++) if(res[i]<1e-10) return i; return null; }
function run(){
  var sp=+document.getElementById('w11s').value;
  document.getElementById('w11sv').textContent=sp;
  var A=build(sp), b=new Float64Array(n);
  for(var i=0;i<n;i++) b[i]=Math.sin(i*0.7)+1;
  var diag=new Float64Array(n), sub=new Float64Array(n), sup=new Float64Array(n);
  for(var i2=0;i2<n;i2++){ var r=A[i2];
    for(var k=0;k<r.idx.length;k++){
      if(r.idx[k]===i2) diag[i2]=r.val[k];
      else if(r.idx[k]===i2-1) sub[i2]=r.val[k];
      else if(r.idx[k]===i2+1) sup[i2]=r.val[k];
    } }
  var none=function(v){ return v; };
  var jac=function(v){ var o=Float64Array.from(v); for(var i3=0;i3<n;i3++) o[i3]/=diag[i3]; return o; };
  var band=function(v){
    var c=new Float64Array(n), dd=new Float64Array(n), x=new Float64Array(n);
    c[0]=sup[0]/diag[0]; dd[0]=v[0]/diag[0];
    for(var i4=1;i4<n;i4++){ var m=diag[i4]-sub[i4]*c[i4-1];
      c[i4]=(i4<n-1?sup[i4]:0)/m; dd[i4]=(v[i4]-sub[i4]*dd[i4-1])/m; }
    x[n-1]=dd[n-1];
    for(var i5=n-2;i5>=0;i5--) x[i5]=dd[i5]-c[i5]*x[i5+1];
    return x; };
  var ra=gmres(A,b,none), rb=gmres(A,b,jac), rc=gmres(A,b,band);
  document.getElementById('w11a').setAttribute('d',path(ra));
  document.getElementById('w11b').setAttribute('d',path(rb));
  document.getElementById('w11c').setAttribute('d',path(rc));
  function lbl(r){ var h=hit(r); return h===null?'>'+MAXIT:String(h); }
  document.getElementById('w11n').textContent=lbl(ra);
  document.getElementById('w11j').textContent=lbl(rb);
  document.getElementById('w11t').textContent=lbl(rc);
  var hn=hit(ra), hc=hit(rc);
  document.getElementById('w11r').textContent=(hc===null?'—':((hn===null?MAXIT:hn)-hc)+' per solve');
}
document.getElementById('w11s').addEventListener('input',run);
run();
})();
</script>

**Preconditioning** is the fix, and it is the whole ballgame for Krylov methods. Instead of solving $A\delta = b$, solve $M^{-1}A\,\delta = M^{-1}b$ for some $M$ that is cheap to invert and resembles $A$ enough that $M^{-1}A$ has a clustered spectrum. The choices in practice:

- **Diagonal (Jacobi).** $M = \text{diag}(A)$. Almost free. Surprisingly effective when the stiffness lives on the diagonal, which in chemistry it largely does.
- **Incomplete LU, ILU(k).** Do a sparse LU but throw away fill-in beyond level $k$. The workhorse general-purpose choice.
- **Block diagonal.** In a reacting-flow code, precondition with the *chemistry* block only and ignore transport coupling, or the reverse. This is the standard move in large combustion codes, and it works because the two physics have very different structure.
- **Reuse an old factorisation.** Nothing says $M$ has to come from the current $A$. A factorisation of $A$ from fifty steps ago is usually a perfectly good preconditioner for $A$ today, which brings us to the last and best trick.

## Attack 4: don't recompute the Jacobian

This is the cheapest and most effective optimisation in the entire algorithm, and it is almost embarrassingly simple.

Newton's method converges quadratically **only** when you use the exact Jacobian. If you use a stale one, convergence drops to linear &mdash; you lose a fixed fraction of the error per iteration instead of doubling your digits. That sounds bad. But a linear rate of, say, 0.05 still reaches your tolerance in three or four iterations, and each of those iterations costs one cheap back-substitution against a factorisation you *already have*, instead of a fresh $O(n^3)$ factorisation.

This is **modified Newton**, and it means the real question is not "how do I factor faster" but "how long can I get away with not factoring at all?"

<div class="viz"><div class="viz-title">Interactive 13 &mdash; How often should you refactor?</div><div class="viz-legend"><i><span class="viz-sw" style="border-top-color:#82c9a0"></span>average cost per step</i><i><span class="viz-sw" style="border-top-color:rgba(201,168,76,0.8);border-top-style:dashed"></span>optimum</i><i><span class="viz-sw" style="border-top-color:#d4705f"></span>Newton failing</i></div><svg viewBox="0 0 680 310" role="img"><title>Average cost per step against Jacobian reuse interval</title><desc>Modelled average cost of a step as a function of how many steps a factorised Jacobian is reused, showing a clear minimum.</desc><g id="w12grid"></g><path id="w12p" d="" fill="none" stroke="#82c9a0" stroke-width="1.9"/><path id="w12bad" d="" fill="none" stroke="#d4705f" stroke-width="1.9"/><line id="w12opt" x1="0" y1="34" x2="0" y2="262" stroke="rgba(201,168,76,0.8)" stroke-width="1.3" stroke-dasharray="5 4"/><g id="w12m"></g></svg><div class="viz-ctrl"><label for="w12cj">cost of a refactorisation</label><input type="range" id="w12cj" min="5" max="300" step="5" value="60"><span class="viz-val" id="w12cjv">60&times;</span></div><div class="viz-stats"><div class="viz-stat"><div class="viz-stat-l">Best reuse interval</div><div class="viz-stat-v" id="w12best" style="font-size:.95rem;color:#c9a84c">&mdash;</div></div><div class="viz-stat"><div class="viz-stat-l">Cost at optimum</div><div class="viz-stat-v" id="w12co" style="font-size:.9rem">&mdash;</div></div><div class="viz-stat"><div class="viz-stat-l">Refactor every step</div><div class="viz-stat-v" id="w12c1" style="font-size:.9rem">&mdash;</div></div><div class="viz-stat"><div class="viz-stat-l">Saving</div><div class="viz-stat-v" id="w12sv" style="font-size:.9rem;color:#82c9a0">&mdash;</div></div></div><div class="viz-note">Model: a fresh Jacobian gives Newton a contraction rate of 0.005, which degrades geometrically as the solution moves away from where the Jacobian was taken. Iterations needed are whatever it takes to cut the error by 1e&#8722;6; a back-substitution costs 1 unit and a refactorisation costs what the slider says. The curve has a genuine minimum, and the minimum moves right as factorisation gets more expensive &mdash; which is exactly why big systems reuse harder. Past the red section Newton stops converging, the step is rejected, and the solver is forced to refactor anyway.</div></div>

<script>
(function(){
var LMAX=26, RHO0=0.005, TAU=2.0, TOL=1e-6, CAP=0.9;
function rho(s){ return RHO0*Math.exp(s/TAU); }
function iters(s){ var r=rho(s); if(r>=CAP) return null; return Math.max(2,Math.ceil(Math.log(TOL)/Math.log(r))); }
function avg(L,CJ){
  var tot=CJ, ok=true;
  for(var s=0;s<L;s++){ var m=iters(s); if(m===null){ ok=false; break; } tot+=m; }
  return ok?tot/L:null;
}
function PX(L){ return 62+(L-1)/(LMAX-1)*570; }
var YMAX;
function PY(c){ return 262-(c/YMAX)*228; }
function render(){
  var CJ=+document.getElementById('w12cj').value;
  document.getElementById('w12cjv').textContent=CJ+'×';
  var vals=[], best=null, bestL=1;
  for(var L=1;L<=LMAX;L++){ var a=avg(L,CJ); vals.push(a); if(a!==null&&(best===null||a<best)){ best=a; bestL=L; } }
  YMAX=Math.max.apply(null,vals.filter(function(v){return v!==null;}))*1.08;
  var g='';
  for(var L2=1;L2<=LMAX;L2+=5){
    g+='<line x1="'+PX(L2).toFixed(1)+'" y1="34" x2="'+PX(L2).toFixed(1)+'" y2="262" stroke="rgba(232,228,220,0.07)" stroke-width="1"/>';
    g+='<text x="'+PX(L2).toFixed(1)+'" y="280" text-anchor="middle" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.4)">'+L2+'</text>';
  }
  g+='<line x1="62" y1="262" x2="632" y2="262" stroke="rgba(232,228,220,0.22)" stroke-width="1"/>';
  g+='<text x="346" y="300" text-anchor="middle" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">steps between refactorisations</text>';
  g+='<text x="62" y="26" style="font-family:var(--mono);font-size:10px;fill:rgba(232,228,220,0.45)">average cost per step</text>';
  document.getElementById('w12grid').innerHTML=g;
  var good=[], bad=[];
  for(var i=0;i<vals.length;i++){
    if(vals[i]===null){ bad.push(PX(i+1).toFixed(1)+' '+PY(YMAX*0.97).toFixed(1)); }
    else good.push(PX(i+1).toFixed(1)+' '+PY(vals[i]).toFixed(1));
  }
  document.getElementById('w12p').setAttribute('d',good.length?'M'+good.join(' L'):'');
  document.getElementById('w12bad').setAttribute('d',bad.length>1?'M'+bad.join(' L'):'');
  var o=document.getElementById('w12opt');
  o.setAttribute('x1',PX(bestL).toFixed(1)); o.setAttribute('x2',PX(bestL).toFixed(1));
  document.getElementById('w12m').innerHTML='<circle cx="'+PX(bestL).toFixed(1)+'" cy="'+PY(best).toFixed(1)+'" r="5" fill="#c9a84c"/>';
  document.getElementById('w12best').textContent=bestL+' steps';
  document.getElementById('w12co').textContent=best.toFixed(1)+' units';
  var c1=avg(1,CJ);
  document.getElementById('w12c1').textContent=c1.toFixed(1)+' units';
  document.getElementById('w12sv').textContent=(c1/best).toFixed(1)+'× cheaper';
}
document.getElementById('w12cj').addEventListener('input',render);
render();
})();
</script>

Real solvers implement precisely this logic, and now you can read their source and recognise it. CVODE keeps a factorised copy of $I - \Delta t\beta_0 J$ and reuses it across steps. It forces a refresh when the step size or order changes enough that $\Delta t \beta_0$ has drifted (there is a literal constant in the code &mdash; a 30% change in $\Delta t\beta_0$ triggers it), when Newton fails to converge, when a step is rejected, or after a fixed maximum number of steps. Everything else &mdash; and that is most steps &mdash; runs on a Jacobian that is, strictly speaking, wrong, and converges perfectly well anyway.

## What to actually do

Mapping all of this onto a decision you might have to make tomorrow:

| Your situation | Jacobian | Linear solver | Reuse |
|---|---|---|---|
| $n \lesssim 50$, one-off run | finite differences | dense LU | default heuristics |
| $n \lesssim 50$, run a billion times | analytic / generated | dense LU | aggressive |
| $n$ from $10^2$ to $10^3$, chemistry sparsity | analytic, or FD with colouring | sparse direct (KLU), ordering computed once | aggressive |
| $n \gtrsim 10^3$, or stiff PDE coupling | matrix-free $Jv$ | preconditioned GMRES | reuse the preconditioner, not the matrix |
| Reacting CFD, many cells | analytic per cell | dense or sparse per cell | reuse across cells *and* steps |

In SUNDIALS terms, these correspond to swapping the linear solver module (dense, KLU, SPGMR), supplying your own Jacobian function instead of letting it finite-difference, supplying a Jacobian-times-vector function for the matrix-free route, and attaching a preconditioner. There are also controls for how long a factorisation may be reused and how much $\Delta t \beta_0$ may drift before a refresh is forced. The exact function names move between major versions, so check the docs for the version you are linking against rather than trusting a blog post &mdash; including this one.

Two final warnings that cost people real time:

**A wrong Jacobian does not produce a wrong answer, it produces a slow one.** Newton converges to the root of $G$ no matter what matrix you steer it with. So if you hand-code an analytic Jacobian and get a term wrong, nothing fails loudly &mdash; your run just gets mysteriously slower, which is a far worse failure mode than a crash. Always validate a new analytic Jacobian against a finite-difference one before trusting it.

**Profile before optimising.** The scaling argument in Interactive 10 says the factorisation dominates *eventually*. If your mechanism has thirty species and your right-hand side involves an expensive table lookup or a transport property evaluation, you may be spending most of your time in $f$, and the world's best sparse solver will buy you nothing.

## The series, in one paragraph

Explicit methods sample the slope where you are, which makes them cheap per step and chains their step size to the fastest mode in the system &mdash; fatal when that mode is dead but present. Implicit methods sample the slope where you land, which costs a nonlinear solve but decouples the step size from the stiffness entirely. Implicit Euler is only first order, so real solvers use BDF: the polynomial through the last $k$ points, forced to have the right slope at the new one, giving order $k$ for the price of order one, capped at six by stability and at two by Dahlquist if you insist on A-stability. And all the time goes into one linear system, which you make fast by computing the Jacobian analytically, exploiting its sparsity, replacing the factorisation with a preconditioned Krylov iteration, or &mdash; best of all &mdash; not recomputing it.

Which leaves the question that none of this answers: *given a particular state, which of these methods should you actually be running right now?* The right answer varies cell by cell and instant by instant, and in practice everyone picks one solver and uses it everywhere. That gap is where my own research lives, and it is a story for another post.
