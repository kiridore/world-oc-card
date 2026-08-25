// 单文件 HTML 分享快照（M6-F4）：内联全部数据的只读浏览页。
// 约束（DESIGN.md §2.5/§5）：断网 + file:// 双击可用 → 零外部请求；双主题内联可切换；
// 图片仅内联 ≤200KB 的 dataURL，超限/缺失显示占位（失效引用不崩溃，配合 G5）。
import type { AssetMeta, ProjectData } from '@/types'
import { allWorldlineViews } from './fork'
import { displayTime } from './branchOrder'

export interface SnapshotAsset { meta: AssetMeta; dataUrl: string | null }

interface SnapBlock { t: string; title: string; html: string }
interface SnapCharacter { id: string; name: string; blocks: SnapBlock[] }
interface SnapCodex { id: string; name: string; typeName: string; color: string; attrs: { k: string; v: string }[]; html: string }
interface SnapLane { name: string; color: string; abandoned: boolean; broken: boolean; events: { title: string; display: string; dim: boolean; participants: string[] }[] }

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 极简 Markdown 子集渲染（快照只读页用，无需完整 marked） */
export function miniMarkdown(md: string, assetsById: Map<string, SnapshotAsset>): string {
  const esc = escapeHtml
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\[\[失效引用:([^\]]+)\]\]/g, '<span class="broken">失效引用：$1</span>')
    .replace(/\[\[([^\]]+)\]\]/g, '<a class="codex-link" data-name="$1">$1</a>')
  // 行分组
  html = html.split(/\n{2,}/).map((block) => {
    const t = block.trim()
    if (!t) return ''
    if (/^<(h\d|hr)/.test(t)) return t
    if (/^[-*] /.test(t)) {
      return '<ul>' + t.split('\n').map((l) => `<li>${l.replace(/^[-*] /, '')}</li>`).join('') + '</ul>'
    }
    return `<p>${t.replace(/\n/g, '<br>')}</p>`
  }).join('')
  void assetsById
  void esc
  return html
}

function blocksToSnap(data: ProjectData, blocks: import('../types').FieldBlock[], assetsById: Map<string, SnapshotAsset>): SnapBlock[] {
  const out: SnapBlock[] = []
  const walk = (bs: import('../types').FieldBlock[]): void => {
    for (const b of bs) {
      if (b.type === 'group') {
        out.push({ t: 'group', title: b.title, html: '' })
        walk(b.children)
      } else if (b.type === 'kv') {
        out.push({ t: 'kv', title: b.title, html: `<table>${b.items.map((i) => `<tr><td>${escapeHtml(i.key)}</td><td>${escapeHtml(i.value)}</td></tr>`).join('')}</table>` })
      } else if (b.type === 'text') {
        out.push({ t: 'text', title: b.title, html: miniMarkdown(b.content, assetsById) })
      } else if (b.type === 'list') {
        out.push({ t: 'list', title: b.title, html: b.items.map((i) => `<span class="tag">${escapeHtml(i)}</span>`).join('') })
      } else if (b.type === 'image') {
        const a = assetsById.get(b.assetId)
        out.push({ t: 'image', title: b.title, html: a?.dataUrl ? `<img src="${a.dataUrl}" alt="${escapeHtml(b.title)}">` : `<span class="broken">图片占位${a ? '' : '（失效引用）'}</span>` })
      } else if (b.type === 'table') {
        out.push({ t: 'table', title: b.title, html: `<table><tr>${b.header.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</table>` })
      } else if (b.type === 'link') {
        const name = b.targetType === 'character' ? data.characters.find((c) => c.id === b.targetId)?.name
          : b.targetType === 'codexEntry' ? data.codex.find((c) => c.id === b.targetId)?.name
          : data.events.find((c) => c.id === b.targetId)?.title
        out.push({ t: 'link', title: b.title, html: name ? escapeHtml(name) : '<span class="broken">失效引用</span>' })
      }
    }
  }
  walk(blocks)
  return out
}

export interface SnapshotModel {
  name: string
  characters: SnapCharacter[]
  codex: SnapCodex[]
  lanes: SnapLane[]
}

export function buildSnapshotModel(data: ProjectData, assets: SnapshotAsset[]): SnapshotModel {
  const assetsById = new Map(assets.map((a) => [a.meta.id, a]))
  const charNames = new Map(data.characters.map((c) => [c.id, c.name]))
  return {
    name: data.meta.name,
    characters: data.characters.map((c) => ({ id: c.id, name: c.name, blocks: blocksToSnap(data, c.fieldBlocks, assetsById) })),
    codex: data.codex.map((e) => ({
      id: e.id, name: e.name,
      typeName: data.settings.codexTypes.find((t) => t.id === e.typeId)?.name ?? '未知类型',
      color: e.color,
      attrs: e.attributes.map((a) => ({ k: a.key, v: a.value })),
      html: miniMarkdown(e.content, assetsById),
    })),
    lanes: allWorldlineViews(data).map((v) => {
      const w = data.settings.worldlines.find((x) => x.id === v.worldlineId)!
      const events = [...v.inherited.map((e) => ({ e, dim: true })), ...v.own.map((e) => ({ e, dim: false }))]
      return {
        name: w.name, color: w.color, abandoned: w.status === 'abandoned', broken: v.forkBroken,
        events: events.map(({ e, dim }) => ({
          title: e.title,
          display: displayTime(e.time),
          dim,
          participants: e.participantIds.map((p) => charNames.get(p) ?? '失效引用'),
        })),
      }
    }),
  }
}

export function buildSnapshotHtml(data: ProjectData, assets: SnapshotAsset[]): string {
  const model = buildSnapshotModel(data, assets)
  const json = JSON.stringify(model).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(data.meta.name)} · 世界观快照</title>
<style>
:root[data-theme='dark']{--bg:#15171a;--surface:#1e2024;--surface2:#26282d;--t1:#d6d9de;--t2:#a3a8b0;--t3:#767c86;--bd:#34373d;--ac:#7d9cb5;--act:#a8c2d8}
:root[data-theme='light']{--bg:#e9eaec;--surface:#f4f5f6;--surface2:#ebecee;--t1:#2b2e32;--t2:#55595f;--t3:#7f848b;--bd:#d4d6da;--ac:#4f7189;--act:#3a566b}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,'PingFang SC','Microsoft YaHei',sans-serif;background:var(--bg);color:var(--t1)}
header{display:flex;align-items:center;gap:16px;padding:14px 24px;border-bottom:1px solid var(--bd);background:var(--surface)}
header h1{font-size:17px;margin:0}
.tabs{display:flex;gap:4px}
.tabs button{border:none;background:transparent;color:var(--t2);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:14px}
.tabs button.on{background:var(--surface2);color:var(--act)}
#themeBtn{margin-left:auto;border:1px solid var(--bd);background:var(--surface2);color:var(--t2);border-radius:8px;padding:6px 12px;cursor:pointer}
main{padding:24px;max-width:960px;margin:0 auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.item{background:var(--surface);border:1px solid var(--bd);border-radius:12px;padding:14px;cursor:pointer}
.item:hover{border-color:var(--ac)}
.item .name{font-weight:600}
.item .sub{font-size:12px;color:var(--t3);margin-top:4px}
.detail{background:var(--surface);border:1px solid var(--bd);border-radius:12px;padding:24px}
.detail h2{margin-top:0}
.block{margin:14px 0}
.block h4{margin:0 0 6px;font-size:13px;color:var(--t3)}
table{border-collapse:collapse}td,th{border:1px solid var(--bd);padding:5px 12px;font-size:14px;text-align:left}
.tag{display:inline-block;background:var(--surface2);border-radius:99px;padding:2px 10px;margin:2px;font-size:12px}
.broken{color:var(--t3);font-style:italic}
a.codex-link{color:var(--act);cursor:pointer;text-decoration:underline}
.prose{font-size:15px;line-height:1.75}
.prose p{margin:0 0 10px}
.lane{margin:18px 0}
.lane .lname{font-weight:600;margin-bottom:4px}
.lane.ab .lname{text-decoration:line-through;opacity:.6}
.ev{display:inline-flex;flex-direction:column;align-items:center;margin:0 10px;vertical-align:top}
.ev .dot{width:12px;height:12px;border-radius:50%;border:2px solid var(--surface)}
.ev .et{font-size:12px;margin-top:4px;max-width:110px;text-align:center}
.ev.dim .dot{opacity:.45}.ev.dim .et{color:var(--t3)}
.empty{color:var(--t3);text-align:center;padding:60px 0}
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(data.meta.name)} · 世界观快照</h1>
  <div class="tabs">
    <button data-tab="chars" class="on">角色</button>
    <button data-tab="codex">百科</button>
    <button data-tab="time">时间线</button>
  </div>
  <button id="themeBtn">切换主题</button>
</header>
<main id="main"></main>
<script>
var DATA = ${json};
var main = document.getElementById('main');
var current = 'chars', selected = null;
function esc(s){var d=document.createElement('div');d.textContent=s==null?'':s;return d.innerHTML}
function renderChars(){
  if(selected){var c=selected;var h='<div class="detail"><h2>'+esc(c.name)+'</h2>';
    c.blocks.forEach(function(b){
      if(b.t==='group'){h+='<h3 style="margin:18px 0 4px">'+esc(b.title)+'</h3>';return}
      h+='<div class="block">'+(b.title?'<h4>'+esc(b.title)+'</h4>':'')+
        (b.t==='text'?'<div class="prose">'+b.html+'</div>':b.html)+'</div>'
    });
    h+='<p><a class="codex-link" onclick="selected=null;render()">← 返回列表</a></p></div>';
    main.innerHTML=h;return}
  if(!DATA.characters.length){main.innerHTML='<div class="empty">暂无角色</div>';return}
  var h='<div class="grid">'+DATA.characters.map(function(c){
    return '<div class="item" onclick="openChar(\\''+c.id+'\\')"><div class="name">'+esc(c.name)+'</div><div class="sub">'+c.blocks.length+' 个字段块</div></div>'
  }).join('')+'</div>';
  main.innerHTML=h
}
function openChar(id){selected=DATA.characters.find(function(c){return c.id===id});render()}
function renderCodex(){
  if(selected){var e=selected;var h='<div class="detail"><h2>'+esc(e.name)+'</h2><div class="sub" style="color:var(--t3);font-size:13px">'+esc(e.typeName)+'</div>';
    if(e.attrs.length){h+='<div class="block"><table>'+e.attrs.map(function(a){return '<tr><td>'+esc(a.k)+'</td><td>'+esc(a.v)+'</td></tr>'}).join('')+'</table></div>'}
    h+='<div class="prose block">'+e.html+'</div><p><a class="codex-link" onclick="selected=null;render()">← 返回列表</a></p></div>';
    main.innerHTML=h;bindLinks();return}
  if(!DATA.codex.length){main.innerHTML='<div class="empty">暂无百科条目</div>';return}
  main.innerHTML='<div class="grid">'+DATA.codex.map(function(e){
    return '<div class="item" onclick="openCodex(\\''+e.id+'\\')"><div class="name"><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+e.color+';margin-right:6px"></span>'+esc(e.name)+'</div><div class="sub">'+esc(e.typeName)+'</div></div>'
  }).join('')+'</div>'
}
function openCodex(id){selected=DATA.codex.find(function(c){return c.id===id});render()}
function bindLinks(){
  main.querySelectorAll('a.codex-link[data-name]').forEach(function(a){
    a.onclick=function(){var t=DATA.codex.find(function(c){return c.name===a.getAttribute('data-name')});if(t){selected=t;render()}}
  })
}
function renderTime(){
  if(!DATA.lanes.length){main.innerHTML='<div class="empty">暂无世界线</div>';return}
  var h=DATA.lanes.map(function(l){
    return '<div class="lane'+(l.ab?' ab':'')+'"><div class="lname">'+esc(l.name)+(l.broken?' <span class="broken">⚠分叉点失效</span>':'')+'</div>'+
      '<div>'+l.events.map(function(e){
        return '<div class="ev'+(e.dim?' dim':'')+'"><div class="dot" style="background:'+l.color+'"></div><div class="et">'+esc(e.title)+'</div><div class="et" style="color:var(--t3)">'+esc(e.display)+'</div></div>'
      }).join('')+'</div></div>'
  }).join('');
  main.innerHTML='<div class="detail prose">'+h+'</div>'
}
function render(){
  if(current==='chars')renderChars();
  else if(current==='codex'){renderCodex();bindLinks()}
  else renderTime()
}
document.querySelectorAll('.tabs button').forEach(function(b){
  b.onclick=function(){current=b.getAttribute('data-tab');selected=null;
    document.querySelectorAll('.tabs button').forEach(function(x){x.classList.remove('on')});
    b.classList.add('on');render()}
});
document.getElementById('themeBtn').onclick=function(){
  var r=document.documentElement;
  r.setAttribute('data-theme',r.getAttribute('data-theme')==='dark'?'light':'dark')
};
render()
</script>
</body>
</html>`
}
