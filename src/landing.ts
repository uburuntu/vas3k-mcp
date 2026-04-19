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
    <p>Подключи Claude, Cursor и других AI-ассистентов к Клубу по OAuth — пусть читают посты, ищут людей и листают ленту вместо тебя.</p>
    <div class="hero-cta">
      <a href="#подключить" class="button">Как подключить →</a>
      <a href="https://github.com/uburuntu/vas3k-mcp" class="button button-ghost" target="_blank" rel="noopener">GitHub</a>
    </div>
  </section>

  <section class="block" id="зачем">
    <h2>Что это и зачем 🤔</h2>
    <p class="lede">
      <strong>MCP (Model Context Protocol)</strong> — свежий стандарт от Anthropic, чтобы AI-ассистенты умели ходить в твои сервисы и работать с настоящими данными, а не выдумывать ответы.
    </p>
    <p>
      Этот сервер подключает Клуб как обычное OAuth-приложение — то самое, что живёт на странице <a href="https://vas3k.club/apps/" target="_blank" rel="noopener">vas3k.club/apps/</a>. Авторизуешься один раз, и Claude может попросить себе твою ленту, найти человека по тегу или вытащить markdown поста, чтобы что-нибудь по нему сделать.
    </p>
  </section>

  <section class="block" id="умеет">
    <h2>Что умеет 🛠</h2>

    <h3 class="tool-group-title">Только чтение — 12 тулзов <span class="tool-group-badge">/mcp</span></h3>
    <p class="tool-group-desc">Доступно на обоих эндпоинтах. Ничего не меняет в Клубе.</p>
    <div class="tools">
      <div class="tool"><span class="tool-emoji" aria-hidden="true">👤</span><span class="tool-name">get_me</span><span class="tool-desc">Твой профиль</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🧑‍🚀</span><span class="tool-name">get_user</span><span class="tool-desc">Профиль участника по slug</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🏷</span><span class="tool-name">get_user_tags</span><span class="tool-desc">Теги в профиле</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🏆</span><span class="tool-name">get_user_badges</span><span class="tool-desc">Бейджи от других</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🎖</span><span class="tool-name">get_user_achievements</span><span class="tool-desc">Ачивки за активность</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">📲</span><span class="tool-name">find_user_by_telegram</span><span class="tool-desc">Найти по числовому Telegram ID</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">📝</span><span class="tool-name">get_post</span><span class="tool-desc">Пост по типу и slug</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">📄</span><span class="tool-name">get_post_markdown</span><span class="tool-desc">Сырой markdown поста</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">💬</span><span class="tool-name">list_post_comments</span><span class="tool-desc">Комменты под постом</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">📰</span><span class="tool-name">get_feed</span><span class="tool-desc">Страница ленты с фильтрами</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🔍</span><span class="tool-name">search_users</span><span class="tool-desc">Поиск людей по префиксу</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🔖</span><span class="tool-name">search_tags</span><span class="tool-desc">Поиск тегов с фильтром группы</span></div>
    </div>

    <h3 class="tool-group-title">С правом писать — ещё 12 <span class="tool-group-badge tool-group-badge-write">/mcp-full</span></h3>
    <p class="tool-group-desc">Доступно только на <code class="inline">/mcp-full</code>. Меняет состояние твоего аккаунта — лайки, букмарки, подписки. AI делает это от твоего имени, поэтому проверяй, что он там вытворяет.</p>
    <div class="tools">
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🔖</span><span class="tool-name">bookmark_post</span><span class="tool-desc">Добавить или убрать букмарк</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">👍</span><span class="tool-name">upvote_post</span><span class="tool-desc">Лайкнуть пост</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">↩️</span><span class="tool-name">retract_post_vote</span><span class="tool-desc">Снять свой лайк с поста</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🔔</span><span class="tool-name">toggle_post_subscription</span><span class="tool-desc">Подписка на новые комменты</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🎟</span><span class="tool-name">toggle_event_participation</span><span class="tool-desc">Отметиться на ивенте</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">💚</span><span class="tool-name">upvote_comment</span><span class="tool-desc">Лайкнуть комментарий</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">↩️</span><span class="tool-name">retract_comment_vote</span><span class="tool-desc">Снять лайк с коммента</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🫂</span><span class="tool-name">toggle_friend</span><span class="tool-desc">Отправить или отозвать запрос в друзья</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🔇</span><span class="tool-name">toggle_mute_user</span><span class="tool-desc">Замьютить или вернуть юзера</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">📥</span><span class="tool-name">subscribe_room</span><span class="tool-desc">Подписаться на комнату</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🤐</span><span class="tool-name">mute_room</span><span class="tool-desc">Замьютить комнату</span></div>
      <div class="tool"><span class="tool-emoji" aria-hidden="true">🏷</span><span class="tool-name">toggle_profile_tag</span><span class="tool-desc">Переключить тег в профиле</span></div>
    </div>
  </section>

  <section class="block" id="подключить">
    <h2>Как подключить 🔌</h2>
    <p>Сервер живёт по двум адресам — выбирай, что надо. Оба используют один OAuth, авторизация одинаковая.</p>

    <p><strong>Только чтение</strong> (по умолчанию, безопаснее) — 12 тулзов, ничего не меняет в Клубе:</p>
<pre><code>{
  "mcpServers": {
    "vas3k-club": {
      "url": "https://vas3k-mcp.rmbk.me/mcp"
    }
  }
}</code></pre>

    <p><strong>С правом писать</strong> — те же 12 тулзов плюс ещё 12: лайки, букмарки, подписки на посты и комнаты, дружба, мьют, профильные теги. Удобно, если хочешь, чтобы AI реально тебе помогал листать Клуб, а не только смотрел:</p>
<pre><code>{
  "mcpServers": {
    "vas3k-club": {
      "url": "https://vas3k-mcp.rmbk.me/mcp-full"
    }
  }
}</code></pre>
    <p class="code-caption">Транспорт — стримящийся HTTP. AI в режиме <code class="inline">/mcp-full</code> сможет лайкать и подписывать тебя на посты, поэтому проверяй, что он там делает.</p>
  </section>

  <div class="row">
    <section class="block" id="безопасность">
      <h2>Приватность 🔒</h2>
      <ul class="checklist">
        <li>Read-only — ничего не пишет, не лайкает и не комментит за тебя.</li>
        <li>OAuth — те же скоупы, что у любого приложения с <a href="https://vas3k.club/apps/" target="_blank" rel="noopener">/apps/</a>.</li>
        <li>Доступ можно отозвать одной кнопкой там же.</li>
        <li>Токены живут в Cloudflare KV в зашифрованном виде, наружу не торчат.</li>
        <li>Никакой телеметрии — твои данные не уходят никуда, кроме твоего AI-клиента.</li>
      </ul>
    </section>

    <section class="block" id="хостить">
      <h2>Хостить у себя 🏠</h2>
      <p>
        Код открытый — если не доверяешь хостед-версии, развернёшь свой Worker минут за десять. Регистрируешь приложение на <a href="https://vas3k.club/apps/" target="_blank" rel="noopener">vas3k.club/apps/</a>, прописываешь секреты и KV в <code class="inline">wrangler.toml</code>, и <code class="inline">pnpm deploy</code>. Подробности — в README.
      </p>
      <p>
        Репка: <a href="https://github.com/uburuntu/vas3k-mcp" target="_blank" rel="noopener">github.com/uburuntu/vas3k-mcp</a>. PR-ы и баг-репорты приветствуются.
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
