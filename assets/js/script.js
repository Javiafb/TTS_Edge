(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const synth = window.speechSynthesis;

  // Header
  const themeToggle = $("#theme-toggle");
  const openNavBtn = $("#btn-open-nav");
  const sidebar = $("#sidebar");
  const globalSearch = $("#global-search");
  const clearGlobal = $("#clear-global");

  // Sidebar acciones rápidas
  const quickPlay = $("#quick-play");
  const quickStop = $("#quick-stop");

  // Voces
  const voicesCount = $("#voices-count");
  const voicesList = $("#voices-list");
  const localeSelect = $("#locale");
  const clearFiltersBtn = $("#clear-filters");
  const onlyFavsChk = $("#only-favs");

  // Texto/controles
  const selectedVoiceLabel = $("#selected-voice-label");
  const textArea = $("#text");
  const charCounter = $("#char-counter");
  const btnSpeak = $("#btn-speak");
  const btnPause = $("#btn-pause");
  const btnResume = $("#btn-resume");
  const btnStop = $("#btn-stop");
  const btnSample = $("#btn-sample");
  const btnClear = $("#btn-clear");
  const btnScrollVoices = $("#btn-scroll-voices");
  const rate = $("#rate"), rateVal = $("#rate-val");
  const pitch = $("#pitch"), pitchVal = $("#pitch-val");
  const volume = $("#volume"), volumeVal = $("#volume-val");
  const statusEl = $("#status");

  // State
  let allVoices = [];
  let filteredVoices = [];
  let selectedVoice = null;
  let favorites = new Set(JSON.parse(localStorage.getItem("tts_favorites") || "[]"));

  // Theme
  (function initTheme() {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    themeToggle.textContent = isDark ? "☀️" : "🌙";
    themeToggle.addEventListener("click", () => {
      const nowDark = root.classList.toggle("dark");
      localStorage.setItem("theme", nowDark ? "dark" : "light");
      themeToggle.textContent = nowDark ? "☀️" : "🌙";
    });
  })();

  // Mobile sidebar mejorado
  const btnCloseNav = $("#btn-close-nav");
  const sidebarOverlay = $("#sidebar-overlay");

  function openSidebar() {
    sidebar.classList.remove("-translate-x-full");
    sidebarOverlay.classList.remove("opacity-0", "pointer-events-none");
    sidebarOverlay.classList.add("opacity-100");
    document.body.classList.add("overflow-hidden", "lg:overflow-auto");
  }

  function closeSidebar() {
    sidebar.classList.add("-translate-x-full");
    sidebarOverlay.classList.add("opacity-0", "pointer-events-none");
    sidebarOverlay.classList.remove("opacity-100");
    document.body.classList.remove("overflow-hidden");
  }

  openNavBtn?.addEventListener("click", openSidebar);
  btnCloseNav?.addEventListener("click", closeSidebar);
  sidebarOverlay?.addEventListener("click", closeSidebar);

  // Cerrar sidebar al hacer clic en navegación en móvil
  $$("button[data-target]").forEach((b) => {
    b.addEventListener("click", () => {
      const target = document.querySelector(b.dataset.target);
      if (target) {
        // Cerrar sidebar en móvil
        if (window.innerWidth < 1024) {
          closeSidebar();
        }
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // Cerrar sidebar automáticamente en desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1024) {
      closeSidebar();
    }
  });

  // Sidebar quick actions
  quickPlay.addEventListener("click", speak);
  quickStop.addEventListener("click", stop);

  // Persistencia
  function savePrefs() {
    try {
      localStorage.setItem("tts_text", textArea.value);
      localStorage.setItem("tts_rate", rate.value);
      localStorage.setItem("tts_pitch", pitch.value);
      localStorage.setItem("tts_volume", volume.value);
      localStorage.setItem("tts_voice_name", selectedVoice?.name || "");
      localStorage.setItem("tts_favorites", JSON.stringify(Array.from(favorites)));
    } catch {}
  }
  function loadPrefs() {
    textArea.value = localStorage.getItem("tts_text") || "";
    rate.value = localStorage.getItem("tts_rate") || "1";
    pitch.value = localStorage.getItem("tts_pitch") || "1";
    volume.value = localStorage.getItem("tts_volume") || "1";
    rateVal.textContent = Number(rate.value).toFixed(1) + "x";
    pitchVal.textContent = Number(pitch.value).toFixed(1);
    volumeVal.textContent = Number(volume.value).toFixed(2);
    updateCounter();
  }

  // UI helpers
  function setStatus(msg, err = false) {
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("text-red-600", !!err);
  }
  function updateTransportButtons() {
    const speaking = synth?.speaking;
    const paused = synth?.paused;
    btnPause.disabled = !speaking || paused;
    btnResume.disabled = !speaking || !paused;
    btnStop.disabled = !speaking;
  }
  function updateCounter() {
    charCounter.textContent = `${(textArea.value || "").length} caracteres`;
  }
  function updateSelectedLabel() {
    selectedVoiceLabel.textContent = selectedVoice ? `${selectedVoice.name} — ${selectedVoice.lang}` : "—";
  }

  // Voces
  function populateVoices(prefer) {
    const list = synth?.getVoices?.() || [];
    let ms = list.filter((v) => /microsoft/i.test(v.name));
    if (!ms.length) ms = list;
    ms.sort((a, b) => (a.lang || "").localeCompare(b.lang || "") || a.name.localeCompare(b.name));
    allVoices = ms;

    // Idiomas
    const langs = Array.from(new Set(ms.map((v) => v.lang))).sort();
    localeSelect.innerHTML = `<option value="all">Todos los idiomas</option>` + langs.map((l) => `<option value="${l}">${l}</option>`).join("");

    // Selección inicial
    let voice = null;
    if (prefer) voice = ms.find((v) => v.name === prefer) || null;
    if (!voice) voice = ms.find((v) => /^es(-|_)/i.test(v.lang) || /Spanish/i.test(v.name)) || ms[0] || null;
    selectVoice(voice);

    voicesCount.textContent = `${ms.length} voces${list.some((v) => /microsoft/i.test(v.name)) ? " (Microsoft)" : ""}`;
    applyFilters();
  }

  function applyFilters() {
    const q = (globalSearch.value || "").toLowerCase().trim();
    const loc = localeSelect.value;
    const onlyFavs = onlyFavsChk.checked;

    clearGlobal.classList.toggle("hidden", !q.length);

    filteredVoices = allVoices.filter((v) => {
      if (loc !== "all" && v.lang !== loc) return false;
      if (onlyFavs && !favorites.has(v.name)) return false;
      if (q) {
        const hay = `${v.name} ${v.lang}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    renderVoiceList();
  }

  function renderVoiceList() {
    voicesList.innerHTML = "";
    if (!filteredVoices.length) {
      voicesList.innerHTML = `<div class="p-4 text-xs text-slate-500 dark:text-slate-400">No hay voces para los filtros actuales.</div>`;
      return;
    }

    for (const v of filteredVoices) {
      const row = document.createElement("div");
      row.className = "grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-slate-200 px-3 py-2 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60";
      row.role = "option";
      row.tabIndex = 0;

      const main = document.createElement("div");
      main.className = "min-w-0";
      main.innerHTML = `
        <div class="truncate text-sm font-semibold">${v.name}</div>
        <div class="truncate text-xs text-slate-500 dark:text-slate-400">${v.lang}</div>
      `;

      const selectBtn = document.createElement("button");
      selectBtn.className = "rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800";
      selectBtn.textContent = "Seleccionar";
      selectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        selectVoice(v);
        setStatus(`Voz seleccionada: ${v.name}`);
        renderVoiceList();
      });

      const favBtn = document.createElement("button");
      favBtn.className = "rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800";
      const isFav = favorites.has(v.name);
      favBtn.textContent = isFav ? "⭐" : "☆";
      favBtn.title = isFav ? "Quitar de favoritos" : "Agregar a favoritos";
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (favorites.has(v.name)) favorites.delete(v.name);
        else favorites.add(v.name);
        savePrefs();
        applyFilters();
      });

      const testBtn = document.createElement("button");
      testBtn.className = "rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800";
      testBtn.textContent = "Probar";
      testBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        testVoice(v);
      });

      row.addEventListener("click", () => {
        selectVoice(v);
        setStatus(`Voz seleccionada: ${v.name}`);
        renderVoiceList();
      });
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); row.click(); }
      });

      row.append(main, selectBtn, favBtn, testBtn);
      voicesList.appendChild(row);
    }
  }

  function selectVoice(v) {
    selectedVoice = v || null;
    updateSelectedLabel();
    savePrefs();
  }

  function testVoice(voice) {
    if (!voice) return;
    try {
      if (synth.speaking) synth.cancel();
      const utt = new SpeechSynthesisUtterance("Esto es una prueba de voz.");
      utt.voice = voice;
      utt.rate = Number(rate.value);
      utt.pitch = Number(pitch.value);
      utt.volume = Number(volume.value);
      synth.speak(utt);
    } catch (e) { console.error(e); }
  }

  // Reproducción
  function speak() {
    const t = (textArea.value || "").trim();
    if (!t) return setStatus("Escribe algún texto para reproducir.", true);
    if (!selectedVoice) return setStatus("Selecciona una voz.", true);

    if (synth.speaking) synth.cancel();
    const utt = new SpeechSynthesisUtterance(t);
    utt.voice = selectedVoice;
    utt.rate = Number(rate.value);
    utt.pitch = Number(pitch.value);
    utt.volume = Number(volume.value);

    utt.onstart = () => { setStatus(`Reproduciendo con "${selectedVoice.name}" (${selectedVoice.lang})…`); updateTransportButtons(); };
    utt.onend   = () => { setStatus("Finalizado."); updateTransportButtons(); };
    utt.onerror = (e) => { console.error(e); setStatus("Error durante la reproducción.", true); updateTransportButtons(); };

    synth.speak(utt);
    updateTransportButtons();
    savePrefs();
  }
  const pause = () => { if (synth.speaking && !synth.paused) { synth.pause(); setStatus("Pausado."); updateTransportButtons(); } };
  const resume = () => { if (synth.paused) { synth.resume(); setStatus("Reanudado."); updateTransportButtons(); } };
  function stop() { if (synth.speaking) { synth.cancel(); setStatus("Detenido."); updateTransportButtons(); } }

  // Eventos
  globalSearch.addEventListener("input", applyFilters);
  clearGlobal.addEventListener("click", () => { globalSearch.value = ""; applyFilters(); });
  localeSelect.addEventListener("change", applyFilters);
  onlyFavsChk.addEventListener("change", applyFilters);
  clearFiltersBtn.addEventListener("click", () => { globalSearch.value = ""; localeSelect.value = "all"; onlyFavsChk.checked = false; applyFilters(); });

  btnSpeak.addEventListener("click", speak);
  btnPause.addEventListener("click", pause);
  btnResume.addEventListener("click", resume);
  btnStop.addEventListener("click", stop);

  btnSample.addEventListener("click", () => {
    textArea.value = "Hola, esta es una demostración de texto a voz con voces del navegador en Microsoft Edge.";
    updateCounter(); setStatus("Ejemplo cargado.");
  });
  btnClear.addEventListener("click", () => { textArea.value = ""; updateCounter(); setStatus("Texto limpiado."); });
  btnScrollVoices.addEventListener("click", () => document.querySelector("#panel-voces").scrollIntoView({ behavior: "smooth", block: "start" }));

  textArea.addEventListener("input", () => { updateCounter(); savePrefs(); });
  rate.addEventListener("input", () => { rateVal.textContent = Number(rate.value).toFixed(1) + "x"; savePrefs(); });
  pitch.addEventListener("input", () => { pitchVal.textContent = Number(pitch.value).toFixed(1); savePrefs(); });
  volume.addEventListener("input", () => { volumeVal.textContent = Number(volume.value).toFixed(2); savePrefs(); });

  $$("button[data-target]").forEach((b) => b.addEventListener("click", () => document.querySelector(b.dataset.target)?.scrollIntoView({ behavior: "smooth", block: "start" })));

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); speak(); }
    else if (e.key === " " && (synth?.speaking || synth?.paused)) { e.preventDefault(); synth.paused ? resume() : pause(); }
    else if (e.key === "Escape") { stop(); }
  });

  // Init
  function initVoices() {
    const pref = localStorage.getItem("tts_voice_name") || undefined;
    populateVoices(pref);
  }

  (function init() {
    clearGlobal.classList.toggle("hidden", !(globalSearch.value || "").length);
    loadPrefs();
    updateTransportButtons();

    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.getVoices();
      speechSynthesis.onvoiceschanged = initVoices;
      setTimeout(() => { if (!allVoices.length) initVoices(); }, 600);
    } else {
      setStatus("Tu navegador no soporta Web Speech API. Usa Microsoft Edge.", true);
    }
    setInterval(updateTransportButtons, 250);
  })();
})();