;(() => {
  const $ = (s) => document.querySelector(s)
  const $$ = (s) => Array.from(document.querySelectorAll(s))
  const synth = window.speechSynthesis

  // Header
  const themeToggle = $("#theme-toggle")
  const openNavBtn = $("#btn-open-nav")
  const sidebar = $("#sidebar")
  const globalSearch = $("#global-search")
  const clearGlobal = $("#clear-global")
  const mobileSearch = $("#mobile-search")
  const clearMobile = $("#clear-mobile")
  const sidebarBackdrop = $("#sidebar-backdrop")
  const closeNavBtn = $("#btn-close-nav")

  // Voces
  const voicesCount = $("#voices-count")
  const voicesList = $("#voices-list")
  const localeSelect = $("#locale")
  const clearFiltersBtn = $("#clear-filters")
  const onlyFavsChk = $("#only-favs")

  // Texto/controles
  const selectedVoiceLabel = $("#selected-voice-label")
  const textArea = $("#text")
  const charCounter = $("#char-counter")
  const btnSpeak = $("#btn-speak")
  const btnPause = $("#btn-pause")
  const btnResume = $("#btn-resume")
  const btnStop = $("#btn-stop")
  const btnSample = $("#btn-sample")
  const btnClear = $("#btn-clear")
  const btnScrollVoices = $("#btn-scroll-voices")
  const rate = $("#rate"),
    rateVal = $("#rate-val")
  const pitch = $("#pitch"),
    pitchVal = $("#pitch-val")
  const volume = $("#volume"),
    volumeVal = $("#volume-val")
  const statusEl = $("#status")
  const quickPlay = $("#quick-play")
  const quickStop = $("#quick-stop")

  // State
  let allVoices = []
  let filteredVoices = []
  let selectedVoice = null
  const favorites = new Set(JSON.parse(localStorage.getItem("tts_favorites") || "[]"))
  ;(function initTheme() {
    const root = document.documentElement
    const isDark = root.classList.contains("dark")
    themeToggle.textContent = isDark ? "☀️" : "🌙"
    themeToggle.addEventListener("click", () => {
      const nowDark = root.classList.toggle("dark")
      localStorage.setItem("theme", nowDark ? "dark" : "light")
      themeToggle.textContent = nowDark ? "☀️" : "🌙"
    })
  })()

  function showSidebar() {
    if (sidebar && sidebarBackdrop) {
      sidebar.classList.remove("-translate-x-full")
      sidebar.classList.add("translate-x-0")
      sidebarBackdrop.classList.remove("hidden")
    }
  }

  function hideSidebar() {
    if (sidebar && sidebarBackdrop) {
      sidebar.classList.remove("translate-x-0")
      sidebar.classList.add("-translate-x-full")
      sidebarBackdrop.classList.add("hidden")
    }
  }

  openNavBtn?.addEventListener("click", showSidebar)
  closeNavBtn?.addEventListener("click", hideSidebar)
  sidebarBackdrop?.addEventListener("click", hideSidebar)

  function syncSearchInputs() {
    if (globalSearch && mobileSearch) {
      globalSearch.addEventListener("input", () => {
        mobileSearch.value = globalSearch.value
        applyFilters()
      })

      mobileSearch.addEventListener("input", () => {
        globalSearch.value = mobileSearch.value
        applyFilters()
      })
    }
  }

  // Persistencia
  function savePrefs() {
    try {
      localStorage.setItem("tts_text", textArea.value)
      localStorage.setItem("tts_rate", rate.value)
      localStorage.setItem("tts_pitch", pitch.value)
      localStorage.setItem("tts_volume", volume.value)
      localStorage.setItem("tts_voice_name", selectedVoice?.name || "")
      localStorage.setItem("tts_favorites", JSON.stringify(Array.from(favorites)))
    } catch {}
  }

  function loadPrefs() {
    textArea.value = localStorage.getItem("tts_text") || ""
    rate.value = localStorage.getItem("tts_rate") || "1"
    pitch.value = localStorage.getItem("tts_pitch") || "1"
    volume.value = localStorage.getItem("tts_volume") || "1"
    rateVal.textContent = Number(rate.value).toFixed(1) + "x"
    pitchVal.textContent = Number(pitch.value).toFixed(1)
    volumeVal.textContent = Number(volume.value).toFixed(2)
    updateCounter()
  }

  // UI helpers
  function setStatus(msg, err = false) {
    statusEl.textContent = msg || ""
    statusEl.classList.toggle("text-red-600", !!err)
  }

  function updateTransportButtons() {
    const speaking = synth?.speaking
    const paused = synth?.paused
    btnPause.disabled = !speaking || paused
    btnResume.disabled = !speaking || !paused
    btnStop.disabled = !speaking
  }

  function updateCounter() {
    charCounter.textContent = `${(textArea.value || "").length} caracteres`
  }

  function updateSelectedLabel() {
    selectedVoiceLabel.textContent = selectedVoice ? `${selectedVoice.name} — ${selectedVoice.lang}` : "—"
  }

  // Voces
  function populateVoices(prefer) {
    console.log("🔄 Intentando cargar voces...")

    const list = synth?.getVoices?.() || []
    console.log(`📋 Voces encontradas: ${list.length}`)

    if (list.length === 0) {
      console.warn("⚠️ No se encontraron voces. Reintentando...")
      setStatus("Cargando voces...", false)
      return
    }

    let ms = list.filter((v) => /microsoft/i.test(v.name))
    if (!ms.length) {
      console.log("🔄 No se encontraron voces Microsoft, usando todas las disponibles")
      ms = list
    }

    ms.sort((a, b) => (a.lang || "").localeCompare(b.lang || "") || a.name.localeCompare(b.name))
    allVoices = ms
    console.log(`✅ Voces procesadas: ${ms.length}`)

    // Idiomas
    const langs = Array.from(new Set(ms.map((v) => v.lang))).sort()
    if (localeSelect) {
      localeSelect.innerHTML =
        `<option value="all">Todos los idiomas</option>` +
        langs.map((l) => `<option value="${l}">${l}</option>`).join("")
    }

    // Selección inicial
    let voice = null
    if (prefer) voice = ms.find((v) => v.name === prefer) || null
    if (!voice) voice = ms.find((v) => /^es(-|_)/i.test(v.lang) || /Spanish/i.test(v.name)) || ms[0] || null
    selectVoice(voice)

    if (voicesCount) {
      voicesCount.textContent = `${ms.length} voces${list.some((v) => /microsoft/i.test(v.name)) ? " (Microsoft)" : ""}`
    }

    setStatus(`${ms.length} voces cargadas correctamente.`, false)
    applyFilters()
  }

  function applyFilters() {
    const desktopQuery = (globalSearch?.value || "").toLowerCase().trim()
    const mobileQuery = (mobileSearch?.value || "").toLowerCase().trim()
    const q = desktopQuery || mobileQuery
    const loc = localeSelect.value
    const onlyFavs = onlyFavsChk.checked

    clearGlobal?.classList.toggle("hidden", !desktopQuery.length)
    clearMobile?.classList.toggle("hidden", !mobileQuery.length)

    filteredVoices = allVoices.filter((v) => {
      if (loc !== "all" && v.lang !== loc) return false
      if (onlyFavs && !favorites.has(v.name)) return false
      if (q) {
        const hay = `${v.name} ${v.lang}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    renderVoiceList()
  }

  function renderVoiceList() {
    voicesList.innerHTML = ""
    if (!filteredVoices.length) {
      voicesList.innerHTML = `<div class="p-4 text-xs text-slate-500 dark:text-slate-400">No hay voces para los filtros actuales.</div>`
      return
    }

    for (const v of filteredVoices) {
      const row = document.createElement("div")
      row.className =
        "grid grid-cols-[1fr_auto] gap-2 border-b border-slate-200 px-3 py-2 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 sm:grid-cols-[1fr_auto_auto_auto]"
      row.role = "option"
      row.tabIndex = 0

      const main = document.createElement("div")
      main.className = "min-w-0"
      main.innerHTML = `
        <div class="truncate text-sm font-semibold">${v.name}</div>
        <div class="truncate text-xs text-slate-500 dark:text-slate-400">${v.lang}</div>
      `

      const buttonsContainer = document.createElement("div")
      buttonsContainer.className = "flex gap-1 sm:contents"

      const selectBtn = document.createElement("button")
      selectBtn.className =
        "rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      selectBtn.textContent = "Seleccionar"
      selectBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        selectVoice(v)
        setStatus(`Voz seleccionada: ${v.name}`)
        renderVoiceList()
      })

      const favBtn = document.createElement("button")
      favBtn.className =
        "rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      const isFav = favorites.has(v.name)
      favBtn.textContent = isFav ? "⭐" : "☆"
      favBtn.title = isFav ? "Quitar de favoritos" : "Agregar a favoritos"
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        if (favorites.has(v.name)) favorites.delete(v.name)
        else favorites.add(v.name)
        savePrefs()
        applyFilters()
      })

      const testBtn = document.createElement("button")
      testBtn.className =
        "rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      testBtn.textContent = "Probar"
      testBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        testVoice(v)
      })

      row.addEventListener("click", () => {
        selectVoice(v)
        setStatus(`Voz seleccionada: ${v.name}`)
        renderVoiceList()
      })

      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          row.click()
        }
      })

      buttonsContainer.append(selectBtn, favBtn, testBtn)
      row.append(main, buttonsContainer)
      voicesList.appendChild(row)
    }
  }

  function selectVoice(v) {
    selectedVoice = v || null
    updateSelectedLabel()
    savePrefs()
  }

  function testVoice(voice) {
    if (!voice) return
    try {
      if (synth.speaking) synth.cancel()
      const utt = new SpeechSynthesisUtterance("Esto es una prueba de voz.")
      utt.voice = voice
      utt.rate = Number(rate.value)
      utt.pitch = Number(pitch.value)
      utt.volume = Number(volume.value)
      synth.speak(utt)
    } catch (e) {
      console.error(e)
    }
  }

  // Reproducción
  function speak() {
    const t = (textArea.value || "").trim()
    if (!t) return setStatus("Escribe algún texto para reproducir.", true)
    if (!selectedVoice) return setStatus("Selecciona una voz.", true)

    if (synth.speaking) synth.cancel()
    const utt = new SpeechSynthesisUtterance(t)
    utt.voice = selectedVoice
    utt.rate = Number(rate.value)
    utt.pitch = Number(pitch.value)
    utt.volume = Number(volume.value)

    utt.onstart = () => {
      setStatus(`Reproduciendo con "${selectedVoice.name}" (${selectedVoice.lang})…`)
      updateTransportButtons()
    }
    utt.onend = () => {
      setStatus("Finalizado.")
      updateTransportButtons()
    }
    utt.onerror = (e) => {
      console.error(e)
      setStatus("Error durante la reproducción.", true)
      updateTransportButtons()
    }

    synth.speak(utt)
    updateTransportButtons()
    savePrefs()
  }

  const pause = () => {
    if (synth.speaking && !synth.paused) {
      synth.pause()
      setStatus("Pausado.")
      updateTransportButtons()
    }
  }

  const resume = () => {
    if (synth.paused) {
      synth.resume()
      setStatus("Reanudado.")
      updateTransportButtons()
    }
  }

  const stop = () => {
    if (synth.speaking) {
      synth.cancel()
      setStatus("Detenido.")
      updateTransportButtons()
    }
  }

  // Event listeners
  globalSearch?.addEventListener("input", applyFilters)
  clearGlobal?.addEventListener("click", () => {
    if (globalSearch) globalSearch.value = ""
    if (mobileSearch) mobileSearch.value = ""
    applyFilters()
  })

  clearMobile?.addEventListener("click", () => {
    if (mobileSearch) mobileSearch.value = ""
    if (globalSearch) globalSearch.value = ""
    applyFilters()
  })

  localeSelect.addEventListener("change", applyFilters)
  onlyFavsChk.addEventListener("change", applyFilters)
  clearFiltersBtn.addEventListener("click", () => {
    if (globalSearch) globalSearch.value = ""
    if (mobileSearch) mobileSearch.value = ""
    localeSelect.value = "all"
    onlyFavsChk.checked = false
    applyFilters()
  })

  btnSpeak.addEventListener("click", speak)
  btnPause.addEventListener("click", pause)
  btnResume.addEventListener("click", resume)
  btnStop.addEventListener("click", stop)

  quickPlay?.addEventListener("click", speak)
  quickStop?.addEventListener("click", stop)

  btnSample.addEventListener("click", () => {
    textArea.value = "Hola, esta es una demostración de texto a voz con voces del navegador en Microsoft Edge."
    updateCounter()
    setStatus("Ejemplo cargado.")
  })

  btnClear.addEventListener("click", () => {
    textArea.value = ""
    updateCounter()
    setStatus("Texto limpiado.")
  })

  btnScrollVoices.addEventListener("click", () => {
    document.querySelector("#panel-voces")?.scrollIntoView({ behavior: "smooth", block: "start" })
    if (window.innerWidth < 1024) {
      hideSidebar()
    }
  })

  textArea.addEventListener("input", () => {
    updateCounter()
    savePrefs()
  })

  rate.addEventListener("input", () => {
    rateVal.textContent = Number(rate.value).toFixed(1) + "x"
    savePrefs()
  })

  pitch.addEventListener("input", () => {
    pitchVal.textContent = Number(pitch.value).toFixed(1)
    savePrefs()
  })

  volume.addEventListener("input", () => {
    volumeVal.textContent = Number(volume.value).toFixed(2)
    savePrefs()
  })

  $$("button[data-target]").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelector(b.dataset.target)?.scrollIntoView({ behavior: "smooth", block: "start" })
      if (window.innerWidth < 1024) {
        hideSidebar()
      }
    }),
  )

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault()
      speak()
    } else if (e.key === " " && (synth?.speaking || synth?.paused)) {
      e.preventDefault()
      synth.paused ? resume() : pause()
    } else if (e.key === "Escape") {
      stop()
      if (window.innerWidth < 1024) {
        hideSidebar()
      }
    }
  })

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1024) {
      sidebar?.classList.remove("-translate-x-full", "translate-x-0")
      sidebarBackdrop?.classList.add("hidden")
    }
  })

  // Init
  function initVoices() {
    console.log("🚀 Inicializando voces...")
    const pref = localStorage.getItem("tts_voice_name") || undefined
    populateVoices(pref)
  }
  ;(function init() {
    console.log("🎯 Iniciando aplicación TTS Edge...")

    if (window.innerWidth < 1024 && sidebar) {
      sidebar.classList.add("-translate-x-full")
    }

    clearGlobal?.classList.toggle("hidden", !(globalSearch?.value || "").length)
    clearMobile?.classList.toggle("hidden", !(mobileSearch?.value || "").length)

    loadPrefs()
    updateTransportButtons()
    syncSearchInputs()

    if (typeof speechSynthesis !== "undefined") {
      console.log("✅ Web Speech API disponible")

      // Forzar la carga inicial de voces
      const initialVoices = speechSynthesis.getVoices()
      console.log(`📊 Voces iniciales: ${initialVoices.length}`)

      if (initialVoices.length > 0) {
        initVoices()
      }

      // Configurar el evento de cambio de voces
      speechSynthesis.onvoiceschanged = () => {
        console.log("🔄 Evento onvoiceschanged disparado")
        initVoices()
      }

      // Múltiples intentos de carga con diferentes delays
      const retryAttempts = [100, 300, 600, 1000, 2000]
      retryAttempts.forEach((delay, index) => {
        setTimeout(() => {
          if (allVoices.length === 0) {
            console.log(`🔄 Intento ${index + 1} de carga de voces (${delay}ms)`)
            initVoices()
          }
        }, delay)
      })
    } else {
      console.error("❌ Web Speech API no disponible")
      setStatus("Tu navegador no soporta Web Speech API. Usa Microsoft Edge.", true)
    }

    setInterval(updateTransportButtons, 250)
  })()
})()
