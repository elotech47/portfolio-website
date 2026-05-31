---
slug: rl-solver-selection
category: research
date: May 2026
title: How I Taught a Reinforcement Learning Agent to Choose ODE Solvers
excerpt: A deep dive into the PPO + Lagrangian constraint formulation that drives my combustion simulation speedup work — benchmarks, failure modes, and what the ablation studies revealed.
readTime: 12 min
tags: [Reinforcement Learning, Combustion, ODE Solvers, PPO, Lagrangian Constraints]
---

Combustion simulations are expensive. Not in the vague, hand-wavy sense that people use when they mean "my laptop gets warm." Expensive as in: a single 3D turbulent flame simulation at realistic conditions can consume millions of CPU-hours. A significant chunk of that cost — often 60–90% — goes to solving the chemistry: a system of stiff ordinary differential equations (ODEs) describing hundreds of species reacting on timescales that span twelve orders of magnitude.

Two dominant integrators handle this in practice: **CVODE**, a robust BDF-based solver that handles stiffness reliably but conservatively; and **QSS** (Quasi-Steady-State), a faster algebraic approximation that works brilliantly in igniting conditions but can fail catastrophically on others. The standard approach? Pick one and use it everywhere.

That always struck me as wasteful. The choice of integrator is inherently a function of the local chemical state — temperature, composition, heat release rate. Some cells need CVODE. Others would be fine with QSS. The question is: can a learned agent make that call, faster and better than any static rule?

That question became my dissertation's core experiment.

---

## The Setup

The environment is a 0D homogeneous reactor — a canonical testbed for combustion chemistry. At each timestep, the agent observes the current chemical state (a normalized feature vector of temperature, pressure, and key species concentrations) and selects either CVODE or QSS to advance the solution forward.

The reward signal has two components:

1. **Speed reward**: proportional to the wallclock time saved vs. a CVODE-only baseline
2. **Accuracy penalty**: triggered when the agent's solution drifts outside a tolerance bound relative to a high-fidelity reference

The challenge is that these objectives are in tension. QSS is faster but riskier. A purely speed-maximizing agent learns to always pick QSS — and watches the solution blow up at ignition.

### The Lagrangian Constraint Formulation

Standard constrained RL (using barrier functions or penalty terms) tends to be brittle: the penalty coefficient becomes a hyperparameter that requires careful tuning, and the agent often oscillates between feasibility and infeasibility during training.

Instead, we used a **Lagrangian relaxation** approach. The constraint — that mean absolute error must stay below a threshold ε — is dualized into the objective via a Lagrange multiplier λ, which is updated online using gradient ascent:

```
λ_{t+1} = max(0, λ_t + α_λ · (C_t − ε))
```

Where `C_t` is the current constraint violation and `α_λ` is the dual learning rate. This gives the agent a self-adjusting pressure to respect accuracy bounds — λ grows when the agent is violating, shrinks when it's comfortably within bounds. No fixed penalty coefficient. No manual tuning.

The primal (policy) update runs PPO as normal. The dual update runs after every batch. It's clean, stable, and easy to implement on top of any existing PPO codebase.

---

## What the Numbers Actually Show

> The headline result: **4.65× mean speedup** (±0.34×) over a CVODE-only baseline, across 750 igniting conditions from the GRI-Mech 3.0 mechanism.

But the number alone doesn't tell you much. Here's what's more interesting:

### Where the agent learned to use QSS

The agent developed a clear policy structure that emerged without supervision:

- **Pre-ignition (T < 900K):** almost always CVODE. The chemistry is slow but the gradients are stiff in unintuitive ways. QSS fails silently here.
- **Near ignition (900K–1200K):** mixed policy. The agent learned to use QSS in short bursts, switching back to CVODE when species like OH spike.
- **Post-ignition (T > 1200K):** strongly favors QSS. The quasi-steady-state assumption holds well in high-temperature equilibrium-approaching conditions.

This is physically sensible. It's also something a domain expert might have written as a hand-coded heuristic. The agent rediscovered it from reward signals alone, across 24 different initial conditions spanning equivalence ratios from 0.6 to 1.6.

### The γ=0 ablation

This is the part I find most instructive. When we removed the Lagrangian constraint entirely (setting γ=0, effectively unconstrained PPO), the agent achieved **8.58× speedup** — nearly double our constrained result.

But the mean absolute error jumped **7× higher** than the constrained agent. In some conditions, the solution simply diverged.

The unconstrained agent is not better. It's faster in a way that's physically meaningless. The constraint isn't a limitation on performance — it's the definition of what "performance" means in scientific computing. Speed without accuracy is noise.

---

## Failure Modes Worth Knowing

The agent has failure modes that don't show up in aggregate metrics.

**Rapid fuel-air mixture switching.** When we evaluated on equivalence ratios outside the training distribution (φ < 0.5 or φ > 1.8), the policy became unstable — oscillating between CVODE and QSS at high frequency and achieving neither the speed of QSS nor the reliability of CVODE. Distribution shift in combustion conditions is a real deployment concern.

**Cold start conditions.** At very low initial temperatures (T₀ < 600K), the long induction period before ignition exposes the agent to thousands of timesteps of slow, non-igniting chemistry. The agent was undertrained on this regime and defaulted to QSS too aggressively.

**Timestep sensitivity in 3D environments.** The 0D/1D training environment uses adaptive timestepping. In PeleLMeX (the 3D AMR code), the global timestep is set by the most restrictive cell in the domain. The agent's switching behavior, trained for local optimality, can actually slow things down when it forces CVODE in cells that are "easy" but happen to set the global timestep. This is the unsolved problem at the frontier of the work.

---

## What's Next

The paper under review at *Combustion and Flame* addresses the first two failure modes through data augmentation and curriculum training. The third — the AMR global timestep problem — is the subject of a physics-informed dt-gate fix I'm designing now, where the agent's action space is conditioned on whether the current cell is the timestep-limiting cell.

If that works, it opens the door to deployment in PeleLMeX on the LONI QB2 cluster. Which is where the real test begins.

---

*The arXiv preprint is at [2604.00264](https://arxiv.org/abs/2604.00264). The code will be released upon journal acceptance.*
