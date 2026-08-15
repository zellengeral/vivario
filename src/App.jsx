import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  LayoutDashboard, Columns3, DatabaseBackup, Plus, X,
  Clock, CalendarDays, Camera, Image as ImageIcon, Bell, Trash2,
  Pencil, Check, EyeOff, Eye, AlertTriangle, CalendarPlus,
  Download, Upload, Briefcase, User, GripVertical,
  Mic, Repeat, FileText, Link2, StickyNote, MapPin, MessageSquare,
  Paperclip, ChevronLeft, ChevronRight, Milestone,
  List as ListIcon, Calendar as CalendarIcon, Sun, Moon, BellRing, BellOff, Sparkles, Smartphone, Bot, Send,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Design tokens (light / dark palettes, applied via CSS variables)   */
/* ------------------------------------------------------------------ */
const LIGHT_PALETTE = {
  bg: "#F6F5F1",
  surface: "#FFFFFF",
  surfaceSunk: "#EFEDE6",
  ink: "#1C1F24",
  inkSoft: "#6B6F76",
  border: "#E2DFD5",
  primary: "#0F6E5E",
  primaryDark: "#0A5145",
  primarySoft: "#DEEFEA",
  accent: "#FF6B4A",
  accentSoft: "#FFE6DE",
  pessoal: "#7C6FE0",
  pessoalSoft: "#EBE8FB",
  profissional: "#1C7C6B",
  profissionalSoft: "#DDF0EB",
  q1: "#E4572E",
  q1Soft: "#FBE4DC",
  q2: "#0F6E5E",
  q2Soft: "#DEEFEA",
  q3: "#DDA22A",
  q3Soft: "#FBF0DA",
  q4: "#8B93A7",
  q4Soft: "#EAECF0",
  danger: "#C0392B",
  dangerSoft: "#FBE4DC",
};

const DARK_PALETTE = {
  bg: "#15171B",
  surface: "#1D2025",
  surfaceSunk: "#262A31",
  ink: "#F0EFEA",
  inkSoft: "#9BA1AC",
  border: "#33373F",
  primary: "#33B69B",
  primaryDark: "#1F8770",
  primarySoft: "#173832",
  accent: "#FF8A6B",
  accentSoft: "#3B2419",
  pessoal: "#A599F5",
  pessoalSoft: "#2A2540",
  profissional: "#3FBFA4",
  profissionalSoft: "#173832",
  q1: "#F0805A",
  q1Soft: "#3B2319",
  q2: "#33B69B",
  q2Soft: "#173832",
  q3: "#EAC15C",
  q3Soft: "#3B2F16",
  q4: "#9298A8",
  q4Soft: "#262A31",
  danger: "#E37768",
  dangerSoft: "#3B2319",
};

// C exposes the same keys as the palettes, but every value is a CSS variable
// reference. The variables themselves are set on the root wrapper based on
// the active theme, so every component below stays theme-agnostic.
const C = Object.fromEntries(Object.keys(LIGHT_PALETTE).map((k) => [k, `var(--v-${k})`]));

function cssVarsFor(theme) {
  const palette = theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
  const vars = {};
  Object.entries(palette).forEach(([k, v]) => { vars[`--v-${k}`] = v; });
  return vars;
}

const THEME_STORAGE_KEY = "vivaro:theme";
const FIRED_REMINDERS_KEY = "vivaro:firedReminders";
const REMINDER_MS = { minutes: 60 * 1000, hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000 };

// Gemini API key: set as a Netlify environment variable named VITE_GEMINI_API_KEY
// (Site settings → Environment variables), then trigger a new deploy. Vite bakes
// it into the built JS at build time — it is NOT committed to the repository.
// For safety, restrict this key by HTTP referrer to your Netlify domain in
// Google Cloud Console → APIs & Services → Credentials.
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-flash-latest";

const QUADRANTS = [
  { id: 1, label: "Fazer agora", sub: "Urgente + Importante", color: C.q1, soft: C.q1Soft },
  { id: 2, label: "Planejar", sub: "Importante, não urgente", color: C.q2, soft: C.q2Soft },
  { id: 3, label: "Delegar", sub: "Urgente, não importante", color: C.q3, soft: C.q3Soft },
  { id: 4, label: "Eliminar", sub: "Nem urgente, nem importante", color: C.q4, soft: C.q4Soft },
];

const STATUSES = [
  { id: "pendente", label: "Pendente", color: "#8B93A7" },
  { id: "em_andamento", label: "Em andamento", color: "#2E86DE" },
  { id: "aguarda_tratamento", label: "Aguarda tratamento", color: "#DDA22A" },
  { id: "cancelado", label: "Cancelado", color: "#9A9A9A" },
  { id: "concluido", label: "Concluído", color: "#0F6E5E" },
];

const REMINDER_UNITS = [
  { id: "minutes", label: "minutos" },
  { id: "hours", label: "horas" },
  { id: "days", label: "dias" },
];

const RECURRENCE_OPTIONS = [
  { id: "", label: "Não repete" },
  { id: "daily", label: "Todos os dias" },
  { id: "weekday", label: "Todo dia útil" },
  { id: "weekly", label: "Semanalmente" },
  { id: "interval", label: "A cada X dias" },
  { id: "monthly_day", label: "Mensalmente (mesmo dia)" },
  { id: "monthly_last_business", label: "Último dia útil do mês" },
  { id: "monthly_first", label: "Primeiro dia de cada mês" },
  { id: "after_completion", label: "A cada X dias após concluir" },
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const STORAGE_KEY = "vivaro:tasks:v2";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function fmtTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function isOverdue(task) {
  if (!task.dueAt) return false;
  if (task.status === "concluido" || task.status === "cancelado") return false;
  return new Date(task.dueAt).getTime() < Date.now();
}

function googleCalendarUrl(task) {
  const start = task.dueAt ? new Date(task.dueAt) : new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d) =>
    d.getUTCFullYear().toString().padStart(4, "0") +
    (d.getUTCMonth() + 1).toString().padStart(2, "0") +
    d.getUTCDate().toString().padStart(2, "0") +
    "T" +
    d.getUTCHours().toString().padStart(2, "0") +
    d.getUTCMinutes().toString().padStart(2, "0") +
    "00Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: task.title || "Tarefa Vivaro",
    dates: `${fmt(start)}/${fmt(end)}`,
    details: (task.description || "") + `\n\nCategoria: ${task.category === "pessoal" ? "Pessoal" : "Profissional"} · Vivaro`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6;
}
function nextBusinessDay(d) {
  let n = addDays(d, 1);
  while (isWeekend(n)) n = addDays(n, 1);
  return n;
}
function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0);
}
function lastBusinessDayOfMonth(year, monthIndex) {
  let d = lastDayOfMonth(year, monthIndex);
  while (isWeekend(d)) d.setDate(d.getDate() - 1);
  return d;
}
function firstDayOfNextMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}
function nextWeeklyOccurrence(date, weekDays) {
  let d = addDays(date, 1);
  for (let i = 0; i < 14; i++) {
    if (weekDays.includes(d.getDay())) return d;
    d = addDays(d, 1);
  }
  return addDays(date, 7);
}

function computeNextOccurrence(task) {
  if (!task.recurrence) return null;
  const rec = task.recurrence;
  const base = task.dueAt ? new Date(task.dueAt) : new Date();
  const time = { h: base.getHours(), m: base.getMinutes() };
  let next;
  switch (rec.type) {
    case "daily": next = addDays(base, 1); break;
    case "weekday": next = nextBusinessDay(base); break;
    case "weekly": next = nextWeeklyOccurrence(base, rec.weekDays?.length ? rec.weekDays : [base.getDay()]); break;
    case "interval": next = addDays(base, rec.intervalDays || 1); break;
    case "monthly_day": { const d = new Date(base); d.setMonth(d.getMonth() + 1); next = d; break; }
    case "monthly_last_business": { const d = firstDayOfNextMonth(base); next = lastBusinessDayOfMonth(d.getFullYear(), d.getMonth()); break; }
    case "monthly_first": next = firstDayOfNextMonth(base); break;
    case "after_completion": { const compBase = task.completedAt ? new Date(task.completedAt) : new Date(); next = addDays(compBase, rec.intervalDays || 1); break; }
    default: return null;
  }
  next.setHours(time.h, time.m, 0, 0);
  return next.toISOString();
}

function recurrenceLabel(rec) {
  if (!rec) return "";
  if (rec.type === "weekly" && rec.weekDays?.length) {
    return `Toda(s) ${rec.weekDays.map((d) => WEEKDAY_LABELS[d]).join(", ")}`;
  }
  if (rec.type === "interval") return `A cada ${rec.intervalDays || 1} dias`;
  if (rec.type === "after_completion") return `${rec.intervalDays || 1}d após concluir`;
  const opt = RECURRENCE_OPTIONS.find((o) => o.id === rec.type);
  return opt?.label || "Repete";
}

function normalizeTask(t) {
  let attachments = Array.isArray(t.attachments) ? [...t.attachments] : [];
  if (t.image && !attachments.some((a) => a.kind === "image" && a.dataUrl === t.image)) {
    attachments.push({ id: uid(), kind: "image", name: "Imagem", dataUrl: t.image });
  }
  return {
    ...t,
    attachments,
    subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
    comments: Array.isArray(t.comments) ? t.comments : [],
    watchers: Array.isArray(t.watchers) ? t.watchers : [],
    reminders: Array.isArray(t.reminders) ? t.reminders : [],
    assignee: t.assignee || "",
    recurrence: t.recurrence || null,
    completedAt: t.completedAt || null,
  };
}

// Monta um resumo compacto das tarefas para servir de contexto à IA
function buildTasksContext(tasks) {
  if (!tasks.length) return "Nenhuma tarefa cadastrada.";
  const sorted = sortByPriority(tasks);
  return sorted
    .map((t) => {
      const st = STATUSES.find((s) => s.id === t.status)?.label || t.status;
      const q = QUADRANTS.find((x) => x.id === t.quadrant)?.label || "";
      const prazo = t.dueAt ? `${fmtDate(t.dueAt)}${fmtTime(t.dueAt) ? ` ${fmtTime(t.dueAt)}` : ""}` : "sem prazo";
      const atraso = isOverdue(t) ? " · ATRASADA" : "";
      const sub = (t.subtasks || []).length ? ` · subtarefas ${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` : "";
      const resp = t.assignee ? ` · responsável: ${t.assignee}` : "";
      const rec = t.recurrence ? ` · recorrente (${recurrenceLabel(t.recurrence)})` : "";
      return `- [${st}] ${t.title} (${t.category}, prioridade: ${q}, prazo: ${prazo}${atraso}${sub}${resp}${rec})`;
    })
    .join("\n");
}

// Chama a API do Gemini diretamente do navegador (chave restrita por domínio)
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function callGeminiOnce(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) {
    if (res.status === 429) throw new Error("Limite gratuito diário do Gemini atingido. Tente novamente mais tarde.");
    if (res.status === 404) throw new Error("Modelo de IA não encontrado (404). O nome do modelo pode ter mudado — avise para eu atualizar.");
    if (res.status === 403) throw new Error("Acesso negado pela API (403). Confira a restrição por domínio da chave no Google Cloud Console.");
    if (res.status === 503 || res.status === 500) {
      const err = new Error("O servidor do Gemini está sobrecarregado no momento. Tente novamente em instantes.");
      err.retryable = true;
      throw err;
    }
    throw new Error(`Erro ao consultar a IA (${res.status}).`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Não consegui gerar uma resposta para essa pergunta.";
}

async function askGemini(question, tasks) {
  if (!GEMINI_API_KEY) {
    throw new Error("A chave da API do Gemini ainda não foi configurada nesta implantação.");
  }
  const prompt = `Você é o assistente de tarefas do app Vivaro. Responda em português, de forma direta e útil, usando apenas as tarefas listadas abaixo como contexto. A data e hora atuais são ${new Date().toLocaleString("pt-BR")}. Se a pergunta não puder ser respondida com esses dados, diga isso claramente em vez de inventar informações.

TAREFAS:
${buildTasksContext(tasks)}

PERGUNTA: ${question}`;

  // Retry automatically on transient server overload (503/500), with a short backoff.
  const delays = [1000, 2500];
  for (let attempt = 0; ; attempt++) {
    try {
      return await callGeminiOnce(prompt);
    } catch (err) {
      if (err.retryable && attempt < delays.length) {
        await sleep(delays[attempt]);
        continue;
      }
      throw err;
    }
  }
}



function parseVoiceText(raw) {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const now = new Date();
  let date = null;
  let time = null;
  const matchedSpans = [];

  const timeMatch = lower.match(/(^|\s)[àa]s\s+(\d{1,2})(?:[:h](\d{2}))?/i);
  if (timeMatch) {
    time = { h: parseInt(timeMatch[2], 10), m: timeMatch[3] ? parseInt(timeMatch[3], 10) : 0 };
    matchedSpans.push(timeMatch[0].trim());
  }

  if (lower.includes("amanhã") || lower.includes("amanha")) {
    date = addDays(now, 1);
    matchedSpans.push(lower.includes("amanhã") ? "amanhã" : "amanha");
  } else if (lower.includes("hoje")) {
    date = new Date(now);
    matchedSpans.push("hoje");
  } else {
    const weekdayMap = { domingo: 0, segunda: 1, terça: 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, sábado: 6, sabado: 6 };
    const wdMatch = lower.match(/domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado/);
    if (wdMatch) {
      const target = weekdayMap[wdMatch[0]];
      let d = addDays(now, 1);
      for (let i = 0; i < 8; i++) { if (d.getDay() === target) { date = d; break; } d = addDays(d, 1); }
      matchedSpans.push(wdMatch[0]);
    } else {
      const inDays = lower.match(/daqui a (\d+) dias?/);
      if (inDays) { date = addDays(now, parseInt(inDays[1], 10)); matchedSpans.push(inDays[0]); }
    }
  }

  let title = text;
  matchedSpans.forEach((span) => {
    title = title.replace(new RegExp(span.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "");
  });
  title = title
    .replace(/lembr(ar|e)[- ]?me\s*(de)?/i, "")
    .replace(/^\s*(de|que|,)\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;!?])/g, "$1")
    .trim()
    .replace(/[.,;]+$/, "");
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1);

  let dueDate = "", dueTime = "";
  if (date) dueDate = date.toISOString().slice(0, 10);
  if (time) dueTime = `${String(time.h).padStart(2, "0")}:${String(time.m).padStart(2, "0")}`;

  const reminders = dueTime ? [{ id: uid(), value: 1, unit: "hours" }] : [];

  return { title: title || text, dueDate, dueTime, reminders };
}

/* ------------------------------------------------------------------ */
/*  Small UI primitives                                                */
/* ------------------------------------------------------------------ */
function Pill({ active, onClick, color, softColor, children, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all"
      style={{
        borderColor: active ? color : C.border,
        background: active ? softColor : "transparent",
        color: active ? color : C.inkSoft,
      }}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

function Badge({ color, soft, children }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color, background: soft }}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Eisenhower mini matrix                                             */
/* ------------------------------------------------------------------ */
function EisenhowerWidget({ tasks, activeQuadrant, onSelect }) {
  const counts = useMemo(() => {
    const m = { 1: 0, 2: 0, 3: 0, 4: 0 };
    tasks.forEach((t) => { if (t.status !== "concluido" && t.status !== "cancelado") m[t.quadrant]++; });
    return m;
  }, [tasks]);

  return (
    <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
      {QUADRANTS.map((q) => (
        <button
          key={q.id}
          onClick={() => onSelect(activeQuadrant === q.id ? null : q.id)}
          className="rounded-xl p-3 text-left transition-all border-2"
          style={{ background: q.soft, borderColor: activeQuadrant === q.id ? q.color : "transparent" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: q.color }}>Q{q.id}</span>
            <span className="font-mono text-lg font-bold" style={{ color: q.color, fontFamily: "'IBM Plex Mono', monospace" }}>{counts[q.id]}</span>
          </div>
          <div className="text-sm font-semibold mt-0.5" style={{ color: C.ink }}>{q.label}</div>
          <div className="text-[11px]" style={{ color: C.inkSoft }}>{q.sub}</div>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lightbox / Note viewer                                             */
/* ------------------------------------------------------------------ */
function Lightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <img src={src} alt="" className="max-h-[90vh] max-w-[90vw] rounded-xl" onClick={(e) => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 text-white"><X size={28} /></button>
    </div>
  );
}

function NoteViewer({ note, onClose }) {
  if (!note) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(28,31,36,0.5)" }} onClick={onClose}>
      <div className="max-w-sm w-full rounded-2xl p-5" style={{ background: C.surface }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold inline-flex items-center gap-1.5" style={{ color: C.ink }}><StickyNote size={16} /> Nota</span>
          <button onClick={onClose}><X size={18} color={C.inkSoft} /></button>
        </div>
        <p className="text-sm whitespace-pre-wrap" style={{ color: C.ink }}>{note.text}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  About modal                                                        */
/* ------------------------------------------------------------------ */
function AboutModal({ onClose }) {
  const FEATURES = [
    { icon: LayoutDashboard, text: "Dashboard com matriz de Eisenhower e filtros por categoria, estado, prioridade e atraso" },
    { icon: Columns3, text: "Visões de Kanban, Lista, Calendário e Timeline para a mesma base de tarefas" },
    { icon: Repeat, text: "Recorrência inteligente: dias úteis, semanal, mensal e a cada X dias após concluir" },
    { icon: Check, text: "Subtarefas com progresso, responsável, observadores e comentários" },
    { icon: Paperclip, text: "Anexos de foto, imagem, PDF/documento, link, nota e localização" },
    { icon: Mic, text: "Criação e ditado de tarefas por voz" },
    { icon: CalendarPlus, text: "Exportação de tarefas para o Google Agenda" },
    { icon: DatabaseBackup, text: "Backup local em .json para exportar e restaurar suas tarefas" },
  ];
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(28,31,36,0.5)" }} onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl" style={{ background: C.surface }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
          <span className="font-bold text-lg inline-flex items-center gap-1.5" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}><Sparkles size={17} color={C.accent} /> Sobre o Vivaro</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-60" style={{ color: C.inkSoft }}><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Vivaro" className="w-14 h-14 rounded-2xl object-contain" style={{ background: C.surfaceSunk }} />
            <div>
              <div className="font-bold text-base" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Vivaro</div>
              <div className="text-xs" style={{ color: C.inkSoft }}>Gerenciamento, controle e finalização de tarefas</div>
            </div>
          </div>

          <p className="text-sm leading-relaxed" style={{ color: C.inkSoft }}>
            O Vivaro organiza suas tarefas pessoais e profissionais em um só lugar, priorizando pelo que realmente importa
            com a matriz de Eisenhower e acompanhando a execução em Kanban, Lista, Calendário ou Timeline.
          </p>

          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.inkSoft }}>Principais recursos</div>
            <div className="space-y-2">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.primarySoft }}>
                    <f.icon size={14} color={C.primary} />
                  </div>
                  <span className="text-sm mt-1" style={{ color: C.ink }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 text-center" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="text-xs" style={{ color: C.inkSoft }}>Vivaro</div>
          <div className="text-sm font-semibold mt-0.5" style={{ color: C.ink }}>Autor: Jonas Rios</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI chat — pergunte sobre suas tarefas (Gemini API)                 */
/* ------------------------------------------------------------------ */
function AIChatModal({ tasks, onClose }) {
  const [messages, setMessages] = useState([
    { id: uid(), role: "ai", text: "Olá! Pergunte sobre suas tarefas — prazos, prioridades, o que está atrasado, o que fazer primeiro, e mais." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages, loading]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { id: uid(), role: "user", text: question }]);
    setLoading(true);
    try {
      const answer = await askGemini(question, tasks);
      setMessages((prev) => [...prev, { id: uid(), role: "ai", text: answer }]);
    } catch (err) {
      setMessages((prev) => [...prev, { id: uid(), role: "ai", text: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(28,31,36,0.5)" }}>
      <div className="w-full sm:max-w-lg h-[85vh] sm:h-[70vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden" style={{ background: C.surface }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span className="font-bold text-lg inline-flex items-center gap-1.5" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}>
            <Bot size={18} color={C.primary} /> Perguntar sobre tarefas
          </span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-60" style={{ color: C.inkSoft }}><X size={20} /></button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap"
                style={{
                  background: m.role === "user" ? C.primary : C.surfaceSunk,
                  color: m.role === "user" ? "#fff" : C.ink,
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-3.5 py-2.5 text-sm" style={{ background: C.surfaceSunk, color: C.inkSoft }}>Pensando...</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
            placeholder="Ex: o que tenho pra fazer essa semana?"
            className="flex-1 px-3 py-2.5 rounded-xl outline-none border text-sm"
            style={{ borderColor: C.border, color: C.ink }}
          />
          <button onClick={send} disabled={!input.trim() || loading} className="p-2.5 rounded-xl text-white disabled:opacity-40" style={{ background: C.primary }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Task Card                                                          */
/* ------------------------------------------------------------------ */
function TaskCard({ task, onEdit, onDelete, onStatusChange, onExport, onOpenAttachment, draggable, onDragStart }) {
  const q = QUADRANTS.find((x) => x.id === task.quadrant) || QUADRANTS[3];
  const st = STATUSES.find((s) => s.id === task.status) || STATUSES[0];
  const overdue = isOverdue(task);
  const catColor = task.category === "pessoal" ? C.pessoal : C.profissional;
  const catSoft = task.category === "pessoal" ? C.pessoalSoft : C.profissionalSoft;
  const attachments = task.attachments || [];
  const images = attachments.filter((a) => a.kind === "image");
  const otherAttachments = attachments.filter((a) => a.kind !== "image");
  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter((s) => s.done).length;
  const pct = subtasks.length ? Math.round((doneCount / subtasks.length) * 100) : 0;
  const ICONS = { file: FileText, link: Link2, note: StickyNote, location: MapPin };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className="rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow cursor-default"
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeftWidth: 4, borderLeftColor: q.color }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge color={catColor} soft={catSoft}>{task.category === "pessoal" ? "Pessoal" : "Profissional"}</Badge>
          <Badge color={q.color} soft={q.soft}>{q.label}</Badge>
          {task.recurrence && (
            <Badge color={C.primary} soft={C.primarySoft}><Repeat size={11} style={{ marginRight: 3 }} />{recurrenceLabel(task.recurrence)}</Badge>
          )}
          {overdue && <Badge color={C.danger} soft={C.dangerSoft}><AlertTriangle size={11} style={{ marginRight: 3 }} /> Atrasada</Badge>}
        </div>
        {draggable && <GripVertical size={14} color={C.inkSoft} />}
      </div>

      <div className="mt-2 font-semibold text-[15px] leading-snug" style={{ color: C.ink }}>{task.title}</div>
      {task.description && <div className="text-sm mt-0.5 line-clamp-2" style={{ color: C.inkSoft }}>{task.description}</div>}

      {images[0] && (
        <img src={images[0].dataUrl} alt="" onClick={() => onOpenAttachment?.(images[0])} className="mt-2 rounded-lg max-h-32 w-full object-cover cursor-pointer" />
      )}

      {otherAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {otherAttachments.map((a) => {
            const Icon = ICONS[a.kind] || Paperclip;
            return (
              <button key={a.id} onClick={() => onOpenAttachment?.(a)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium" style={{ background: C.surfaceSunk, color: C.ink }}>
                <Icon size={11} /> <span className="max-w-[90px] truncate">{a.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {subtasks.length > 0 && (
        <div className="mt-2.5">
          <div className="text-[11px] font-semibold mb-1" style={{ color: C.inkSoft }}>{doneCount}/{subtasks.length} concluídas · {pct}%</div>
          <div className="h-1.5 rounded-full w-full" style={{ background: C.surfaceSunk }}>
            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: C.primary }} />
          </div>
        </div>
      )}

      <div className="flex items-center flex-wrap gap-2 mt-3 text-xs" style={{ color: C.inkSoft }}>
        {task.dueAt && (
          <span className="inline-flex items-center gap-1" style={{ color: overdue ? C.danger : C.inkSoft, fontWeight: overdue ? 700 : 500 }}>
            <CalendarDays size={12} /> {fmtDate(task.dueAt)}{fmtTime(task.dueAt) ? ` · ${fmtTime(task.dueAt)}` : ""}
          </span>
        )}
        {task.reminders?.length > 0 && <span className="inline-flex items-center gap-1"><Bell size={12} /> {task.reminders.length}</span>}
        {task.comments?.length > 0 && <span className="inline-flex items-center gap-1"><MessageSquare size={12} /> {task.comments.length}</span>}
        {task.assignee && (
          <span className="inline-flex items-center gap-1 ml-auto font-semibold px-1.5 py-0.5 rounded-full" style={{ background: C.surfaceSunk, color: C.ink }}>{task.assignee}</span>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: `1px solid ${C.border}` }}>
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value)}
          className="text-xs font-semibold rounded-lg px-2 py-1 border outline-none"
          style={{ borderColor: C.border, color: st.color, background: C.bg }}
        >
          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <button title="Exportar para Google Agenda" onClick={() => onExport(task)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: C.primary }}><CalendarPlus size={15} /></button>
          <button title="Editar" onClick={() => onEdit(task)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: C.inkSoft }}><Pencil size={14} /></button>
          <button title="Excluir" onClick={() => onDelete(task.id)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: C.danger }}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Editors used inside the modal                                      */
/* ------------------------------------------------------------------ */
function TagInput({ values, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium" style={{ background: C.surfaceSunk, color: C.ink }}>
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none"
          style={{ borderColor: C.border, color: C.ink }}
        />
        <button type="button" onClick={add} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: C.border, color: C.ink }}>+</button>
      </div>
    </div>
  );
}

function SubtaskEditor({ subtasks, onChange }) {
  const add = () => onChange([...subtasks, { id: uid(), title: "", done: false }]);
  const update = (id, patch) => onChange(subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id) => onChange(subtasks.filter((s) => s.id !== id));
  const done = subtasks.filter((s) => s.done).length;
  return (
    <div>
      {subtasks.length > 0 && (
        <div className="text-xs font-semibold mb-2" style={{ color: C.inkSoft }}>
          {done}/{subtasks.length} concluídas · {Math.round((done / subtasks.length) * 100)}%
        </div>
      )}
      <div className="space-y-1.5">
        {subtasks.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => update(s.id, { done: !s.done })}
              className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0"
              style={{ borderColor: s.done ? C.primary : C.border, background: s.done ? C.primary : "transparent" }}
            >
              {s.done && <Check size={12} color="#fff" />}
            </button>
            <input
              value={s.title}
              onChange={(e) => update(s.id, { title: e.target.value })}
              placeholder="Subtarefa..."
              className="flex-1 px-2 py-1.5 rounded-lg border text-sm outline-none"
              style={{ borderColor: C.border, textDecoration: s.done ? "line-through" : "none", color: s.done ? C.inkSoft : C.ink }}
            />
            <button type="button" onClick={() => remove(s.id)} style={{ color: C.danger }}><X size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="text-xs font-semibold inline-flex items-center gap-1 mt-2" style={{ color: C.primary }}>
        <Plus size={13} /> Adicionar subtarefa
      </button>
    </div>
  );
}

function RecurrenceEditor({ recurrence, onChange }) {
  const type = recurrence?.type || "";
  const setType = (t) => {
    if (!t) { onChange(null); return; }
    onChange({ type: t, weekDays: recurrence?.weekDays || [], intervalDays: recurrence?.intervalDays || 15 });
  };
  const toggleWeekDay = (d) => {
    const cur = recurrence?.weekDays || [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    onChange({ ...recurrence, weekDays: next });
  };
  return (
    <div>
      <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl outline-none border text-sm font-medium" style={{ borderColor: C.border, color: C.ink }}>
        {RECURRENCE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      {type === "weekly" && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {WEEKDAY_LABELS.map((lbl, idx) => (
            <button
              type="button" key={idx} onClick={() => toggleWeekDay(idx)}
              className="w-9 h-9 rounded-full text-xs font-bold border"
              style={{
                borderColor: recurrence?.weekDays?.includes(idx) ? C.primary : C.border,
                background: recurrence?.weekDays?.includes(idx) ? C.primarySoft : "transparent",
                color: recurrence?.weekDays?.includes(idx) ? C.primary : C.inkSoft,
              }}
            >{lbl}</button>
          ))}
        </div>
      )}
      {(type === "interval" || type === "after_completion") && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number" min={1} value={recurrence?.intervalDays || 1}
            onChange={(e) => onChange({ ...recurrence, intervalDays: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-20 px-2 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: C.border, color: C.ink }}
          />
          <span className="text-sm" style={{ color: C.inkSoft }}>dias {type === "after_completion" ? "após concluir a tarefa" : "de intervalo"}</span>
        </div>
      )}
    </div>
  );
}

function AttachmentEditor({ attachments, onChange, onOpen }) {
  const imgCam = useRef(null);
  const imgFile = useRef(null);
  const docFile = useRef(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [showNote, setShowNote] = useState(false);

  const addFile = (file, kind) => {
    const reader = new FileReader();
    reader.onload = () => onChange([...attachments, { id: uid(), kind, name: file.name, mime: file.type, dataUrl: reader.result }]);
    reader.readAsDataURL(file);
  };
  const addLink = () => {
    if (!linkDraft.trim()) return;
    onChange([...attachments, { id: uid(), kind: "link", name: linkDraft.trim(), url: linkDraft.trim() }]);
    setLinkDraft(""); setShowLink(false);
  };
  const addNote = () => {
    if (!noteDraft.trim()) return;
    onChange([...attachments, { id: uid(), kind: "note", name: noteDraft.slice(0, 30) || "Nota", text: noteDraft.trim() }]);
    setNoteDraft(""); setShowNote(false);
  };
  const addLocation = () => {
    if (!navigator.geolocation) {
      const address = prompt("Geolocalização indisponível. Digite um endereço:");
      if (address) onChange([...attachments, { id: uid(), kind: "location", name: address, address }]);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange([...attachments, { id: uid(), kind: "location", name: "Localização atual", lat: pos.coords.latitude, lng: pos.coords.longitude }]),
      () => {
        const address = prompt("Não foi possível obter sua localização. Digite um endereço:");
        if (address) onChange([...attachments, { id: uid(), kind: "location", name: address, address }]);
      }
    );
  };
  const remove = (id) => onChange(attachments.filter((a) => a.id !== id));
  const ICONS = { image: ImageIcon, file: FileText, link: Link2, note: StickyNote, location: MapPin };
  const btnStyle = { borderColor: C.border, color: C.ink };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => imgCam.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium" style={btnStyle}><Camera size={14} /> Foto</button>
        <button type="button" onClick={() => imgFile.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium" style={btnStyle}><ImageIcon size={14} /> Imagem</button>
        <button type="button" onClick={() => docFile.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium" style={btnStyle}><FileText size={14} /> PDF/Documento</button>
        <button type="button" onClick={() => setShowLink((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium" style={btnStyle}><Link2 size={14} /> Link</button>
        <button type="button" onClick={() => setShowNote((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium" style={btnStyle}><StickyNote size={14} /> Nota</button>
        <button type="button" onClick={addLocation} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium" style={btnStyle}><MapPin size={14} /> Localização</button>
        <input ref={imgCam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addFile(f, "image"); e.target.value = ""; }} />
        <input ref={imgFile} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addFile(f, "image"); e.target.value = ""; }} />
        <input ref={docFile} type="file" accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addFile(f, "file"); e.target.value = ""; }} />
      </div>
      {showLink && (
        <div className="flex gap-2 mt-2">
          <input value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} placeholder="https://..." className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: C.border, color: C.ink }} />
          <button type="button" onClick={addLink} className="px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.primary }}>Adicionar</button>
        </div>
      )}
      {showNote && (
        <div className="flex gap-2 mt-2">
          <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Escreva a nota..." className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: C.border, color: C.ink }} />
          <button type="button" onClick={addNote} className="px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.primary }}>Adicionar</button>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {attachments.map((a) => {
            const Icon = ICONS[a.kind] || Paperclip;
            return (
              <div key={a.id} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-xs" style={{ background: C.surfaceSunk }}>
                <button type="button" onClick={() => onOpen?.(a)} className="inline-flex items-center gap-1 font-medium" style={{ color: C.ink }}>
                  <Icon size={12} /> <span className="max-w-[110px] truncate">{a.name}</span>
                </button>
                <button type="button" onClick={() => remove(a.id)} style={{ color: C.danger }}><X size={12} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CommentsEditor({ comments, onChange }) {
  const [author, setAuthor] = useState("Você");
  const [text, setText] = useState("");
  const add = () => {
    if (!text.trim()) return;
    onChange([...comments, { id: uid(), author: author.trim() || "Você", text: text.trim(), createdAt: new Date().toISOString() }]);
    setText("");
  };
  return (
    <div>
      {comments.length > 0 && (
        <div className="space-y-2 mb-2 max-h-40 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="text-sm rounded-lg px-3 py-2" style={{ background: C.surfaceSunk }}>
              <span className="font-semibold" style={{ color: C.ink }}>{c.author}</span>
              <span className="ml-1" style={{ color: C.inkSoft }}>— {c.text}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={author} onChange={(e) => setAuthor(e.target.value)} className="w-24 px-2 py-2 rounded-lg border text-xs outline-none" style={{ borderColor: C.border, color: C.ink }} placeholder="Nome" />
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: C.border, color: C.ink }}
          placeholder="Escrever um comentário..."
        />
        <button type="button" onClick={add} className="px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.primary }}>Enviar</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Install banner (PWA — Adicionar à tela inicial do celular)         */
/* ------------------------------------------------------------------ */
function InstallBanner({ variant, onInstall, onDismiss }) {
  if (!variant) return null;
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3">
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: C.primarySoft, border: `1px solid ${C.primary}` }}>
        <Smartphone size={18} color={C.primary} className="flex-shrink-0" />
        <div className="flex-1 text-sm" style={{ color: C.ink }}>
          {variant === "android"
            ? "Instale o Vivaro na tela inicial do seu celular para usar como um app e receber os lembretes em formato de notificação."
            : "Para instalar o Vivaro no iPhone: toque no ícone de Compartilhar do Safari e depois em \"Adicionar à Tela de Início\"."}
        </div>
        {variant === "android" && (
          <button onClick={onInstall} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0" style={{ background: C.primary }}>Instalar</button>
        )}
        <button onClick={onDismiss} className="flex-shrink-0" style={{ color: C.inkSoft }}><X size={16} /></button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reminder notifications: permission banner + in-app toasts          */
/* ------------------------------------------------------------------ */
function NotificationBanner({ permission, onEnable, onDismiss }) {
  if (permission === "granted" || permission === "unsupported") return null;
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3">
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: C.accentSoft, border: `1px solid ${C.accent}` }}>
        <BellRing size={18} color={C.accent} className="flex-shrink-0" />
        <div className="flex-1 text-sm" style={{ color: C.ink }}>
          {permission === "denied"
            ? "As notificações estão bloqueadas nas configurações do navegador. Ative-as manualmente para receber os lembretes."
            : "Ative as notificações para receber avisos dos lembretes que você configurar nas tarefas."}
        </div>
        {permission === "default" && (
          <button onClick={onEnable} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0" style={{ background: C.accent }}>Ativar</button>
        )}
        <button onClick={onDismiss} className="flex-shrink-0" style={{ color: C.inkSoft }}><X size={16} /></button>
      </div>
    </div>
  );
}

function ReminderToasts({ toasts, onDismiss, onExport }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[80] flex flex-col gap-2 sm:w-80">
      {toasts.map((t) => (
        <div key={t.id} className="rounded-xl p-3.5 shadow-lg flex items-start gap-2.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <BellRing size={16} color={C.accent} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: C.ink }}>Lembrete: {t.task.title}</div>
            <div className="text-xs mt-0.5" style={{ color: C.inkSoft }}>
              Prazo {fmtDate(t.task.dueAt)}{fmtTime(t.task.dueAt) ? ` · ${fmtTime(t.task.dueAt)}` : ""}
            </div>
            <button onClick={() => onExport(t.task)} className="text-xs font-semibold mt-1.5" style={{ color: C.primary }}>Ver na Google Agenda</button>
          </div>
          <button onClick={() => onDismiss(t.id)} style={{ color: C.inkSoft }}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Theme toggle switch                                                */
/* ------------------------------------------------------------------ */
function ThemeToggle({ theme, onToggle }) {
  const dark = theme === "dark";
  return (
    <button
      onClick={onToggle}
      title={dark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      aria-label={dark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className="relative inline-flex items-center w-12 h-7 rounded-full flex-shrink-0 transition-colors"
      style={{ background: C.surfaceSunk, border: `1px solid ${C.border}` }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-transform"
        style={{ background: C.surface, transform: dark ? "translateX(20px)" : "translateX(0)", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
      >
        {dark ? <Moon size={11} color={C.primary} /> : <Sun size={11} color={C.accent} />}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Voice capture button                                               */
/* ------------------------------------------------------------------ */
function VoiceCaptureButton({ onResult }) {
  const [listening, setListening] = useState(false);
  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Reconhecimento de voz não é suportado neste navegador. Tente pelo Google Chrome."); return; }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => onResult(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };
  return (
    <button
      onClick={start} title="Criar tarefa por voz"
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm"
      style={{ background: listening ? C.accent : C.surfaceSunk, color: listening ? "#fff" : C.ink }}
    >
      <Mic size={16} /> <span className="hidden sm:inline">{listening ? "Ouvindo..." : "Voz"}</span>
    </button>
  );
}

// Compact mic icon used to dictate text into a specific field (e.g. description)
function DictateFieldButton({ onText, title = "Ditar por voz" }) {
  const [listening, setListening] = useState(false);
  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Reconhecimento de voz não é suportado neste navegador. Tente pelo Google Chrome."); return; }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => onText(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    setListening(true);
  };
  return (
    <button
      type="button" onClick={start} title={title}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold flex-shrink-0"
      style={{ background: listening ? C.accent : C.surfaceSunk, color: listening ? "#fff" : C.inkSoft }}
    >
      <Mic size={12} /> {listening ? "Ouvindo..." : "Ditar"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Task Form Modal                                                    */
/* ------------------------------------------------------------------ */
function TaskModal({ initial, voicePrefill, onSave, onClose, onOpenAttachment }) {
  const blank = {
    id: null, title: "", description: "", category: "pessoal",
    quadrant: 2, status: "pendente", dueDate: "", dueTime: "",
    reminders: [], attachments: [], subtasks: [], assignee: "", watchers: [], comments: [], recurrence: null,
  };
  const [form, setForm] = useState(() => {
    if (!initial) return { ...blank, ...(voicePrefill || {}) };
    const dueAt = initial.dueAt ? new Date(initial.dueAt) : null;
    return {
      ...blank,
      ...initial,
      dueDate: dueAt ? dueAt.toISOString().slice(0, 10) : "",
      dueTime: dueAt && (dueAt.getHours() || dueAt.getMinutes()) ? dueAt.toTimeString().slice(0, 5) : "",
    };
  });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addReminder = () => update("reminders", [...form.reminders, { id: uid(), value: 1, unit: "hours" }]);
  const updateReminder = (id, patch) => update("reminders", form.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeReminder = (id) => update("reminders", form.reminders.filter((r) => r.id !== id));

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    let dueAt = null;
    if (form.dueDate) dueAt = new Date(`${form.dueDate}T${form.dueTime || "00:00"}:00`).toISOString();
    onSave({
      id: form.id || uid(),
      title: form.title.trim(),
      description: form.description,
      category: form.category,
      quadrant: form.quadrant,
      status: form.status,
      dueAt,
      reminders: form.reminders,
      attachments: form.attachments,
      subtasks: form.subtasks,
      assignee: form.assignee,
      watchers: form.watchers,
      comments: form.comments,
      recurrence: form.recurrence,
      completedAt: form.status === "concluido" ? (form.completedAt || new Date().toISOString()) : null,
      createdAt: form.createdAt || new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(28,31,36,0.5)" }}>
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl" style={{ background: C.surface }}>
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10" style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
          <h2 className="font-bold text-lg" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}>{initial ? "Editar tarefa" : "Nova tarefa"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-60" style={{ color: C.inkSoft }}><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Título</label>
            <input autoFocus value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Ex: Finalizar relatório mensal"
              className="w-full mt-1.5 px-3 py-2.5 rounded-xl outline-none border text-[15px]" style={{ borderColor: C.border, color: C.ink }} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Descrição</label>
              <DictateFieldButton
                title="Ditar descrição por voz"
                onText={(transcript) => update("description", form.description ? `${form.description} ${transcript}` : transcript)}
              />
            </div>
            <textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Detalhes da tarefa (opcional) — ou toque em Ditar e fale" rows={2}
              className="w-full mt-1.5 px-3 py-2.5 rounded-xl outline-none border text-sm resize-none" style={{ borderColor: C.border, color: C.ink }} />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Categoria</label>
            <div className="flex gap-2 mt-1.5">
              <Pill active={form.category === "pessoal"} onClick={() => update("category", "pessoal")} color={C.pessoal} softColor={C.pessoalSoft} icon={User}>Pessoal</Pill>
              <Pill active={form.category === "profissional"} onClick={() => update("category", "profissional")} color={C.profissional} softColor={C.profissionalSoft} icon={Briefcase}>Profissional</Pill>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Prioridade (matriz de Eisenhower)</label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {QUADRANTS.map((q) => (
                <button key={q.id} onClick={() => update("quadrant", q.id)} className="rounded-xl p-2.5 text-left border-2 transition-all" style={{ background: q.soft, borderColor: form.quadrant === q.id ? q.color : "transparent" }}>
                  <div className="text-sm font-bold" style={{ color: q.color }}>{q.label}</div>
                  <div className="text-[11px]" style={{ color: C.inkSoft }}>{q.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Estado</label>
            <select value={form.status} onChange={(e) => update("status", e.target.value)} className="w-full mt-1.5 px-3 py-2.5 rounded-xl outline-none border text-sm font-medium" style={{ borderColor: C.border, color: C.ink }}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Prazo</label>
            <div className="flex gap-2 mt-1.5">
              <input type="date" value={form.dueDate} onChange={(e) => update("dueDate", e.target.value)} className="flex-1 px-3 py-2.5 rounded-xl outline-none border text-sm" style={{ borderColor: C.border, color: C.ink }} />
              <input type="time" value={form.dueTime} onChange={(e) => update("dueTime", e.target.value)} className="w-28 px-3 py-2.5 rounded-xl outline-none border text-sm" style={{ borderColor: C.border, color: C.ink }} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Recorrência</label>
            <div className="mt-1.5"><RecurrenceEditor recurrence={form.recurrence} onChange={(r) => update("recurrence", r)} /></div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Lembretes</label>
              <button onClick={addReminder} className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: C.primary }}><Plus size={13} /> Adicionar lembrete</button>
            </div>
            <div className="space-y-2 mt-1.5">
              {form.reminders.length === 0 && <div className="text-xs" style={{ color: C.inkSoft }}>Nenhum lembrete configurado.</div>}
              {form.reminders.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <input type="number" min={1} value={r.value} onChange={(e) => updateReminder(r.id, { value: Math.max(1, parseInt(e.target.value) || 1) })} className="w-16 px-2 py-1.5 rounded-lg border text-sm outline-none" style={{ borderColor: C.border, color: C.ink }} />
                  <select value={r.unit} onChange={(e) => updateReminder(r.id, { unit: e.target.value })} className="px-2 py-1.5 rounded-lg border text-sm outline-none flex-1" style={{ borderColor: C.border, color: C.ink }}>
                    {REMINDER_UNITS.map((u) => <option key={u.id} value={u.id}>{u.label} antes</option>)}
                  </select>
                  <button onClick={() => removeReminder(r.id)} className="p-1.5" style={{ color: C.danger }}><X size={15} /></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Subtarefas</label>
            <div className="mt-1.5"><SubtaskEditor subtasks={form.subtasks} onChange={(s) => update("subtasks", s)} /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Responsável</label>
              <input value={form.assignee} onChange={(e) => update("assignee", e.target.value)} placeholder="Ex: João" className="w-full mt-1.5 px-3 py-2.5 rounded-xl outline-none border text-sm" style={{ borderColor: C.border, color: C.ink }} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Observadores</label>
              <div className="mt-1.5"><TagInput values={form.watchers} onChange={(w) => update("watchers", w)} placeholder="Adicionar observador" /></div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Anexos</label>
            <div className="mt-1.5"><AttachmentEditor attachments={form.attachments} onChange={(a) => update("attachments", a)} onOpen={onOpenAttachment} /></div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkSoft }}>Comentários</label>
            <div className="mt-1.5"><CommentsEditor comments={form.comments} onChange={(c) => update("comments", c)} /></div>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 sticky bottom-0" style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}>
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: C.border, color: C.inkSoft }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={!form.title.trim()} className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-40" style={{ background: C.primary }}>Salvar tarefa</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter Bar                                                         */
/* ------------------------------------------------------------------ */
function FilterBar({ filters, setFilters }) {
  const toggleStatus = (id) => setFilters((f) => ({ ...f, statuses: f.statuses.includes(id) ? f.statuses.filter((s) => s !== id) : [...f.statuses, id] }));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill active={filters.category === "todas"} onClick={() => setFilters((f) => ({ ...f, category: "todas" }))} color={C.ink} softColor={C.surfaceSunk}>Todas</Pill>
      <Pill active={filters.category === "pessoal"} onClick={() => setFilters((f) => ({ ...f, category: "pessoal" }))} color={C.pessoal} softColor={C.pessoalSoft} icon={User}>Pessoal</Pill>
      <Pill active={filters.category === "profissional"} onClick={() => setFilters((f) => ({ ...f, category: "profissional" }))} color={C.profissional} softColor={C.profissionalSoft} icon={Briefcase}>Profissional</Pill>

      <div className="w-px h-5 mx-1" style={{ background: C.border }} />
      {STATUSES.map((s) => (
        <Pill key={s.id} active={filters.statuses.includes(s.id)} onClick={() => toggleStatus(s.id)} color={s.color} softColor={C.surfaceSunk}>{s.label}</Pill>
      ))}

      <div className="w-px h-5 mx-1" style={{ background: C.border }} />
      <Pill active={filters.overdueOnly} onClick={() => setFilters((f) => ({ ...f, overdueOnly: !f.overdueOnly, onTimeOnly: false }))} color={C.danger} softColor={C.dangerSoft} icon={AlertTriangle}>Em atraso</Pill>
      <Pill active={filters.onTimeOnly} onClick={() => setFilters((f) => ({ ...f, onTimeOnly: !f.onTimeOnly, overdueOnly: false }))} color={C.primary} softColor={C.primarySoft} icon={Clock}>Dentro do prazo</Pill>

      <div className="w-px h-5 mx-1" style={{ background: C.border }} />
      <Pill active={filters.hideDone} onClick={() => setFilters((f) => ({ ...f, hideDone: !f.hideDone }))} color={C.ink} softColor={C.surfaceSunk} icon={filters.hideDone ? EyeOff : Eye}>
        {filters.hideDone ? "Concluídas/canceladas ocultas" : "Mostrar concluídas/canceladas"}
      </Pill>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared filter/sort helpers                                         */
/* ------------------------------------------------------------------ */
function applyFilters(tasks, filters, activeQuadrant) {
  return tasks.filter((t) => {
    if (filters.category !== "todas" && t.category !== filters.category) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(t.status)) return false;
    if (filters.hideDone && (t.status === "concluido" || t.status === "cancelado")) return false;
    if (filters.overdueOnly && !isOverdue(t)) return false;
    if (filters.onTimeOnly && (isOverdue(t) || !t.dueAt || t.status === "concluido" || t.status === "cancelado")) return false;
    if (activeQuadrant && t.quadrant !== activeQuadrant) return false;
    return true;
  });
}

function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.quadrant !== b.quadrant) return a.quadrant - b.quadrant;
    const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return ad - bd;
  });
}

function EmptyState() {
  return (
    <div className="text-center py-16 rounded-2xl" style={{ background: C.surface, border: `1px dashed ${C.border}` }}>
      <div className="text-sm font-semibold" style={{ color: C.ink }}>Nenhuma tarefa por aqui</div>
      <div className="text-sm mt-1" style={{ color: C.inkSoft }}>Ajuste os filtros ou crie uma nova tarefa para começar.</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Views                                                               */
/* ------------------------------------------------------------------ */
function DashboardView({ tasks, filters, setFilters, activeQuadrant, setActiveQuadrant, ...cardHandlers }) {
  const filtered = useMemo(() => sortByPriority(applyFilters(tasks, filters, activeQuadrant)), [tasks, filters, activeQuadrant]);
  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row gap-5 lg:items-start">
        <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.inkSoft }}>Matriz de Eisenhower</div>
          <EisenhowerWidget tasks={tasks} activeQuadrant={activeQuadrant} onSelect={setActiveQuadrant} />
        </div>
        <div className="flex-1 rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.inkSoft }}>Filtros</div>
          <FilterBar filters={filters} setFilters={setFilters} />
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2" style={{ color: C.inkSoft }}>{filtered.length} {filtered.length === 1 ? "tarefa" : "tarefas"} · ordenadas por prioridade</div>
        {filtered.length === 0 ? <EmptyState /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((t) => <TaskCard key={t.id} task={t} {...cardHandlers} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanView({ tasks, filters, setFilters, activeQuadrant, setActiveQuadrant, ...cardHandlers }) {
  const filtered = useMemo(() => sortByPriority(applyFilters(tasks, filters, activeQuadrant)), [tasks, filters, activeQuadrant]);
  const visibleStatuses = filters.hideDone ? STATUSES.filter((s) => s.id !== "concluido" && s.id !== "cancelado") : STATUSES;
  const dragId = useRef(null);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}><FilterBar filters={filters} setFilters={setFilters} /></div>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {visibleStatuses.map((s) => {
          const col = filtered.filter((t) => t.status === s.id);
          return (
            <div key={s.id} className="flex-shrink-0 w-72 rounded-2xl p-3" style={{ background: C.surfaceSunk }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId.current) cardHandlers.onStatusChange(dragId.current, s.id); dragId.current = null; }}>
              <div className="flex items-center justify-between px-1 mb-3">
                <span className="text-sm font-bold" style={{ color: s.color }}>{s.label}</span>
                <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded-md" style={{ color: s.color, background: C.surface, fontFamily: "'IBM Plex Mono', monospace" }}>{col.length}</span>
              </div>
              <div className="space-y-2.5 min-h-[60px]">
                {col.map((t) => <TaskCard key={t.id} task={t} draggable onDragStart={() => { dragId.current = t.id; }} {...cardHandlers} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ tasks, filters, setFilters, activeQuadrant, ...cardHandlers }) {
  const filtered = useMemo(() => sortByPriority(applyFilters(tasks, filters, activeQuadrant)), [tasks, filters, activeQuadrant]);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}><FilterBar filters={filters} setFilters={setFilters} /></div>
      {filtered.length === 0 ? <EmptyState /> : (
        <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          {filtered.map((t, i) => {
            const q = QUADRANTS.find((x) => x.id === t.quadrant) || QUADRANTS[3];
            const st = STATUSES.find((s) => s.id === t.status) || STATUSES[0];
            const overdue = isOverdue(t);
            const subtasks = t.subtasks || [];
            const done = subtasks.filter((s) => s.done).length;
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 flex-wrap sm:flex-nowrap" style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                <button onClick={() => cardHandlers.onStatusChange(t.id, t.status === "concluido" ? "pendente" : "concluido")} className="w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center" style={{ borderColor: t.status === "concluido" ? C.primary : C.border, background: t.status === "concluido" ? C.primary : "transparent" }}>
                  {t.status === "concluido" && <Check size={12} color="#fff" />}
                </button>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: q.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: C.ink, textDecoration: t.status === "concluido" ? "line-through" : "none" }}>{t.title}</div>
                  <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap" style={{ color: C.inkSoft }}>
                    <span>{t.category === "pessoal" ? "Pessoal" : "Profissional"}</span>
                    {t.dueAt && <span style={{ color: overdue ? C.danger : C.inkSoft, fontWeight: overdue ? 700 : 500 }}>· {fmtDate(t.dueAt)}{fmtTime(t.dueAt) ? ` ${fmtTime(t.dueAt)}` : ""}</span>}
                    {subtasks.length > 0 && <span>· {done}/{subtasks.length}</span>}
                    {t.recurrence && <span className="inline-flex items-center gap-0.5">· <Repeat size={10} /></span>}
                    {t.assignee && <span>· {t.assignee}</span>}
                  </div>
                </div>
                <Badge color={st.color} soft={C.surfaceSunk}>{st.label}</Badge>
                <button onClick={() => cardHandlers.onEdit(t)} className="p-1.5" style={{ color: C.inkSoft }}><Pencil size={14} /></button>
                <button onClick={() => cardHandlers.onDelete(t.id)} className="p-1.5" style={{ color: C.danger }}><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CalendarView({ tasks, filters, setFilters, activeQuadrant, ...cardHandlers }) {
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDate, setSelectedDate] = useState(null);
  const filtered = useMemo(() => applyFilters(tasks, filters, activeQuadrant), [tasks, filters, activeQuadrant]);

  const byDate = useMemo(() => {
    const m = {};
    filtered.forEach((t) => { if (!t.dueAt) return; const key = new Date(t.dueAt).toDateString(); (m[key] = m[key] || []).push(t); });
    return m;
  }, [filtered]);

  const year = month.getFullYear(), mIdx = month.getMonth();
  const firstDay = new Date(year, mIdx, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, mIdx + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, mIdx, d));
  const todayKey = new Date().toDateString();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}><FilterBar filters={filters} setFilters={setFilters} /></div>
      <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMonth(new Date(year, mIdx - 1, 1))} className="p-1.5 rounded-lg" style={{ color: C.inkSoft }}><ChevronLeft size={18} /></button>
          <div className="font-bold capitalize" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}>{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>
          <button onClick={() => setMonth(new Date(year, mIdx + 1, 1))} className="p-1.5 rounded-lg" style={{ color: C.inkSoft }}><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold mb-1" style={{ color: C.inkSoft }}>
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = d.toDateString();
            const dayTasks = byDate[key] || [];
            const isToday = key === todayKey;
            const isSelected = selectedDate && key === selectedDate.toDateString();
            return (
              <button key={i} onClick={() => setSelectedDate(d)} className="aspect-square rounded-lg p-1 text-left flex flex-col overflow-hidden border" style={{ borderColor: isSelected ? C.primary : isToday ? C.accent : C.border, background: isSelected ? C.primarySoft : C.surface }}>
                <span className="text-xs font-semibold" style={{ color: isToday ? C.accent : C.ink }}>{d.getDate()}</span>
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {dayTasks.slice(0, 3).map((t) => { const q = QUADRANTS.find((x) => x.id === t.quadrant) || QUADRANTS[3]; return <span key={t.id} className="w-1.5 h-1.5 rounded-full" style={{ background: q.color }} />; })}
                  {dayTasks.length > 3 && <span className="text-[9px]" style={{ color: C.inkSoft }}>+{dayTasks.length - 3}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div>
          <div className="text-sm font-semibold mb-2 capitalize" style={{ color: C.ink }}>{selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</div>
          {(byDate[selectedDate.toDateString()] || []).length === 0 ? <EmptyState /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sortByPriority(byDate[selectedDate.toDateString()] || []).map((t) => <TaskCard key={t.id} task={t} {...cardHandlers} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineView({ tasks, filters, setFilters, activeQuadrant, ...cardHandlers }) {
  const filtered = useMemo(() => applyFilters(tasks, filters, activeQuadrant), [tasks, filters, activeQuadrant]);
  const withDate = filtered.filter((t) => t.dueAt).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  const withoutDate = filtered.filter((t) => !t.dueAt);
  const groups = [];
  withDate.forEach((t) => {
    const key = new Date(t.dueAt).toDateString();
    const g = groups.find((g) => g.key === key);
    if (g) g.tasks.push(t); else groups.push({ key, date: new Date(t.dueAt), tasks: [t] });
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}><FilterBar filters={filters} setFilters={setFilters} /></div>

      {withoutDate.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: C.surfaceSunk }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.inkSoft }}>Sem prazo definido</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">{withoutDate.map((t) => <TaskCard key={t.id} task={t} {...cardHandlers} />)}</div>
        </div>
      )}

      {groups.length === 0 ? (withoutDate.length === 0 && <EmptyState />) : (
        <div className="relative pl-6">
          <div className="absolute left-[7px] top-1 bottom-1 w-0.5" style={{ background: C.border }} />
          {groups.map((g) => {
            const overdueDay = g.date.getTime() < new Date().setHours(0, 0, 0, 0);
            return (
              <div key={g.key} className="relative mb-6">
                <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full border-2" style={{ background: overdueDay ? C.danger : C.primary, borderColor: C.surface }} />
                <div className="text-sm font-bold mb-2 capitalize" style={{ color: overdueDay ? C.danger : C.ink }}>{g.date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">{sortByPriority(g.tasks).map((t) => <TaskCard key={t.id} task={t} {...cardHandlers} />)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BackupView({ tasks, onImport }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState("");

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ app: "Vivaro", version: 2, exportedAt: new Date().toISOString(), tasks }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vivaro-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    setMsg("Backup exportado com sucesso.");
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const imported = Array.isArray(data) ? data : data.tasks;
        if (!Array.isArray(imported)) throw new Error("formato inválido");
        onImport(imported);
        setMsg(`${imported.length} tarefas importadas com sucesso.`);
      } catch (err) {
        setMsg("Não foi possível ler o arquivo de backup. Verifique o formato.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-1"><Download size={18} color={C.primary} /><h3 className="font-bold" style={{ color: C.ink }}>Exportar backup</h3></div>
        <p className="text-sm mb-3" style={{ color: C.inkSoft }}>Gere um arquivo .json com todas as suas tarefas, prazos, lembretes, subtarefas, comentários e anexos. Guarde-o em local seguro.</p>
        <button onClick={exportBackup} className="px-4 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: C.primary }}>Exportar tarefas ({tasks.length})</button>
      </div>
      <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-1"><Upload size={18} color={C.accent} /><h3 className="font-bold" style={{ color: C.ink }}>Restaurar backup</h3></div>
        <p className="text-sm mb-3" style={{ color: C.inkSoft }}>Importe um arquivo .json exportado anteriormente. As tarefas importadas serão adicionadas às atuais.</p>
        <button onClick={() => fileRef.current?.click()} className="px-4 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: C.border, color: C.ink }}>Selecionar arquivo de backup</button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
      </div>
      {msg && <div className="text-sm font-medium px-4 py-3 rounded-xl" style={{ background: C.primarySoft, color: C.primaryDark }}>{msg}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  App                                                                 */
/* ------------------------------------------------------------------ */
export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("dashboard");
  const [modalTask, setModalTask] = useState(undefined);
  const [voicePrefill, setVoicePrefill] = useState(null);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark") return saved;
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    } catch (e) { /* ignore */ }
    return "light";
  });
  const [activeQuadrant, setActiveQuadrant] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [noteViewer, setNoteViewer] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installVariant, setInstallVariant] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [notifPermission, setNotifPermission] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
  const [showNotifBanner, setShowNotifBanner] = useState(true);
  const [toasts, setToasts] = useState([]);
  const firedRemindersRef = useRef(new Set());
  const [filters, setFilters] = useState({ category: "todas", statuses: [], overdueOnly: false, onTimeOnly: false, hideDone: true });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTasks(JSON.parse(raw).map(normalizeTask));
    } catch (e) { /* no data yet */ }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch (e) { /* storage full/unavailable */ }
  }, [tasks, loaded]);

  useEffect(() => {
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (e) { /* ignore */ }
    document.documentElement.style.colorScheme = theme;
    document.documentElement.style.background = theme === "dark" ? DARK_PALETTE.bg : LIGHT_PALETTE.bg;
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  // PWA install: Android/Chrome fires `beforeinstallprompt`; iOS Safari never does,
  // so we detect iOS separately and show manual "Adicionar à Tela de Início" instructions.
  useEffect(() => {
    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;
    if (isStandalone) { setInstallVariant(null); return; }
    try { if (localStorage.getItem("vivaro:installDismissed") === "1") { setShowInstallBanner(false); return; } } catch (e) { /* ignore */ }

    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIOS) { setInstallVariant("ios"); return; }

    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setInstallVariant("android"); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setInstallVariant(null);
  }, [installPrompt]);

  const dismissInstallBanner = useCallback(() => {
    setShowInstallBanner(false);
    try { localStorage.setItem("vivaro:installDismissed", "1"); } catch (e) { /* ignore */ }
  }, []);

  // Load already-fired reminders so we don't repeat notifications after a reload
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FIRED_REMINDERS_KEY);
      if (raw) firedRemindersRef.current = new Set(JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }, []);

  const requestNotifPermission = useCallback(() => {
    if (typeof Notification === "undefined") { setNotifPermission("unsupported"); return; }
    Notification.requestPermission().then((perm) => setNotifPermission(perm));
  }, []);

  const dismissToast = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  // Background reminder check: runs every 20s while the app tab is open.
  // NOTE: because Vivaro is a static site (no server / push service), reminders
  // only fire while this tab/PWA is open or was recently active in the background —
  // closing it fully stops delivery. Installing Vivaro on the phone's home screen
  // (see the "Instalar app" banner) makes this behave much more like a real app.
  const fireNotification = useCallback((title, options) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    // Prefer firing through the installed service worker: on Android this is what
    // makes the alert show up as a proper system notification even when the PWA
    // is only running in the background, rather than in the foreground tab.
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then((reg) => {
          if (reg && reg.showNotification) reg.showNotification(title, options);
          else new Notification(title, options);
        })
        .catch(() => { try { new Notification(title, options); } catch (e) { /* ignore */ } });
    } else {
      try { new Notification(title, options); } catch (e) { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const checkReminders = () => {
      const now = Date.now();
      let changed = false;
      tasks.forEach((task) => {
        if (!task.dueAt || task.status === "concluido" || task.status === "cancelado") return;
        const dueMs = new Date(task.dueAt).getTime();
        (task.reminders || []).forEach((r) => {
          const key = `${task.id}:${r.id}`;
          if (firedRemindersRef.current.has(key)) return;
          const offsetMs = (r.value || 0) * (REMINDER_MS[r.unit] || REMINDER_MS.hours);
          const remindAt = dueMs - offsetMs;
          // Fire once the reminder time has passed, with a 2h grace window after
          // the due date in case the app was closed when the reminder was due.
          if (now >= remindAt && now <= dueMs + 2 * 60 * 60 * 1000) {
            firedRemindersRef.current.add(key);
            changed = true;
            setToasts((prev) => [...prev, { id: uid(), task }]);
            fireNotification(`Lembrete: ${task.title}`, {
              body: `Prazo ${fmtDate(task.dueAt)}${fmtTime(task.dueAt) ? ` · ${fmtTime(task.dueAt)}` : ""}`.trim(),
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: key,
              vibrate: [200, 100, 200],
            });
          }
        });
      });
      if (changed) {
        try { localStorage.setItem(FIRED_REMINDERS_KEY, JSON.stringify([...firedRemindersRef.current])); } catch (e) { /* ignore */ }
      }
    };
    checkReminders();
    const interval = setInterval(checkReminders, 20000);
    return () => clearInterval(interval);
  }, [tasks, loaded, fireNotification]);

  const saveTask = useCallback((task) => {
    setTasks((prev) => {
      const existing = prev.find((t) => t.id === task.id);
      const wasCompleted = existing?.status === "concluido";
      const nowCompleted = task.status === "concluido";
      let list = existing ? prev.map((t) => (t.id === task.id ? task : t)) : [task, ...prev];
      if (nowCompleted && !wasCompleted && task.recurrence) {
        const nextDue = computeNextOccurrence(task);
        if (nextDue) {
          list = [{ ...task, id: uid(), status: "pendente", dueAt: nextDue, completedAt: null, subtasks: (task.subtasks || []).map((s) => ({ ...s, done: false })), comments: [], createdAt: new Date().toISOString() }, ...list];
        }
      }
      return list;
    });
    setModalTask(undefined);
    setVoicePrefill(null);
  }, []);

  const deleteTask = useCallback((id) => setTasks((prev) => prev.filter((t) => t.id !== id)), []);

  const changeStatus = useCallback((id, status) => {
    setTasks((prev) => {
      let spawn = null;
      const list = prev.map((t) => {
        if (t.id !== id) return t;
        const wasCompleted = t.status === "concluido";
        const updated = { ...t, status, completedAt: status === "concluido" ? new Date().toISOString() : (status === t.status ? t.completedAt : null) };
        if (status === "concluido" && !wasCompleted && t.recurrence) {
          const nextDue = computeNextOccurrence(updated);
          if (nextDue) spawn = { ...t, id: uid(), status: "pendente", dueAt: nextDue, completedAt: null, subtasks: (t.subtasks || []).map((s) => ({ ...s, done: false })), comments: [], createdAt: new Date().toISOString() };
        }
        return updated;
      });
      return spawn ? [spawn, ...list] : list;
    });
  }, []);

  const exportGCal = useCallback((task) => window.open(googleCalendarUrl(task), "_blank"), []);

  const importTasks = useCallback((imported) => {
    setTasks((prev) => [...imported.map((t) => normalizeTask({ ...t, id: uid() })), ...prev]);
  }, []);

  const openAttachment = useCallback((att) => {
    if (att.kind === "image") { setLightbox(att.dataUrl); return; }
    if (att.kind === "file") { window.open(att.dataUrl, "_blank"); return; }
    if (att.kind === "link") { window.open(/^https?:\/\//i.test(att.url) ? att.url : `https://${att.url}`, "_blank"); return; }
    if (att.kind === "note") { setNoteViewer(att); return; }
    if (att.kind === "location") {
      const q = att.lat && att.lng ? `${att.lat},${att.lng}` : encodeURIComponent(att.address || "");
      window.open(`https://www.google.com/maps?q=${q}`, "_blank");
    }
  }, []);

  const handleVoiceResult = useCallback((transcript) => {
    const parsed = parseVoiceText(transcript);
    setVoicePrefill(parsed);
    setModalTask(null);
  }, []);

  const cardHandlers = { onEdit: setModalTask, onDelete: deleteTask, onStatusChange: changeStatus, onExport: exportGCal, onOpenAttachment: openAttachment };

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "kanban", label: "Kanban", icon: Columns3 },
    { id: "lista", label: "Lista", icon: ListIcon },
    { id: "calendario", label: "Calendário", icon: CalendarIcon },
    { id: "timeline", label: "Timeline", icon: Milestone },
    { id: "backup", label: "Backup", icon: DatabaseBackup },
  ];

  return (
    <div className="min-h-screen w-full" style={{ ...cssVarsFor(theme), background: C.bg, color: C.ink, fontFamily: "'Inter', sans-serif", colorScheme: theme }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 8px; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>

      <div className="sticky top-0 z-30" style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png" alt="Vivaro" title="Sobre o Vivaro" onClick={() => setShowAbout(true)}
              className="w-9 h-9 rounded-xl object-contain cursor-pointer" style={{ background: C.surfaceSunk }}
            />
            <span className="font-bold text-lg" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Vivaro</span>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>

          <div className="hidden md:flex items-center gap-1 rounded-xl p-1 overflow-x-auto" style={{ background: C.surfaceSunk }}>
            {NAV.map((n) => (
              <button key={n.id} onClick={() => setView(n.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
                style={{ background: view === n.id ? C.surface : "transparent", color: view === n.id ? C.primary : C.inkSoft, boxShadow: view === n.id ? "0 1px 2px rgba(0,0,0,0.06)" : "none" }}>
                <n.icon size={15} /> {n.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowAIChat(true)} title="Perguntar sobre tarefas" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm" style={{ background: C.surfaceSunk, color: C.ink }}>
              <Bot size={16} /> <span className="hidden sm:inline">IA</span>
            </button>
            <VoiceCaptureButton onResult={handleVoiceResult} />
            <button onClick={() => setModalTask(null)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-sm text-white" style={{ background: C.accent }}>
              <Plus size={16} /> <span className="hidden sm:inline">Nova tarefa</span>
            </button>
          </div>
        </div>
        <div className="md:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setView(n.id)} className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
              style={{ background: view === n.id ? C.primarySoft : C.surfaceSunk, color: view === n.id ? C.primary : C.inkSoft }}>
              <n.icon size={14} /> {n.label}
            </button>
          ))}
        </div>
      </div>

      <InstallBanner
        variant={showInstallBanner ? installVariant : null}
        onInstall={handleInstall}
        onDismiss={dismissInstallBanner}
      />

      <NotificationBanner
        permission={showNotifBanner ? notifPermission : "granted"}
        onEnable={requestNotifPermission}
        onDismiss={() => setShowNotifBanner(false)}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        {view === "dashboard" && <DashboardView tasks={tasks} filters={filters} setFilters={setFilters} activeQuadrant={activeQuadrant} setActiveQuadrant={setActiveQuadrant} {...cardHandlers} />}
        {view === "kanban" && <KanbanView tasks={tasks} filters={filters} setFilters={setFilters} activeQuadrant={activeQuadrant} setActiveQuadrant={setActiveQuadrant} {...cardHandlers} />}
        {view === "lista" && <ListView tasks={tasks} filters={filters} setFilters={setFilters} activeQuadrant={activeQuadrant} setActiveQuadrant={setActiveQuadrant} {...cardHandlers} />}
        {view === "calendario" && <CalendarView tasks={tasks} filters={filters} setFilters={setFilters} activeQuadrant={activeQuadrant} setActiveQuadrant={setActiveQuadrant} {...cardHandlers} />}
        {view === "timeline" && <TimelineView tasks={tasks} filters={filters} setFilters={setFilters} activeQuadrant={activeQuadrant} setActiveQuadrant={setActiveQuadrant} {...cardHandlers} />}
        {view === "backup" && <BackupView tasks={tasks} onImport={importTasks} />}
      </div>

      {modalTask !== undefined && (
        <TaskModal initial={modalTask} voicePrefill={voicePrefill} onSave={saveTask} onClose={() => { setModalTask(undefined); setVoicePrefill(null); }} onOpenAttachment={openAttachment} />
      )}
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      {noteViewer && <NoteViewer note={noteViewer} onClose={() => setNoteViewer(null)} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showAIChat && <AIChatModal tasks={tasks} onClose={() => setShowAIChat(false)} />}
      <ReminderToasts toasts={toasts} onDismiss={dismissToast} onExport={exportGCal} />
    </div>
  );
}
