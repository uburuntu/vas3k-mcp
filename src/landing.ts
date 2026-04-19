/**
 * Landing page for vas3k-mcp.rmbk.me — served at GET /.
 *
 * Self-contained <!doctype html> with inline CSS, no JS, no external assets
 * other than Ubuntu via Google Fonts (matches vas3k.club's --sans-font).
 * Visual tokens (colors, radii, shadows, fonts) lifted from
 * reference/frontend/static/css/theme.css and base.css to feel native.
 */

export const landingHtml: string = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>vas3k-mcp — MCP-сервер для Клуба</title>
<meta name="description" content="MCP-сервер для Вастрик.Клуба. Подключи Claude, Cursor и других AI-ассистентов к Клубу через OAuth." />
<meta property="og:title" content="vas3k-mcp — MCP-сервер для Клуба" />
<meta property="og:description" content="Подключи Claude, Cursor и других AI-ассистентов к Вастрик.Клубу через OAuth." />
<meta property="og:type" content="website" />
<meta property="og:image" content="https://vas3k.club/static/images/share.png" />
<meta property="og:url" content="https://vas3k-mcp.rmbk.me/" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#FCFDFF" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#282c35" media="(prefers-color-scheme: dark)" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&family=Ubuntu+Mono:wght@400;700&display=swap" />
<style>
:root {
  --sans-font: "Ubuntu", Helvetica, Verdana, sans-serif;
  --mono-font: "Ubuntu Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  --block-border-radius: 15px;
  --button-border-radius: 15px;
  --accent: rgba(255, 196, 85, 0.91); /* --badge-color from vas3k theme */
  --accent-strong: #f7b733;
  --accent-soft: rgba(255, 196, 85, 0.18);

  /* light theme — copied from theme.css */
  --bg-color: #FCFDFF;
  --opposite-bg-color: #282c35;
  --text-color: #333;
  --brighter-text-color: #000;
  --opposite-text-color: #DDD;
  --block-bg-color: #FFF;
  --opposite-block-bg-color: #282c35;
  --block-shadow: 10px 15px 40px rgba(83, 91, 110, 0.11);
  --block-border: none;
  --link-color: #333;
  --link-hover-color: #000;
  --button-color: #FFF;
  --button-bg-color: #333;
  --button-border: solid 2px #333;
  --button-hover-color: #333;
  --button-hover-bg-color: #FFF;
  --button-hover-border: solid 2px #333;
  --muted: #6b7180;
  --hairline: rgba(0, 0, 0, 0.08);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #282c35;
    --opposite-bg-color: #FCFDFF;
    --text-color: #DDD;
    --brighter-text-color: #FFF;
    --opposite-text-color: #333;
    --block-bg-color: #1B1B1C;
    --opposite-block-bg-color: #FFF;
    --block-shadow: 0 0 0 #000;
    --block-border: solid 1px #FCFDFF;
    --link-color: #DDD;
    --link-hover-color: #FFF;
    --button-color: #333;
    --button-bg-color: #FFF;
    --button-border: solid 2px #FFF;
    --button-hover-color: #FFF;
    --button-hover-bg-color: #333;
    --button-hover-border: solid 2px #FFF;
    --muted: #9aa0ad;
    --hairline: rgba(255, 255, 255, 0.12);
  }
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--sans-font);
  font-size: 17px;
  line-height: 1.5;
  color: var(--text-color);
  background-color: var(--bg-color);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@media (max-width: 800px) { body { font-size: 15px; } }

a {
  color: var(--link-color);
  transition: color linear .1s;
  font-weight: 500;
}
a:hover { color: var(--link-hover-color); }

main {
  max-width: 920px;
  margin: 0 auto;
  padding: 40px 20px 20px;
}

@media (max-width: 570px) {
  main { padding: 20px 14px; }
}

/* hero */
.hero {
  padding: 48px 36px 44px;
  margin-bottom: 30px;
  background-color: var(--block-bg-color);
  border: var(--block-border);
  border-radius: var(--block-border-radius);
  box-shadow: var(--block-shadow);
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: "";
  position: absolute;
  top: -80px;
  right: -80px;
  width: 220px;
  height: 220px;
  background: var(--accent);
  border-radius: 50%;
  opacity: 0.5;
  z-index: 0;
}

.hero-tag {
  display: inline-block;
  font-size: 13px;
  font-weight: 500;
  background: var(--accent);
  color: #333;
  padding: 5px 12px;
  border-radius: 999px;
  margin-bottom: 22px;
  position: relative;
  z-index: 1;
}

.hero h1 {
  position: relative;
  z-index: 1;
  margin: 0 0 18px;
  font-size: 52px;
  line-height: 1.05;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--brighter-text-color);
}

@media (max-width: 570px) { .hero h1 { font-size: 36px; } }

@media (max-width: 480px) {
  .hero::before { width: 140px; height: 140px; top: -50px; right: -50px; opacity: 0.35; }
}

.hero p {
  position: relative;
  z-index: 1;
  margin: 0 0 26px;
  font-size: 21px;
  max-width: 620px;
  color: var(--text-color);
  opacity: 0.9;
}

@media (max-width: 570px) { .hero p { font-size: 17px; } }

.hero-cta {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none !important;
  padding: 14px 22px;
  border-radius: var(--button-border-radius);
  background-color: var(--button-bg-color);
  border: var(--button-border);
  color: var(--button-color);
  text-align: center;
  cursor: pointer;
  line-height: 1em;
  font-weight: 500;
  font-size: 16px;
  transition: 0.2s ease-out;
}
.button:hover {
  color: var(--button-hover-color);
  background-color: var(--button-hover-bg-color);
  border: var(--button-hover-border);
}
.button-ghost {
  background: transparent;
  color: var(--text-color);
  border: solid 2px var(--hairline);
}
.button-ghost:hover {
  background: transparent;
  color: var(--brighter-text-color);
  border: solid 2px var(--text-color);
}

/* blocks */
.block {
  padding: 36px;
  margin-bottom: 30px;
  background-color: var(--block-bg-color);
  border: var(--block-border);
  border-radius: var(--block-border-radius);
  box-shadow: var(--block-shadow);
}
@media (max-width: 570px) { .block { padding: 22px; } }

.block h2 {
  margin: 0 0 16px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--brighter-text-color);
  letter-spacing: -0.01em;
}

.block p { margin: 0 0 14px; }
.block p:last-child { margin-bottom: 0; }

.lede {
  font-size: 18px;
  opacity: 0.92;
}

/* tools grid */
.tools {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
  margin-top: 22px;
}

.tool {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 12px;
  background: var(--accent-soft);
  border: 1px solid transparent;
  transition: transform .15s ease, border-color .15s ease;
}
.tool:hover {
  transform: translateY(-2px);
  border-color: var(--accent-strong);
}
.tool-emoji { font-size: 22px; line-height: 1; }
.tool-name { font-weight: 700; color: var(--brighter-text-color); }
.tool-desc { font-size: 14px; opacity: 0.78; line-height: 1.4; }

.tool-group-title {
  font-size: 1.05rem;
  margin: 28px 0 4px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.tool-group-title:first-of-type { margin-top: 8px; }
.tool-group-desc {
  font-size: 14px;
  opacity: 0.78;
  margin: 0;
  line-height: 1.5;
}
.tool-group-badge {
  display: inline-block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--brighter-text-color);
  letter-spacing: 0.02em;
}
.tool-group-badge-write {
  background: var(--accent);
  color: #1B1B1C;
}

/* endpoint cards (the "two URLs" callout) */
.endpoints {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
  margin-top: 16px;
}
.endpoint {
  display: grid;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 12px;
  background: var(--accent-soft);
  border: 1px solid transparent;
}
.endpoint-write { border-color: var(--accent-strong); background: rgba(255, 196, 85, 0.28); }
@media (prefers-color-scheme: dark) {
  .endpoint-write { background: rgba(255, 196, 85, 0.16); }
}
.endpoint code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--brighter-text-color);
  word-break: break-all;
  background: transparent;
  padding: 0;
}
.endpoint-tag {
  display: inline-block;
  width: fit-content;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0,0,0,0.06);
  color: var(--brighter-text-color);
}
@media (prefers-color-scheme: dark) {
  .endpoint-tag { background: rgba(255,255,255,0.1); }
}
.endpoint-tag-write { background: var(--accent); color: #1B1B1C; }
.endpoint-note { font-size: 13px; opacity: 0.78; line-height: 1.4; }

/* per-client accordion */
.client {
  border-top: 1px solid var(--hairline);
  padding: 0;
}
.client:last-of-type { border-bottom: 1px solid var(--hairline); }
.client + .client { margin-top: 0; }
.client > summary {
  list-style: none;
  cursor: pointer;
  padding: 14px 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  user-select: none;
}
.client > summary::-webkit-details-marker { display: none; }
.client > summary::after {
  content: "+";
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 18px;
  font-weight: 600;
  width: 24px;
  text-align: center;
  opacity: 0.5;
  transition: transform .2s ease, opacity .2s ease;
}
.client[open] > summary::after { content: "−"; opacity: 1; }
.client > summary:hover { background: rgba(0,0,0,0.025); }
@media (prefers-color-scheme: dark) {
  .client > summary:hover { background: rgba(255,255,255,0.04); }
}
.client-name {
  font-weight: 700;
  font-size: 16px;
  color: var(--brighter-text-color);
}
.client-where {
  font-size: 13px;
  opacity: 0.7;
  margin-left: auto;
  margin-right: 12px;
}
.client-where code.inline {
  font-size: 12px;
  background: rgba(0,0,0,0.06);
  padding: 1px 6px;
  border-radius: 4px;
}
@media (prefers-color-scheme: dark) {
  .client-where code.inline { background: rgba(255,255,255,0.08); }
}
.client-body {
  padding: 0 4px 16px;
  animation: clientReveal .25s ease-out;
}
.client-body p { margin: 4px 0 10px; }
.client-body em { font-style: normal; font-weight: 600; color: var(--brighter-text-color); }
@keyframes clientReveal {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: none; }
}
@media (max-width: 570px) {
  .client > summary { padding: 12px 2px; }
  .client-where { margin-left: 0; width: 100%; order: 3; }
}

/* code block — mirrors base.css "pre > code" */
pre {
  margin: 18px 0 8px;
  padding: 0;
}
pre > code {
  display: block;
  padding: 18px 22px;
  white-space: pre;
  overflow-x: auto;
  background-color: var(--opposite-block-bg-color);
  color: var(--opposite-text-color);
  border-radius: 12px;
  font-family: var(--mono-font);
  font-size: 14px;
  line-height: 1.55;
}
.code-caption {
  font-size: 13.5px;
  opacity: 0.7;
  margin-top: 10px;
}

code.inline {
  font-family: var(--mono-font);
  font-size: 0.92em;
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--accent-soft);
  color: var(--brighter-text-color);
}

/* security list */
.checklist {
  list-style: none;
  padding: 0;
  margin: 14px 0 0;
}
.checklist li {
  position: relative;
  padding: 8px 0 8px 32px;
  border-top: 1px solid var(--hairline);
}
.checklist li:first-child { border-top: 0; }
.checklist li::before {
  content: "✓";
  position: absolute;
  left: 6px;
  top: 8px;
  width: 20px;
  height: 20px;
  font-weight: 700;
  color: var(--accent-strong);
}

/* two-up row */
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 30px;
}
@media (max-width: 720px) { .row { grid-template-columns: 1fr; } }
.row .block { margin-bottom: 0; height: 100%; }

/* footer */
footer {
  text-align: center;
  padding: 40px 20px 60px;
  font-size: 14px;
  opacity: 0.72;
  line-height: 1.7;
}
footer a { font-weight: 500; }
footer .sep { padding: 0 12px; opacity: 0.5; }
@media (max-width: 570px) {
  footer .sep { display: block; padding: 0; height: 4px; }
}
</style>
</head>
<body>
<main>

  <section class="hero">
    <span class="hero-tag">🤖 MCP × 🥑 Вастрик.Клуб</span>
    <h1>MCP-сервер<br />для Клуба</h1>
    <p>Подключи Claude, Cursor и других AI-ассистентов к Клубу по OAuth — пусть читают посты, ищут людей и копаются в ленте, пока ты занят чем-то поинтереснее.</p>
    <div class="hero-cta">
      <a href="#подключить" class="button">Как подключить →</a>
      <a href="https://github.com/uburuntu/vas3k-mcp" class="button button-ghost" target="_blank" rel="noopener">GitHub</a>
    </div>
  </section>

  <section class="block" id="зачем">
    <h2>Что это и зачем 🤔</h2>
    <p class="lede">
      <strong>MCP (Model Context Protocol)</strong> — стандарт от Anthropic, чтобы AI-ассистенты ходили в реальные сервисы по API, а не пересказывали обучающую выборку.
    </p>
    <p>
      Этот сервер подключает Клуб как обычное OAuth-приложение — то самое, что живёт на странице <a href="https://vas3k.club/apps/" target="_blank" rel="noopener">vas3k.club/apps/</a>. Авторизуешься один раз — и Claude может вытащить твою ленту, найти человека по тегу или взять markdown поста, чтобы пересказать, перевести или процитировать.
    </p>
  </section>

  <section class="block" id="умеет">
    <h2>Что умеет 🛠</h2>

    <h3 class="tool-group-title">Только чтение — 12 инструментов <span class="tool-group-badge">/mcp</span></h3>
    <p class="tool-group-desc">Доступны на обоих эндпоинтах. Ничего не меняют в Клубе.</p>
    <div class="tools">
      <div class="tool"><span class="tool-emoji" aria-hidden="true">👤</span><span class="tool-name">get_me</span><span class="tool-desc">Твой профиль</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🧑‍🚀</span><span class="tool-name">get_user</span><span class="tool-desc">Профиль участника по slug</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🏷</span><span class="tool-name">get_user_tags</span><span class="tool-desc">Теги в профиле</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🏆</span><span class="tool-name">get_user_badges</span><span class="tool-desc">Бейджи от других</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🎖</span><span class="tool-name">get_user_achievements</span><span class="tool-desc">Ачивки за активность</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">📲</span><span class="tool-name">find_user_by_telegram</span><span class="tool-desc">Найти по числовому Telegram ID</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">📝</span><span class="tool-name">get_post</span><span class="tool-desc">Пост по типу и slug</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">📄</span><span class="tool-name">get_post_markdown</span><span class="tool-desc">Markdown поста</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">💬</span><span class="tool-name">list_post_comments</span><span class="tool-desc">Комменты под постом</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">📰</span><span class="tool-name">get_feed</span><span class="tool-desc">Страница ленты с фильтрами</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🔍</span><span class="tool-name">search_users</span><span class="tool-desc">Поиск людей по префиксу</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🔖</span><span class="tool-name">search_tags</span><span class="tool-desc">Поиск тегов с фильтром группы</span></div>
    </div>

    <h3 class="tool-group-title">С правом писать — ещё 11 <span class="tool-group-badge tool-group-badge-write">/mcp-full</span></h3>
    <p class="tool-group-desc">Только на <code class="inline">/mcp-full</code>. Меняют состояние аккаунта — лайки, букмарки, подписки и т.п. AI делает это от твоего имени.</p>
    <div class="tools">
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🔖</span><span class="tool-name">bookmark_post</span><span class="tool-desc">Добавить или убрать букмарк</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">👍</span><span class="tool-name">upvote_post</span><span class="tool-desc">Лайкнуть пост</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">↩️</span><span class="tool-name">retract_post_vote</span><span class="tool-desc">Снять свой лайк с поста</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🔔</span><span class="tool-name">toggle_post_subscription</span><span class="tool-desc">Подписка на новые комменты</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🎟</span><span class="tool-name">toggle_event_participation</span><span class="tool-desc">Отметиться на ивенте или сняться</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">💚</span><span class="tool-name">upvote_comment</span><span class="tool-desc">Лайкнуть комментарий</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">↩️</span><span class="tool-name">retract_comment_vote</span><span class="tool-desc">Снять лайк с коммента</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🫂</span><span class="tool-name">toggle_friend</span><span class="tool-desc">Отправить или отозвать запрос в друзья</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">📥</span><span class="tool-name">subscribe_room</span><span class="tool-desc">Подписаться на комнату</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🤐</span><span class="tool-name">mute_room</span><span class="tool-desc">Замьютить комнату</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🏷</span><span class="tool-name">toggle_profile_tag</span><span class="tool-desc">Переключить тег в профиле</span></div>
    </div>
  </section>

  <section class="block" id="подключить">
    <h2>Как подключить 🔌</h2>
    <p>Сервер отдаёт два эндпоинта — read-only и с правом писать. OAuth и логин общие, отличаются только тулзы:</p>
    <div class="endpoints">
      <div class="endpoint">
        <span class="endpoint-tag">Чтение</span>
        <code>https://vas3k-mcp.rmbk.me/mcp</code>
        <span class="endpoint-note">12 инструментов, ничего не меняет в Клубе</span>
      </div>
      <div class="endpoint endpoint-write">
        <span class="endpoint-tag endpoint-tag-write">+ Запись</span>
        <code>https://vas3k-mcp.rmbk.me/mcp-full</code>
        <span class="endpoint-note">+11: лайки, букмарки, подписки, друзья, теги</span>
      </div>
    </div>

    <p class="code-caption" style="margin-top:18px">Дальше — конкретные клиенты. Достаточно одного, остальные пропусти:</p>

    <details class="client" open>
      <summary>
        <span class="client-name">Claude Desktop</span>
        <span class="client-where">Settings → Connectors → Add Custom Connector</span>
      </summary>
      <div class="client-body">
        <p>В поле <em>URL</em> вставить:</p>
<pre><code>https://vas3k-mcp.rmbk.me/mcp</code></pre>
      </div>
    </details>

    <details class="client">
      <summary>
        <span class="client-name">Claude Code</span>
        <span class="client-where">Команда в терминале</span>
      </summary>
      <div class="client-body">
<pre><code>claude mcp add --transport http vas3k https://vas3k-mcp.rmbk.me/mcp</code></pre>
      </div>
    </details>

    <details class="client">
      <summary>
        <span class="client-name">Cursor</span>
        <span class="client-where"><code class="inline">~/.cursor/mcp.json</code></span>
      </summary>
      <div class="client-body">
<pre><code>{
  "mcpServers": {
    "vas3k": {
      "url": "https://vas3k-mcp.rmbk.me/mcp"
    }
  }
}</code></pre>
      </div>
    </details>

    <details class="client">
      <summary>
        <span class="client-name">VS Code</span>
        <span class="client-where"><code class="inline">.vscode/mcp.json</code></span>
      </summary>
      <div class="client-body">
<pre><code>{
  "servers": {
    "vas3k": {
      "type": "http",
      "url": "https://vas3k-mcp.rmbk.me/mcp"
    }
  }
}</code></pre>
      </div>
    </details>

    <details class="client">
      <summary>
        <span class="client-name">ChatGPT</span>
        <span class="client-where">Settings → Apps → Create App</span>
      </summary>
      <div class="client-body">
        <p>В поле <em>MCP Server URL</em> вставить тот же URL, тип авторизации — OAuth:</p>
<pre><code>https://vas3k-mcp.rmbk.me/mcp</code></pre>
      </div>
    </details>

    <details class="client">
      <summary>
        <span class="client-name">MCP Inspector</span>
        <span class="client-where">Дебаг-клиент от Anthropic — удобно посмотреть на ручки руками</span>
      </summary>
      <div class="client-body">
<pre><code>npx @modelcontextprotocol/inspector</code></pre>
        <p>В открывшемся UI: <em>Transport</em> = Streamable HTTP, <em>URL</em> = <code class="inline">https://vas3k-mcp.rmbk.me/mcp</code>.</p>
      </div>
    </details>

    <p class="code-caption">Не нашёл свой клиент? Большинство поддерживают тот же шаблон <code class="inline">{ "url": "..." }</code>. Список совместимости — в <a href="https://modelcontextprotocol.io/clients" target="_blank" rel="noopener">MCP-доках</a>.</p>
  </section>

  <div class="row">
    <section class="block" id="безопасность">
      <h2>Приватность 🔒</h2>
      <ul class="checklist">
        <li>На <code class="inline">/mcp</code> — только чтение. На <code class="inline">/mcp-full</code> — то же самое плюс действия от твоего имени.</li>
        <li>OAuth ровно с теми же правами, что у любого приложения со страницы <a href="https://vas3k.club/apps/" target="_blank" rel="noopener">/apps/</a>.</li>
        <li>Доступ отзывается там же одной кнопкой.</li>
        <li>Токены шифруются перед записью в Cloudflare KV (ключ — секрет инстанса), наружу не отдаются.</li>
        <li>Никакой телеметрии — данные едут только в твой AI-клиент.</li>
      </ul>
    </section>

    <section class="block" id="хостить">
      <h2>Свой инстанс 🏠</h2>
      <p>
        Код под MIT — можно поднять копию на своём Cloudflare-аккаунте. Шаги, секреты и KV-биндинги — в <a href="https://github.com/uburuntu/vas3k-mcp#self-host-on-cloudflare-workers" target="_blank" rel="noopener">README</a>.
      </p>
      <p>
        Исходники: <a href="https://github.com/uburuntu/vas3k-mcp" target="_blank" rel="noopener">github.com/uburuntu/vas3k-mcp</a>. Issues и PR — туда же.
      </p>
    </section>
  </div>

</main>

<footer>
  Сделано с ❤️ для <a href="https://vas3k.club" target="_blank" rel="noopener">vas3k.club</a>
  <span class="sep">∞</span>
  <a href="https://github.com/uburuntu/vas3k-mcp" target="_blank" rel="noopener">GitHub</a>
  <span class="sep">∞</span>
  <a href="https://vas3k.club/apps/" target="_blank" rel="noopener">/apps/</a>
</footer>

</body>
</html>`;
