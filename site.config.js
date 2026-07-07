/**
 * ============================================================
 *  SITE CONFIGURATION — Eloghosa Ikponmwoba Personal Website
 * ============================================================
 *  This is the single source of truth for all site content.
 *  Edit this file to update anything on the site.
 *  The HTML reads from this object — never edit content in HTML directly.
 *
 *  AGENT INSTRUCTION: When generating or updating site content,
 *  only modify values in this file. Never touch index.html structure.
 * ============================================================
 */

const SITE_CONFIG = {

  // ─────────────────────────────────────────
  //  IDENTITY
  // ─────────────────────────────────────────
  identity: {
    firstName: "Eloghosa",
    lastName:  "Ikponmwoba",
    initials:  "EI",
    year:      "2026",
    tagline:   "I build intelligent systems at the intersection of physical simulation, reinforcement learning, and engineering intuition — bridging the gap between theoretical rigor and real-world deployment.",
    eyebrow:   "PhD Candidate · Researcher · Builder",
    location:  "Baton Rouge, LA",
    email:     "eloghosaefficiency@gmail.com",
  },

  // ─────────────────────────────────────────
  //  ABOUT SECTION
  // ─────────────────────────────────────────
  about: {
    headline: ["Combustion.", "Intelligence.", "Precision."],
    paragraphs: [
      "I'm a PhD candidate (and concurrent Master's student) in Mechanical Engineering at Louisiana State University, specializing in reinforcement learning for adaptive ODE solver selection in combustion simulations — with a minor in Computer Science. My research sits at a rare intersection: making physics solvers smarter using AI decision layers.",
      "Previously, I worked as a Machine Learning Engineer at RIGR AI in Ireland, building AI systems for child protection and law enforcement. I contributed to an INTERPOL technical working group alongside work on dark-web scraping pipelines, semantic search engines, and deep learning models aimed at global public safety.",
      "My dissertation centers on RL as a decision layer for adaptive modeling in complex physical systems, with peer-reviewed publications spanning combustion science, multi-agent optimization, and biosensor AI. I am a co-inventor on a pending U.S. patent application for deep reinforcement learning applied to oil and gas field development — filed following internship work at Halliburton (not yet granted)."
    ],
    descriptors: [
      {
        word:   "Researcher",
        detail: "Physics-informed ML · Combustion · Multi-agent RL · GNN · Biosensors"
      },
      {
        word:   "Builder",
        detail: "FoamPilot · AXIS · SciDraft · ScholarSync · Custom solvers · LLMs"
      },
      {
        word:   "Storyteller",
        detail: "Sci-fi writer · AI literacy advocate · INTERPOL technical working group · Global"
      }
    ]
  },

  // ─────────────────────────────────────────
  //  RESEARCH SECTION
  //  Optional blog deep-dive: set blogSlug only when blog/html/<slug>.html exists
  //  (after `node build.js`). Omit or use null to hide "Read deep-dive" on the card.
  // ─────────────────────────────────────────
  research: [
    {
      id:          "rl-solver",
      index:       "arXiv · 2604.00264",
      title:       "RL-Based Adaptive ODE Solver Selection for Combustion Simulations",
      description: "A PPO agent with Lagrangian constraint formulation learns to dynamically switch between CVODE and QSS integrators across 0D/1D chemical kinetics environments — significant speedup with maintained accuracy bounds.",
      tags:        ["Reinforcement Learning", "Combustion", "ODE Solvers", "PPO"],
      link:        "https://arxiv.org/abs/2604.00264",
      blogSlug:    "rl-solver-selection"
    },
    {
      id:          "cf-revision",
      index:       "Under Review · Combustion & Flame",
      title:       "Adaptive Solver Selection Framework — Journal Submission",
      description: "Journal submission addressing reviewer comments on constraint formulation, cross-seed robustness benchmarks, and ablation studies of the unconstrained agent and its accuracy-speed tradeoff.",
      tags:        ["Lagrangian Constraints", "Ablation Study", "PCA Visualization"],
      link:        null,
      blogSlug:    null,
    },
    {
      id:          "deephive",
      index:       "arXiv · 2304.04751 · Algorithms 17(11), 2024",
      title:       "DeepHive: Swarm RL with Attention-Based Coordination",
      description: "A multi-agent swarm optimization framework using MAPPO with attention mechanisms for inter-agent coordination. Published in Algorithms journal; targeting IEEE Transactions on Evolutionary Computation for extended work.",
      tags:        ["MAPPO", "Swarm Intelligence", "Attention", "Multi-Agent RL"],
      link:        "https://doi.org/10.3390/a17110500",
      blogSlug:    null,
    },
    {
      id:          "gnn-reservoir",
      index:       "U.S. patent application pending · 2025",
      title:       "GNN + Deep RL for Oil & Gas Field Development",
      description: "Graph Neural Networks with deep RL for well placement optimization and reservoir field development. Achieved 23% improvement in spatial decision-making over traditional optimization approaches. U.S. patent application pending — not yet granted or assigned.",
      tags:        ["GNN", "Deep RL", "Reservoir Simulation", "Patent"],
      link:        null,
      blogSlug:    null,
    },
    {
      id:          "raman-covid",
      index:       "Biosensors · 12(8) · 2022",
      title:       "ML Framework for COVID-19 Detection via Raman Spectroscopy",
      description: "A machine learning framework for detecting COVID-19 infection using Surface-Enhanced Raman Scattering (SERS). Demonstrates the versatility of applying deep learning across diverse biomedical scientific domains beyond engineering.",
      tags:        ["Machine Learning", "Raman Spectroscopy", "COVID-19", "Biosensors"],
      link:        "https://doi.org/10.3390/bios12080589",
      blogSlug:    null
    },
    {
      id:          "soups-csam",
      index:       "SOUPS Workshop · 2022",
      title:       "Indicators of Child Sexual Abuse in App Stores",
      description: "Workshop paper (with Levine, Kumar, Farid, Dixon et al.) on detecting child sexual exploitation indicators on digital platforms — informing AI detection systems deployed by international law enforcement agencies.",
      tags:        ["Digital Safety", "Child Protection", "INTERPOL", "Applied ML"],
      link:        "https://people.cs.umass.edu/~brian/levine.kops22.pdf",
      blogSlug:    null
    }
  ],

  // ─────────────────────────────────────────
  //  PROJECTS SECTION
  // ─────────────────────────────────────────
  projects: [
    {
      id:       "foampilot",
      num:      "001",
      name:     "FoamPilot",
      subtitle: "Agentic OpenFOAM CFD workflow automation — template-first RAG, 5-agent orchestrator, FastAPI + Docker",
      link:     null
    },
    {
      id:       "axis",
      num:      "002",
      name:     "AXIS",
      subtitle: "Self-hosted personal AI operating system — Telegram + web UI + CLI, running on local server",
      link:     null
    },
    {
      id:       "scidraft",
      num:      "003",
      name:     "SciDraft",
      subtitle: "AI-powered scientific writing platform — end-to-end LLM pipeline for literature discovery, RAG, and citation management",
      link:     null
    },
    {
      id:       "scholarsync",
      num:      "004",
      name:     "ScholarSync",
      subtitle: "LLM-enabled PDF document intelligence — conversational Q&A, semantic chunking, and interactive research exploration",
      link:     null
    },
    {
      id:       "marginalia",
      num:      "005",
      name:     "Marginalia",
      subtitle: "Chrome extension for research annotation — FastAPI + Supabase backend, semantic search",
      link:     null
    },
    {
      id:       "llm-training",
      num:      "007",
      name:     "GPT-2 Scale LLM Training",
      subtitle: "~460M parameter model trained from scratch on 7B tokens — FineWeb-Edu, OWT, Wikipedia, StarCoder",
      link:     null
    },
  ],

  // ─────────────────────────────────────────
  //  EXPERIENCE SECTION
  // ─────────────────────────────────────────
  experience: [
    {
      period:      "Jan 2022 — Present",
      role:        "Graduate Research Assistant — PhD / M.S.",
      org:         "Louisiana State University, Baton Rouge",
      description: "RL-based adaptive solver selection in combustion simulations. PPO with Lagrangian constraints. CVODE/QSS integrator environments. PeleLMeX/PelePhysics deployment on LONI QB2 HPC cluster. Co-developed DeepHive multi-agent swarm RL framework. Applied ML to Raman spectroscopy for cancer cell detection."
    },
    {
      period:      "May — Aug 2025",
      role:        "Research Intern — GNN + RL Proxy Modeling",
      org:         "Halliburton Energy Services, Houston TX",
      description: "Designed and implemented a GNN-based RL system for reservoir field development optimization — 23% improvement in spatial decision-making over traditional approaches. Engineered scalable training environment integrating proprietary simulation tools. Co-inventor on a pending U.S. patent application for a novel deep RL approach to oil and gas field development (not yet granted)."
    },
    {
      period:      "2021 — 2026",
      role:        "Machine Learning Engineer",
      org:         "RIGR AI, Cork, Ireland (Remote)",
      description: "AI systems for child protection and law enforcement. Contributed via the INTERPOL technical working group. Built AI-based adaptive scrapers for dark web forums (ARICA project), enterprise semantic search using Vespa AI, GPU-accelerated summarization on AWS/Azure, and deep learning models for child sexual exploitation detection."
    }
  ],

  // ─────────────────────────────────────────
  //  AWARDS & RECOGNITION
  // ─────────────────────────────────────────
  awards: [
    {
      year:   "2020",
      title:  "NASA Space Apps Challenge",
      detail: "Galactic Problem Solver"
    },
    {
      year:   "2019",
      title:  "Siemens Energy Hackathon",
      detail: "Winner — Edo State, Nigeria"
    },
    {
      year:   "2018",
      title:  "APSA Science Challenge",
      detail: "Top 10 African Finalist — Addis Ababa, Ethiopia"
    },
    {
      year:   "2018",
      title:  "UN Academic Impact",
      detail: "Millennium Fellow"
    },
    {
      year:   "2017",
      title:  "HULT Prize",
      detail: "Campus Champion & National Finalist"
    },
    {
      year:   "2017",
      title:  "PTDF Full Scholarship",
      detail: "Petroleum Trust Development Fund — Undergraduate"
    }
  ],

  // ─────────────────────────────────────────
  //  BLOG POSTS
  //  Categories: "research" | "essay" | "project" | "opinion"
  // ─────────────────────────────────────────
  //  NOTE ON BLOG POSTS:
  //  published: true only when blog/html/<slug>.html exists (after `node build.js`).
  //  featured: true → shown on homepage blog section; all published posts appear on /blog/.
  blog: [
    {
      slug:      "rl-solver-selection",
      published: true,
      featured:  true,
      category:  "research",
      date:      "May 2025",
      title:     "How I Taught a Reinforcement Learning Agent to Choose ODE Solvers",
      excerpt:   "A deep dive into the PPO + Lagrangian constraint formulation that drives my combustion simulation speedup work — benchmarks, failure modes, and what the ablation studies revealed.",
      readTime:  "12 min",
      tags:      ["RL", "Combustion", "ODE", "PPO"]
    },
    {
      slug:      "ai-africa-urgency",
      published: true,
      featured:  true,
      category:  "opinion",
      date:      "April 2025",
      title:     "Africa Cannot Afford to Be Late to AI — Again",
      excerpt:   "The window for African nations to build foundational AI capacity is narrower than it appears. What needs to happen at the infrastructure, education, and policy levels — and why it matters personally.",
      readTime:  "8 min",
      tags:      ["AI Literacy", "Nigeria", "Africa", "Policy"]
    },
    {
      slug:      "foampilot-build",
      published: false,
      featured:  false,
      category:  "project",
      date:      "March 2025",
      title:     "Building FoamPilot: Agentic CFD for Engineers Who Hate YAML",
      excerpt:   "Why I built a five-agent orchestrator around OpenFOAM, what the template-first RAG architecture looks like in practice, and the three decisions I'd make differently today.",
      readTime:  "10 min",
      tags:      ["OpenFOAM", "Agents", "RAG", "CFD"]
    },
    {
      slug:      "gnn-reservoir-proxy",
      published: false,
      featured:  false,
      category:  "research",
      date:      "February 2025",
      title:     "GNN Proxy Models for Reservoir Optimization: What the Speedup Actually Means",
      excerpt:   "Breaking down the Brugge field benchmark results, the architecture choices behind the GNN proxy, and what getting a patent filed from PhD work feels like.",
      readTime:  "14 min",
      tags:      ["GNN", "Reservoir", "Proxy Modeling", "Patent"]
    },
    {
      slug:      "phd-ml-industry",
      published: false,
      featured:  false,
      category:  "essay",
      date:      "January 2025",
      title:     "On Holding a PhD Track and an Industry ML Role Simultaneously",
      excerpt:   "The honest account of juggling a doctoral program, a remote ML engineering job, an internship, a startup, and a family — what the scaffolding looks like and what keeps breaking.",
      readTime:  "7 min",
      tags:      ["PhD Life", "Career", "Balance", "Reflection"]
    },
    {
      slug:      "deephive-v3",
      published: false,
      featured:  false,
      category:  "research",
      date:      "December 2024",
      title:     "DeepHive v3: What Attention Actually Adds to Swarm Coordination",
      excerpt:   "Multi-agent RL for swarm optimization — the architecture of the attention module, MAPPO training dynamics, and where the v3 improvements over the published v1 lie.",
      readTime:  "11 min",
      tags:      ["MAPPO", "Swarm RL", "Attention", "Multi-Agent"]
    }
  ],

  // ─────────────────────────────────────────
  //  LINKS
  // ─────────────────────────────────────────
  links: {
    linkedin: "https://linkedin.com/in/eloghosa-ikponmwoba",
    github:   "https://github.com/elotech47",
    arxiv:    "https://arxiv.org/abs/2604.00264",
    scholar:  "https://scholar.google.com/scholar?q=Eloghosa+Ikponmwoba",
    twitter:  "https://x.com/el0tech",
    cv:       "/Eloghosa_CV.pdf"
  }

};
