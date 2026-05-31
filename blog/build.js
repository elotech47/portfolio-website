#!/usr/bin/env node
/**
 * ============================================================
 *  build.js — Blog Post Builder
 *  Converts blog/posts/*.md  →  blog/html/*.html
 *
 *  Usage:
 *    node build.js              # build all posts
 *    node build.js --watch      # watch for changes and rebuild
 *    node build.js my-post.md   # build one specific post
 *
 *  Requirements:
 *    npm install marked gray-matter
 * ============================================================
 */

const fs       = require('fs');
const path     = require('path');
const { marked }      = require('marked');
const matter   = require('gray-matter');

// ── Paths ──────────────────────────────────────────────────
const POSTS_DIR    = path.join(__dirname, 'posts');
const OUTPUT_DIR   = path.join(__dirname, 'html');
const TEMPLATE     = path.join(__dirname, 'template.html');
const CONFIG_PATH  = path.join(__dirname, '..', 'site.config.js');

// ── Configure marked ───────────────────────────────────────
marked.setOptions({
  gfm: true,       // GitHub Flavored Markdown
  breaks: false,   // only break on double newline
});

// ── Helpers ────────────────────────────────────────────────
function loadTemplate() {
  if (!fs.existsSync(TEMPLATE)) {
    console.error('✗  template.html not found at', TEMPLATE);
    process.exit(1);
  }
  return fs.readFileSync(TEMPLATE, 'utf8');
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function buildPost(filename, template) {
  const filePath = path.join(POSTS_DIR, filename);
  const raw      = fs.readFileSync(filePath, 'utf8');
  const { data: fm, content } = matter(raw);

  // ── Validate frontmatter ──
  const required = ['slug', 'category', 'date', 'title', 'excerpt', 'readTime', 'tags'];
  const missing  = required.filter(k => !fm[k]);
  if (missing.length) {
    console.warn(`  ⚠  ${filename} is missing frontmatter: ${missing.join(', ')} — skipping`);
    return null;
  }

  // ── Render markdown body ──
  const htmlContent = marked(content);

  // ── Build tag HTML ──
  const tagsHTML = (fm.tags || [])
    .map(t => `<span class="post-tag">${t}</span>`)
    .join('');

  // ── Fill template placeholders ──
  let html = template
    .replace(/\{\{TITLE\}\}/g,     escapeHTML(fm.title))
    .replace(/\{\{EXCERPT\}\}/g,   escapeHTML(fm.excerpt))
    .replace(/\{\{CATEGORY\}\}/g,  fm.category.toLowerCase())
    .replace(/\{\{DATE\}\}/g,      fm.date)
    .replace(/\{\{READ_TIME\}\}/g, fm.readTime)
    .replace(/\{\{TAGS\}\}/g,      tagsHTML)
    .replace(/\{\{CONTENT\}\}/g,   htmlContent);

  // ── Write output ──
  const outFile = path.join(OUTPUT_DIR, `${fm.slug}.html`);
  fs.writeFileSync(outFile, html, 'utf8');

  // ── Sync with site.config.js ──
  syncConfig(fm);

  return fm.slug;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Reads site.config.js and ensures this post exists in the blog[] array.
 * If the slug is already there, it updates it. If not, it prepends it.
 * Non-destructive: only touches the blog[] array.
 */
function findBlogEntry(source, slug) {
  const blogIdx = source.indexOf('blog: [');
  if (blogIdx === -1) return null;

  const slice = source.slice(blogIdx);
  const entryRe = new RegExp(`\\{[\\s\\S]*?slug:\\s*"${slug}"[\\s\\S]*?\\}`, 'm');
  const match = slice.match(entryRe);
  if (!match) return null;

  const start = blogIdx + match.index;
  return { start, end: start + match[0].length, text: match[0] };
}

function syncConfig(fm) {
  if (!fs.existsSync(CONFIG_PATH)) return;

  let source = fs.readFileSync(CONFIG_PATH, 'utf8');
  const found = findBlogEntry(source, fm.slug);

  if (found) {
    console.log(`  ·  "${fm.slug}" already in site.config.js — skipping sync`);
    return;
  }

  const newEntry = `{
      slug:      "${fm.slug}",
      published: false,
      featured:  false,
      category:  "${fm.category}",
      date:      "${fm.date}",
      title:     "${fm.title.replace(/"/g, '\\"')}",
      excerpt:   "${fm.excerpt.replace(/"/g, '\\"')}",
      readTime:  "${fm.readTime}",
      tags:      [${(fm.tags || []).map(t => `"${t}"`).join(', ')}]
    }`;

  if (source.includes('blog: [')) {
    source = source.replace(/blog:\s*\[/, `blog: [\n    ${newEntry},`);
    console.log(`  +  Added "${fm.slug}" to site.config.js`);
  } else {
    console.warn('  ⚠  Could not locate blog[] in site.config.js — skipping sync');
    return;
  }

  fs.writeFileSync(CONFIG_PATH, source, 'utf8');
}

// ── Main build logic ───────────────────────────────────────
function build(target) {
  ensureOutputDir();
  const template = loadTemplate();

  let files;
  if (target) {
    // Single file
    const filename = target.endsWith('.md') ? target : `${target}.md`;
    if (!fs.existsSync(path.join(POSTS_DIR, filename))) {
      console.error(`✗  Post not found: ${filename}`);
      process.exit(1);
    }
    files = [filename];
  } else {
    // All .md files
    files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    if (files.length === 0) {
      console.log('No .md files found in blog/posts/');
      return;
    }
  }

  console.log(`\nBuilding ${files.length} post(s)...\n`);
  let built = 0;
  files.forEach(f => {
    process.stdout.write(`  → ${f} ... `);
    const slug = buildPost(f, template);
    if (slug) { console.log(`✓  blog/html/${slug}.html`); built++; }
  });
  console.log(`\n✓  Done. ${built} post(s) built.\n`);
}

// ── Watch mode ─────────────────────────────────────────────
function watch() {
  console.log('\nWatching blog/posts/ for changes... (Ctrl+C to stop)\n');
  build(); // initial build

  fs.watch(POSTS_DIR, (eventType, filename) => {
    if (!filename || !filename.endsWith('.md')) return;
    console.log(`\nChange detected: ${filename}`);
    const template = loadTemplate();
    ensureOutputDir();
    process.stdout.write(`  → ${filename} ... `);
    const slug = buildPost(filename, template);
    if (slug) console.log(`✓  blog/html/${slug}.html`);
  });
}

// ── CLI ────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes('--watch')) {
  watch();
} else if (args.length > 0 && !args[0].startsWith('--')) {
  build(args[0]);
} else {
  build();
}
