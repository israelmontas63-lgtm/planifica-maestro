import { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import Header from "./components/Header.jsx";
import CaptureArea from "./components/CaptureArea.jsx";
import BottomPanel from "./components/BottomPanel.jsx";
import WizardStepper from "./components/WizardStepper.jsx";
import HomeGreeting from "./components/HomeGreeting.jsx";
import { ESQUEMAS, PERIODOS } from "./data/esquemasData.js";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition.js";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis.js";
import { useTrialStatus } from "./hooks/useTrialStatus.js";
import { useAuth } from "./hooks/useAuth.js";
import { generarPlanificacion, exportarWord, generarVoz, guardarAjustesPlan, obtenerCuotaDocente, obtenerOwnerKey } from "./services/api.js";
import { registrarAjusteConRespaldoOffline, sincronizarAjustesPendientes } from "./services/offlineSync.js";
import { guardarPlanEnBiblioteca } from "./services/bibliotecaStorage.js";
import { comprimirYRedimensionarImagen } from "./services/imageOptimizer.js";
import { cargarPerfil } from "./services/perfilStorage.js";
import { extraerJson, mensajeParaChat, validarCamposPlanificacion } from "./utils/parseadorJsonSeguro.js";
import { normalizarOrdinalesYNumeros, analizarEntidadesDictado } from "./utils/normalizadorVoz.js";

// Modales y componentes secundarios con carga diferida (Lazy Loading) para carga móvil instantánea
const PlanResult = lazy(() => import("./components/PlanResult.jsx"));
const SchemaSelector = lazy(() => import("./components/SchemaSelector.jsx"));
const PerfilDocente = lazy(() => import("./components/PerfilDocente.jsx"));
const CurriculumViewer = lazy(() => import("./components/CurriculumViewer.jsx"));
const MisPlanificaciones = lazy(() => import("./components/MisPlanificaciones.jsx"));
const TextoModal = lazy(() => import("./components/TextoModal.jsx"));
const AuthScreen = lazy(() => import("./components/AuthScreen.jsx"));
const OwnerModal = lazy(() => import("./components/OwnerModal.jsx"));
const OwnerStatsModal = lazy(() => import("./components/OwnerStatsModal.jsx"));
const NotificacionesModal = lazy(() => import("./components/NotificacionesModal.jsx"));
const ConfiguracionModal = lazy(() => import("./components/ConfiguracionModal.jsx"));
const AyudaModal = lazy(() => import("./components/AyudaModal.jsx"));

export default function App() {
  const {
    user,
    session,
    loading: authLoading,
    isSupabaseConfigured,
    isAuthEnabled,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile
  } = useAuth();
  const [avisoDispositivoVisto, setAvisoDispositivoVisto] = useState(() => {
    try {
      return localStorage.getItem("pm_aviso_dispositivo_visto") === "true";
    } catch (e) {
      return false;
    }
  });

  const handleCerrarAvisoDispositivo = () => {
    try {
      localStorage.setItem("pm_aviso_dispositivo_visto", "true");
    } catch (e) {}
    setAvisoDispositivoVisto(true);
  };
  const { diasRestantes, expirado, diasPrueba } = useTrialStatus();
  const [periodo, setPeriodo] = useState("diaria");
  const [nivel, setNivel] = useState("primario");
  const [imageSrc, setImageSrc] = useState(null);
  const [procesandoImagen, setProcesandoImagen] = useState(false);
  const [textoModalOpen, setTextoModalOpen] = useState(false);
  const [textoModalPrompt, setTextoModalPrompt] = useState("");
  const [textoModalTitulo, setTextoModalTitulo] = useState("Describe la planificación");
  const [menuOpen, setMenuOpen] = useState(false);

  // Bloquear el scroll del fondo cuando el menú está abierto
  useEffect(() => {
    if (menuOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [menuOpen]);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [bibliotecaOpen, setBibliotecaOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [notificacionesOpen, setNotificacionesOpen] = useState(false);
  const [configuracionOpen, setConfiguracionOpen] = useState(false);
  const [ayudaOpen, setAyudaOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(!!obtenerOwnerKey());
  const [ownerModalOpen, setOwnerModalOpen] = useState(false);
  const [ownerStatsModalOpen, setOwnerStatsModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notificacionSync, setNotificacionSync] = useState(null);
  const [estadoCuota, setEstadoCuota] = useState(null);
  
  // Chat History
  const [messages, setMessages] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [cambiandoARespaldo, setCambiandoARespaldo] = useState(false);
  const timerRespaldoRef = useRef(null);
  const [streamingText, setStreamingText] = useState("");
  const [modoOperacion, setModoOperacion] = useState("pensando");
  const [errorGeneracion, setErrorGeneracion] = useState(null);
  const abortControllerRef = useRef(null);
  const [exportando, setExportando] = useState(false);
  const [hablarRespuestas, setHablarRespuestas] = useState(true);
  
  // Voice states
  const [escuchando, setEscuchando] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const globalAudioRef = useRef(null);

  // Image states
  const [escaneandoFoto, setEscaneandoFoto] = useState(false);

  // PWA Install prompt state
  const [installPrompt, setInstallPrompt] = useState(null);
  const [updatePending, setUpdatePending] = useState(false);

  useEffect(() => {
    const handleUpdatePending = () => {
      setUpdatePending(true);
    };

    window.addEventListener("pm:update-pending", handleUpdatePending);
    return () => {
      window.removeEventListener("pm:update-pending", handleUpdatePending);
      if (timerRespaldoRef.current) clearTimeout(timerRespaldoRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__PM_PWA__ = {
        isBusy: () => Boolean(cargando || escuchando || escaneandoFoto || exportando),
        saveDraft: () => {
          try {
            const draft = {
              fecha: Date.now(),
              nivel,
              periodo,
              streamingText,
              messagesCount: messages.length
            };
            localStorage.setItem("pm_borrador_emergencia", JSON.stringify(draft));
          } catch (e) {
            console.warn("⚠️ Error guardando borrador de emergencia PWA:", e);
          }
        }
      };
    }
  }, [cargando, escuchando, escaneandoFoto, exportando, nivel, periodo, streamingText, messages]);

  const aplicarActualizacionPWA = () => {
    if (typeof window !== "undefined" && typeof window.__PM_PENDING_RELOAD__ === "function") {
      window.__PM_PENDING_RELOAD__();
    } else {
      window.location.reload();
    }
  };

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice?.outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  const [silenceTimeoutMs, setSilenceTimeoutMs] = useState(() => {
    try {
      const saved = localStorage.getItem("pm_silence_timeout_ms");
      if (saved !== null) {
        const val = Number(saved);
        return (!isNaN(val) && val >= 0 && val <= 10000) ? val : 0;
      }
      return 0; // Por defecto: 0 = Manual (sin corte automático)
    } catch (e) {
      return 0;
    }
  });

  const handleGuardarSilenceTimeout = (val) => {
    const num = Math.max(0, Math.min(10000, Number(val) || 0));
    setSilenceTimeoutMs(num);
    try {
      localStorage.setItem("pm_silence_timeout_ms", String(num));
    } catch (e) {}
  };

  const [confirmarVozAntes, setConfirmarVozAntes] = useState(() => {
    try {
      return localStorage.getItem("pm_confirmar_voz_antes") === "true";
    } catch (e) {
      return false;
    }
  });

  const handleCambiarConfirmarVozAntes = (val) => {
    setConfirmarVozAntes(val);
    try {
      localStorage.setItem("pm_confirmar_voz_antes", val ? "true" : "false");
    } catch (e) {}
  };

  const ultimoTiempoDictadoRef = useRef(null);

  const handleFinDictadoRef = useRef(null);
  const handleFiveMinuteLimit = useCallback((res) => {
    setNotificacionSync("⏱️ El dictado se detuvo automáticamente tras 5 minutos continuos por seguridad.");
    setTimeout(() => setNotificacionSync(null), 6000);
    handleFinDictadoRef.current?.(res);
  }, []);

  const {
    listening,
    transcript,
    isLowConfidence,
    tiempoTranscurrido,
    start,
    stop,
    resetTranscript
  } = useSpeechRecognition({
    silenceTimeout: silenceTimeoutMs,
    onSilenceStop: (res) => handleFinDictadoRef.current?.(res),
    onFiveMinuteLimit: handleFiveMinuteLimit
  });
  const { speak, stopSpeaking, isSpeaking } = useSpeechSynthesis();
  const fuePorVozRef = useRef(false);
  const [entendidoVoz, setEntendidoVoz] = useState(null);

  // Auto-scroll chat contenedor interno sin afectar el documento
  const chatContainerRef = useRef(null);
  const chatEndRef = useRef(null);
  const fileInputHiddenRef = useRef(null);

  const scrollToChatBottom = (smooth = true) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        left: 0,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  // Esquema y periodo legibles
  const esquemaActual = ESQUEMAS.find((e) => e.id === nivel);
  const esquemaLabel = esquemaActual ? esquemaActual.nombre : nivel;
  const periodoObj = PERIODOS.find((p) => p.value === periodo);
  const periodoLabel = periodoObj ? periodoObj.label : periodo;

  // Paso del wizard (1: Configurar, 2: Tema/Material, 3: Revisar y Exportar)
  const tienePlanGenerado = messages.some((m) => m.role === "assistant" && m.datosGenerados);
  const pasoActual = tienePlanGenerado ? 3 : (messages.length > 0 || cargando || imageSrc) ? 2 : 2;

  useEffect(() => {
    scrollToChatBottom(true);
  }, [messages, cargando]);

  // FASE 13: Listener de conectividad y sincronización automática al volver online
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      obtenerCuotaDocente().then((cuota) => cuota && setEstadoCuota(cuota)).catch(() => {});
      sincronizarAjustesPendientes((info) => {
        if (info && info.totalSincronizados > 0) {
          setNotificacionSync(`✓ Se sincronizaron ${info.totalSincronizados} cambios guardados offline.`);
          setTimeout(() => setNotificacionSync(null), 3500);
        }
      });
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (navigator.onLine) {
      sincronizarAjustesPendientes((info) => {
        if (info && info.totalSincronizados > 0) {
          setNotificacionSync(`✓ Se sincronizaron ${info.totalSincronizados} cambios guardados offline.`);
          setTimeout(() => setNotificacionSync(null), 3500);
        }
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Detección de atajo ?owner=1 o #owner
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("owner") === "1" || window.location.hash === "#owner") {
      setOwnerModalOpen(true);
    }
    // Atajo de prueba exclusivo para localhost (nunca en túnel público por seguridad)
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      const quickKey = params.get("key");
      if (quickKey) {
        localStorage.setItem("pm_owner_key", quickKey);
        setIsOwner(true);
        obtenerCuotaDocente().then((c) => c && setEstadoCuota(c)).catch(() => {});
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleOwnerSuccess = () => {
    setIsOwner(true);
    obtenerCuotaDocente().then((c) => c && setEstadoCuota(c)).catch(() => {});
  };

  const handleOwnerLogout = () => {
    localStorage.removeItem("pm_owner_key");
    setIsOwner(false);
    obtenerCuotaDocente().then((c) => c && setEstadoCuota(c)).catch(() => {});
  };

  // Carga y actualización de cuota (modo Invitado, Docente Supabase o Dueño)
  useEffect(() => {
    async function cargarEstadoInicialCuota() {
      try {
        const cuotaData = await obtenerCuotaDocente();
        if (cuotaData) {
          setEstadoCuota(cuotaData);
        }
      } catch (e) {
        console.warn("No se pudo cargar la cuota inicial (posible modo offline)");
      }
    }
    cargarEstadoInicialCuota();
  }, [user, isOwner]);

  async function enviarMensaje(texto, imageBase64, mediaType, aspectRatio = null, opcionesExtra = {}) {
    if (!texto && !imageBase64) return;

    // Si ya había una petición en curso, cancelarla limpiamente para atender la nueva solicitud
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setErrorGeneracion(null);
    const newUserMsg = { role: "user", text: texto, imageBase64, mediaType, aspectRatio };
    const newHistory = [...messages, newUserMsg];
    setMessages(newHistory);
    setImageSrc(null);

    // Verificación estricta de conexión antes de llamar a la IA
    if (!navigator.onLine) {
      setErrorGeneracion({
        message: "⚠️ Se necesita conexión a internet para generar contenido nuevo con IA. Puedes seguir viendo tus planificaciones guardadas.",
        canRetry: true,
        lastHistory: newHistory,
      });
      return;
    }

    // Manejo de límite de cuota alcanzado antes de consumir red
    if (estadoCuota?.agotado) {
      setErrorGeneracion({
        message: `🛑 Has alcanzado tu cuota de ${estadoCuota.limite} planificaciones de este periodo. Puedes seguir viendo, editando y exportando tus trabajos guardados.`,
        canRetry: false,
        lastHistory: newHistory,
      });
      return;
    }

    setCargando(true);
    setCambiandoARespaldo(false);
    setStreamingText("");
    setModoOperacion("pensando");
    abortControllerRef.current = new AbortController();

    if (timerRespaldoRef.current) clearTimeout(timerRespaldoRef.current);
    timerRespaldoRef.current = setTimeout(() => {
      setCambiandoARespaldo(true);
    }, 15000);

    try {
      const data = await generarPlanificacion({
        messages: newHistory,
        nivel,
        periodo,
        forzarOriginal: Boolean(opcionesExtra.forzarOriginal),
        confirmado: Boolean(opcionesExtra.confirmado),
        signal: abortControllerRef.current.signal,
        onChunk: (delta, accumulated, estado) => {
          setStreamingText(accumulated);
          if (estado) setModoOperacion(estado);
        },
      });

      // Actualizar contador de cuota devuelto por backend
      if (data.cuota) {
        setEstadoCuota(data.cuota);
      }

      // Manejo estricto de respuesta JSON: chatText NUNCA debe mostrar sintaxis cruda
      let parsedObj = typeof data === "object" && data !== null ? data : null;
      if (!parsedObj || typeof data === "string") {
        parsedObj = extraerJson(data) || {};
      }

      let chatText = parsedObj.mensaje_chat || parsedObj.plan || "";
      if (typeof chatText === "string" && chatText.trim().startsWith("{")) {
        const sub = extraerJson(chatText);
        if (sub) {
          chatText = mensajeParaChat(sub);
          if (!parsedObj.datos_planificacion && (sub.datos_planificacion || sub.momentos || sub.actividades)) {
            parsedObj.datos_planificacion = sub.datos_planificacion || sub;
          }
        } else {
          chatText = "No pude armar la planificación, ¿intentamos otra vez?";
        }
      }
      if (!chatText || chatText.trim() === "") {
        chatText = parsedObj.datos_planificacion
          ? "He preparado tu planificación docente basada en el currículo."
          : "No pude armar la planificación, ¿intentamos otra vez?";
      }

      let planDatos = parsedObj.datos_planificacion || (parsedObj.momentos ? parsedObj : null);
      if (planDatos && ultimoTiempoDictadoRef.current && !planDatos.tiempo && !planDatos.duracion) {
        planDatos.tiempo = ultimoTiempoDictadoRef.current;
      }
      const planCompleto = Boolean(planDatos && (parsedObj.plan_completado || validarCamposPlanificacion(planDatos)));

      const newAssistantMsg = {
        role: "assistant",
        text: chatText,
        datosGenerados: planCompleto ? planDatos : null,
        confianzaCurricular: data.confianzaCurricular || null,
        planId: data.planId || null,
        distintivo: data.distintivo || null,
        esRespaldo: data.es_respaldo || false,
        origen: data.origen || null,
        opciones: data.opciones || null,
        modo: data.modo || null,
        tipoVisual: data.tipo_visual || null,
        esBorrosa: data.es_borrosa || false,
        esDelicado: data.es_delicado || false,
        textoOriginal: data.texto_original || null,
        textoCorregido: data.texto_corregido || null,
        correccionesAplicadas: data.correcciones_aplicadas || [],
        huboCorrecciones: Boolean(data.hubo_correcciones),
        cambioSignificado: Boolean(data.cambio_significado),
      };
      setMessages([...newHistory, newAssistantMsg]);

      if ((hablarRespuestas || fuePorVozRef.current) && chatText) {
        handleEscuchar(chatText);
      }
      fuePorVozRef.current = false;
    } catch (err) {
      if (err.name === "AbortError") {
        // Cancelado por el usuario voluntariamente
        return;
      }
      if (err.cuota) {
        setEstadoCuota(err.cuota);
      }
      const friendlyMsg = err.friendlyMessage || err.message || "Error al generar la planificación.";
      setErrorGeneracion({
        message: friendlyMsg,
        canRetry: err.canRetry !== false,
        lastHistory: newHistory,
      });
    } finally {
      if (timerRespaldoRef.current) clearTimeout(timerRespaldoRef.current);
      setCargando(false);
      setCambiandoARespaldo(false);
      setStreamingText("");
      abortControllerRef.current = null;
    }
  }

  function handleCancelarGeneracion() {
    if (timerRespaldoRef.current) clearTimeout(timerRespaldoRef.current);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setCargando(false);
    setCambiandoARespaldo(false);
    setStreamingText("");
  }

  function handleReintentar() {
    if (!errorGeneracion?.lastHistory) return;
    const history = errorGeneracion.lastHistory;
    const lastMsg = history[history.length - 1];
    setErrorGeneracion(null);
    if (lastMsg) {
      enviarMensaje(lastMsg.text, lastMsg.imageBase64, lastMsg.mediaType);
    }
  }

  // FASE 8: Aplicar contenido del Visor de Currículo MINERD directamente a la planificación activa
  function handleAplicarCurriculo(datosPlanificacion, tema) {
    const newAssistantMsg = {
      role: "assistant",
      text: `✅ He cargado las competencias, contenidos y actividades oficiales del MINERD para: "${tema}". Revisa o edita los campos a continuación antes de imprimir o exportar.`,
      datosGenerados: datosPlanificacion,
      planId: "plan_curriculo_" + Date.now()
    };
    setMessages((prev) => [...prev, newAssistantMsg]);
  }

  // FASE 11: Cargar planificación seleccionada desde Mis Planificaciones
  function handleAbrirPlanDesdeBiblioteca(plan) {
    if (plan.nivel) setNivel(plan.nivel);
    if (plan.periodo) setPeriodo(plan.periodo);
    const newAssistantMsg = {
      role: "assistant",
      text: `📂 Planificación cargada desde tu biblioteca: "${plan.titulo}" (${plan.esquemaLabel || "Esquema MINERD"}). Puedes revisarla, editarla o exportarla libremente.`,
      datosGenerados: plan.datosPlanificacion,
      planId: plan.id
    };
    setMessages((prev) => [...prev, newAssistantMsg]);
  }

  function handleAbrirTexto(promptInicial = "", titulo = "Describe la planificación") {
    let promptConContexto = promptInicial || "";
    if (!promptConContexto) {
      try {
        const p = cargarPerfil();
        if (p?.grado && p.grado.trim()) {
          promptConContexto = `Planificación para ${p.grado.trim()}: `;
        }
      } catch (e) {}
    }
    setTextoModalPrompt(promptInicial || "");
    if (promptConContexto && !promptInicial) {
      setTextoModalPrompt(promptConContexto);
    }
    setTextoModalTitulo(titulo || "Describe la planificación");
    setTextoModalOpen(true);
    setMenuOpen(false);
    setSchemaOpen(false);
    setPerfilOpen(false);
    setCurriculumOpen(false);
    setBibliotecaOpen(false);
    setAuthModalOpen(false);
    setNotificacionesOpen(false);
    setConfiguracionOpen(false);
    setAyudaOpen(false);
  }

  async function handleImageFile(file) {
    if (!file) return;
    setProcesandoImagen(true);

    // Mostrar vista previa inmediata en miniatura mientras transcurre la compresión
    const readerPrevia = new FileReader();
    readerPrevia.onload = (e) => {
      setImageSrc(e.target.result);
    };
    readerPrevia.readAsDataURL(file);

    try {
      const optimizada = await comprimirYRedimensionarImagen(file, 1600, 0.82);
      await handleImageSelected(optimizada.dataUrl, optimizada.mediaType, optimizada.aspectRatio);
    } catch (err) {
      console.warn("Fallo compresión en canvas, usando lectura directa:", err);
      const reader = new FileReader();
      reader.onload = () => handleImageSelected(reader.result, file.type || "image/jpeg", "4/3");
      reader.readAsDataURL(file);
    } finally {
      setProcesandoImagen(false);
    }
  }

  async function handleImageSelected(dataUrl, mediaType, aspectRatio = null) {
    setImageSrc(dataUrl);
    setProcesandoImagen(true);
    try {
      const base64 = dataUrl.split(",")[1];
      // Si el docente ya había dictado o escrito una instrucción previa, se envía; si no, va vacío para que el Ojo Digital lo identifique primero
      const textoPrevio = (transcript || "").trim();
      await enviarMensaje(textoPrevio, base64, mediaType, aspectRatio);
    } catch (err) {
      setErrorGeneracion({
        message: err.friendlyMessage || err.message || "Error procesando la imagen.",
        canRetry: false,
      });
    } finally {
      setProcesandoImagen(false);
    }
  }

  const handleFinDictado = useCallback((res) => {
    const rawText = (typeof res === "string" ? res : res?.text || transcript).trim();
    if (!rawText) return;

    // Normalizar ordinales y números escritos con palabras ("segundo" -> "2.º", "cuarenta y cinco minutos" -> "45 minutos")
    const textoNormalizado = normalizarOrdinalesYNumeros(rawText);

    // Perfil guardado sin quemar nombres fijos
    let perfilDocente = {};
    try {
      perfilDocente = cargarPerfil() || {};
    } catch (e) {}

    const analisis = analizarEntidadesDictado(textoNormalizado, perfilDocente);
    if (analisis.minutosNum) {
      ultimoTiempoDictadoRef.current = `${analisis.minutosNum} minutos`;
    }

    if (confirmarVozAntes) {
      // Switch encendido: mostrar tarjeta editable previa con botones Generar y Corregir
      setEntendidoVoz({
        tipo: "confirmacion_previa",
        texto: textoNormalizado,
        analisis,
        bajaConfianza: Boolean(res?.isLowConfidence),
        enviado: false
      });
    } else if (res?.isLowConfidence) {
      setEntendidoVoz({
        tipo: "baja_confianza",
        texto: textoNormalizado,
        analisis,
        bajaConfianza: true,
        enviado: false
      });
    } else {
      fuePorVozRef.current = true;
      setEntendidoVoz({
        tipo: "directo",
        texto: textoNormalizado,
        analisis,
        bajaConfianza: false,
        enviado: true
      });
      const textToSend = textoNormalizado;
      enviarMensaje(textToSend);
    }
  }, [transcript, confirmarVozAntes]);

  useEffect(() => {
    handleFinDictadoRef.current = handleFinDictado;
  }, [handleFinDictado]);

  function handleDictadoClick() {
    if (isSpeaking) {
      stopSpeaking();
    }
    if (listening) {
      const res = stop();
      handleFinDictado(res);
    } else {
      stopSpeaking();
      start((errMsg, rawCode) => {
        setErrorGeneracion({
          message: `${errMsg} Puedes escribir tu consulta directamente con el teclado o consultar el currículo.`,
          codigoTecnico: rawCode || null,
          canRetry: false,
          accionTexto: true
        });
      });
    }
  }

  async function handleExportar(planText, datos = null) {
    setExportando(true);
    try {
      await exportarWord({
        titulo: "Planificacion_" + periodo + "_" + nivel,
        plan: typeof planText === "string" ? planText : "",
        datos: datos || (typeof planText === "object" ? planText : null)
      });
    } catch (err) {
      setErrorGeneracion({
        message: err.friendlyMessage || err.message || "Error al exportar a Word.",
        canRetry: true,
      });
    } finally {
      setExportando(false);
    }
  }

  async function handleEscuchar(planText, origen = "chat") {
    if (!planText || typeof planText !== "string") return;
    if (listening) {
      stop();
    }

    // Interbloqueo estricto: Detener cualquier audio global anterior y síntesis previa
    if (globalAudioRef.current) {
      globalAudioRef.current.pause();
      globalAudioRef.current.currentTime = 0;
      globalAudioRef.current.src = "";
    }
    stopSpeaking();

    setEscuchando(true);
    // Sintetizar y reproducir la primera oración de inmediato (límite 500 caracteres)
    const oraciones = planText.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [planText];
    const primeraOracion = (oraciones[0] || "").trim();
    const resumen = (primeraOracion || planText).substring(0, 500);

    try {
      const url = await generarVoz(resumen);

      if (origen === "plan") {
        // En planes completos: PlanResult gestiona su propio reproductor con controles visibles
        setAudioUrl(url);
      } else {
        // En respuestas de chat o cámara: PlanResult no debe recibir audio para no sonar doble
        setAudioUrl(null);
        if (globalAudioRef.current) {
          globalAudioRef.current.src = url;
          const playPromise = globalAudioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((playErr) => {
              console.warn("Reproductor global bloqueado por el navegador, activando síntesis local:", playErr);
              speak(resumen, (notice) => {
                setNotificacionSync(notice);
                setTimeout(() => setNotificacionSync(null), 4000);
              });
            });
          }
        }
      }
    } catch (err) {
      console.warn("Voz de IA no disponible, usando síntesis del navegador:", err);
      speak(resumen, (notice) => {
        setNotificacionSync(notice);
        setTimeout(() => setNotificacionSync(null), 4000);
      });
    } finally {
      setEscuchando(false);
    }
  }

  // El registro/inicio de sesión es 100% opcional (acceso abierto al público).
  // Se abre a petición del usuario desde el avatar o el menú.

  if (expirado) {
    return (
      <div className="phone-shell">
        <Header onLogout={() => alert("Sesion cerrada (demo)")} />
        <div className="result-panel">
          <h3>Tu prueba gratuita de {diasPrueba} dias termino</h3>
          <p>Actualiza tu plan para seguir generando planificaciones.</p>
        </div>
      </div>
    );
  }



  return (
    <div className="phone-shell">
      {/* FASE 13: Banner de modo offline y notificación de sincronización automática */}
      {!isOnline && (
        <div className="pm-offline-banner no-print">
          <span>📡 Modo sin conexión — Puedes ver y editar tus planificaciones guardadas.</span>
        </div>
      )}
      {notificacionSync && (
        <div className="pm-sync-toast no-print">
          <span>{notificacionSync}</span>
        </div>
      )}

      {/* FASE 14: Banners dinámicos de control de cuota de IA */}
      {estadoCuota?.alerta80 && !estadoCuota?.agotado && (
        <div className="banner-alerta-80 flex justify-between items-center px-4 py-2 no-print">
          <span>⚠️ Estás cerca del límite de tu cuota de planificaciones de este periodo ({estadoCuota.usadas}/{estadoCuota.limite}).</span>
        </div>
      )}

      {estadoCuota?.agotado && (
        <div className="banner-limite-100 flex justify-between items-center px-4 py-2 no-print">
          <span>🛑 Has alcanzado tu cuota de {estadoCuota.limite} planificaciones. Puedes seguir viendo, editando y exportando tus trabajos guardados.</span>
        </div>
      )}

      {updatePending && (
        <aside
          role="status"
          aria-live="polite"
          className="pm-update-banner no-print"
          style={{
            background: "#0284c7",
            color: "#ffffff",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "13px",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            position: "sticky",
            top: 0,
            zIndex: 9999
          }}
        >
          <span>🚀 Hay una nueva versión de Planifica Maestro disponible.</span>
          <button
            type="button"
            onClick={aplicarActualizacionPWA}
            style={{
              background: "#ffffff",
              color: "#0369a1",
              border: "none",
              padding: "5px 12px",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "12px"
            }}
          >
            Actualizar ahora
          </button>
        </aside>
      )}

      <Header
        user={user}
        isOwner={isOwner}
        onLogout={signOut}
        onLogoutOwner={handleOwnerLogout}
        onAbrirPerfil={() => { setPerfilOpen(true); setMenuOpen(false); }}
        onAbrirAuth={() => { setAuthModalOpen(true); setMenuOpen(false); }}
        onAbrirOwnerModal={() => { setOwnerModalOpen(true); setMenuOpen(false); }}
        onAbrirOwnerStats={() => { setOwnerStatsModalOpen(true); setMenuOpen(false); }}
        estadoCuota={estadoCuota}
        onInstallApp={installPrompt ? handleInstallApp : null}
        onAbrirNotificaciones={() => { setNotificacionesOpen(true); setMenuOpen(false); }}
        onAbrirConfiguracion={() => { setConfiguracionOpen(true); setMenuOpen(false); }}
      />
      
      <section className="pm-title-card no-print">
        <button
          type="button"
          className="pm-chip-esquema"
          onClick={() => { setSchemaOpen(true); setMenuOpen(false); }}
          title="Toca para cambiar el esquema curricular o el periodo"
          aria-label={`Esquema actual: ${periodoLabel} - ${esquemaLabel}. Toca para cambiar.`}
        >
          <div className="pm-chip-main">
            <span className="pm-chip-icon">📋</span>
            <span className="pm-chip-text">{periodoLabel} • {esquemaLabel}</span>
            <span className="pm-chip-caret">▾</span>
          </div>
          <span className="pm-chip-hint">Toca para cambiar esquema</span>
        </button>

        <label className="pm-switch" title="Activar o desactivar la lectura por voz de las respuestas generadas con IA">
          <span className="pm-switch-label">🔊 Voz IA</span>
          <input 
            type="checkbox" 
            checked={hablarRespuestas} 
            onChange={(e) => setHablarRespuestas(e.target.checked)} 
          />
          <div className="pm-switch-track">
            <div className="pm-switch-thumb"></div>
          </div>
        </label>
      </section>

      {/* Stepper de progreso guiado tipo wizard */}
      <WizardStepper
        pasoActual={pasoActual}
        onConfigurarClick={() => { setSchemaOpen(true); setMenuOpen(false); }}
        onTemaClick={() => handleAbrirTexto()}
        onRevisarClick={() => {
          scrollToChatBottom(true);
        }}
        periodo={periodoLabel}
        esquemaLabel={esquemaLabel}
      />

      {/* Input invisible para activar la cámara desde el botón Foto de la barra inferior */}
      <input
        ref={fileInputHiddenRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFile(file);
          e.target.value = "";
        }}
      />

      <div 
        ref={chatContainerRef}
        className="pm-chat-container"
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          overflowX: 'hidden',
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          padding: '10px 10px 100px 10px', 
          background: 'var(--pm-bg)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px' 
        }}
      >
        {/* FASE A: Saludo vivo contextual con tipografía serifa y efecto máquina de escribir */}
        {messages.length === 0 && !cargando && !listening && (
          <HomeGreeting user={user} />
        )}

        {/* Aviso de almacenamiento local en dispositivo (mostrado una sola vez, sin jerga técnica) */}
        {!avisoDispositivoVisto && messages.length === 0 && !cargando && !listening && (
          <div style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            padding: "10px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            margin: "0 4px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>📱</span>
              <span>
                <strong>Tus trabajos se guardan en este dispositivo:</strong> Recuerda descargar en Word las planificaciones que quieras conservar de forma permanente.
              </span>
            </div>
            <button
              type="button"
              onClick={handleCerrarAvisoDispositivo}
              style={{
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              Entendido
            </button>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`pm-chat-bubble ${m.role === 'user' ? 'pm-chat-msg-user' : 'pm-chat-msg-assistant'}`}
          >
            {m.imageBase64 && (
              <div
                className="pm-chat-image-wrapper"
                style={{
                  maxWidth: '100%',
                  aspectRatio: m.aspectRatio || '4 / 3',
                  minHeight: '120px',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  marginBottom: '8px'
                }}
              >
                <img
                  src={"data:" + m.mediaType + ";base64," + m.imageBase64}
                  alt="Adjunto"
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    display: 'block'
                  }}
                />
              </div>
            )}
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '14.5px' }}>{typeof m.text === 'string' && m.text.trim().startsWith('{') ? mensajeParaChat(extraerJson(m.text)) : m.text}</div>
            
            {m.role === 'assistant' && m.huboCorrecciones && m.cambioSignificado && (
              <div className="pm-correccion-banner no-print" style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                padding: "8px 12px",
                margin: "8px 0 4px 0",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px"
              }}>
                <span style={{ color: "#166534" }}>
                  💡 <strong>Entendí:</strong> <em>"{m.textoCorregido}"</em>
                </span>
                <button
                  type="button"
                  className="pm-btn-deshacer"
                  onClick={() => enviarMensaje(m.textoOriginal, null, null, null, { forzarOriginal: true })}
                  style={{
                    cursor: "pointer",
                    background: "#ffffff",
                    border: "1px solid #86efac",
                    borderRadius: "6px",
                    padding: "3px 8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#15803d"
                  }}
                  title="Revertir y procesar exactamente con tu texto original"
                >
                  ↩️ Deshacer / usar mi texto original
                </button>
              </div>
            )}
            
            {m.role === 'assistant' && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => isSpeaking ? stopSpeaking() : handleEscuchar(m.text)}
                  style={{
                    background: 'none',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: '#475569',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Escuchar respuesta con voz"
                >
                  {isSpeaking ? "⏹️ Detener voz" : "🔊 Escuchar"}
                </button>
              </div>
            )}
            
            {m.role === 'assistant' && m.datosGenerados && (
              <Suspense fallback={<div style={{ padding: '12px', color: '#64748b' }}>Cargando planificación...</div>}>
                <PlanResult 
                  datosGenerados={m.datosGenerados}
                  confianzaCurricular={m.confianzaCurricular}
                  distintivo={m.distintivo}
                  esRespaldo={m.esRespaldo}
                  origen={m.origen}
                  planId={m.planId}
                  nivel={nivel}
                  periodo={periodo}
                  onExportar={(datos) => handleExportar(Object.entries(datos).map(([k,v]) => `${k}\n${v}`).join("\n\n"), datos)} 
                  exportando={exportando}
                  onEscuchar={(datos) => handleEscuchar(Object.values(datos).join(" ").substring(0, 500), "plan")}
                  escuchando={escuchando}
                  audioUrl={audioUrl}
                  onDatosActualizados={(nuevosDatos) => {
                    // FASE 13: Actualizar biblioteca local inmediatamente para persistencia offline
                    guardarPlanEnBiblioteca({
                      id: m.planId,
                      titulo: m.text?.substring(0, 45) || "Planificación Docente",
                      nivel,
                      periodo,
                      datosPlanificacion: nuevosDatos
                    });
                    // Sincronizar o encolar para sincronizar cuando vuelva la conexión
                    if (m.planId) {
                      registrarAjusteConRespaldoOffline({ planId: m.planId, datosAjustados: nuevosDatos });
                    }
                  }}
                />
              </Suspense>
            )}

            {/* FASE 1: Opciones interactivas del Ojo Digital / Clasificador de intención / Confirmaciones */}
            {m.role === 'assistant' && m.opciones && m.opciones.length > 0 && i === messages.length - 1 && !cargando && (
              <div className="pm-intencion-opciones-container no-print" style={{ margin: "10px 0 6px 0" }}>
                <span className="pm-quick-replies-label" style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "12px", color: "var(--teal, #1a7d8c)" }}>
                  {m.modo === "confirmar_correccion" ? "Confirmar interpretación:" : m.modo === "aclarar_ambiguedad" ? "Seleccionar término exacto:" : "¿Qué te gustaría hacer?"}
                </span>
                <div className="pm-quick-replies-row" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {m.opciones.map((op, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="pm-quick-reply-pill pm-btn-opcion-intencion"
                      style={{
                        padding: "6px 14px",
                        borderRadius: "20px",
                        border: "1px solid var(--teal, #1a7d8c)",
                        backgroundColor: "#f0fdfa",
                        color: "#0f766e",
                        fontSize: "13px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                      onClick={() => {
                        if (m.modo === "confirmar_correccion") {
                          if (op.startsWith("Sí, continuar")) {
                            enviarMensaje(m.textoCorregido || op, null, null, null, { confirmado: true });
                          } else {
                            enviarMensaje(m.textoOriginal || op, null, null, null, { forzarOriginal: true });
                          }
                        } else if (m.modo === "aclarar_ambiguedad") {
                          if (op.startsWith("Mantener")) {
                            enviarMensaje(m.textoOriginal || op, null, null, null, { forzarOriginal: true });
                          } else {
                            const matchTermino = op.match(/Usar "([^"]+)"/);
                            const valTermino = matchTermino ? matchTermino[1] : op;
                            enviarMensaje(valTermino, null, null, null, { confirmado: true });
                          }
                        } else {
                          enviarMensaje(op);
                        }
                      }}
                    >
                      👉 {op}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* FASE A: Píldoras de respuesta rápida para planificación generada */}
            {m.role === 'assistant' && (!m.opciones || m.opciones.length === 0) && m.datosGenerados && i === messages.length - 1 && !cargando && (
              <div className="pm-quick-replies-container no-print">
                <span className="pm-quick-replies-label">Sugerencias rápidas:</span>
                <div className="pm-quick-replies-row">
                  <button
                    type="button"
                    className="pm-quick-reply-pill"
                    onClick={() => enviarMensaje("Por favor, agrega adaptaciones curriculares DUA (Diseño Universal para el Aprendizaje) para esta clase.")}
                  >
                    💡 ¿Adaptaciones DUA?
                  </button>
                  <button
                    type="button"
                    className="pm-quick-reply-pill"
                    onClick={() => enviarMensaje("Dame 2 opciones creativas adicionales para la actividad de inicio.")}
                  >
                    🔄 Otra dinámica de inicio
                  </button>
                  <button
                    type="button"
                    className="pm-quick-reply-pill"
                    onClick={() => enviarMensaje("Ajusta la distribución del tiempo para una sesión de 45 minutos.")}
                  >
                    ⏱️ Ajustar a 45 min
                  </button>
                  {m.datosGenerados && (
                    <button
                      type="button"
                      className="pm-quick-reply-pill pm-pill-export"
                      onClick={() => handleExportar(Object.entries(m.datosGenerados).map(([k,v]) => `${k}\n${v}`).join("\n\n"))}
                    >
                      📝 Ver en Word
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* FASE A: Vista previa en vivo del dictado con ondas sonoras dinámicas y 'Escuchando…' */}
        {listening && (
          <div className="pm-dictado-live-preview no-print" role="status" aria-live="assertive">
            <div className="pm-voice-wave-wrapper" aria-hidden="true">
              <span className="pm-wave-bar bar-1"></span>
              <span className="pm-wave-bar bar-2"></span>
              <span className="pm-wave-bar bar-3"></span>
              <span className="pm-wave-bar bar-4"></span>
              <span className="pm-wave-bar bar-5"></span>
            </div>
            <div className="pm-dictado-content">
              <div className="pm-dictado-hint">
                <span className="pm-listening-badge">Escuchando…</span>
                <span>Di el tema, grado o área curricular:</span>
              </div>
              <div className="pm-dictado-text">
                {transcript || <span style={{ color: "#0F6E56", fontStyle: "italic", opacity: 0.8 }}>Habla con confianza, te escucho...</span>}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="pm-btn-enviar-dictado"
                  style={{
                    background: "var(--teal, #1a7d8c)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                  onClick={() => {
                    const res = stop();
                    handleFinDictado(res);
                  }}
                  disabled={!transcript?.trim()}
                >
                  🎙️ Enviar a Planificar
                </button>
                <button
                  type="button"
                  style={{
                    background: "#f1f5f9",
                    color: "#64748b",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer"
                  }}
                  onClick={() => {
                    stop();
                    resetTranscript();
                  }}
                >
                  ✕ Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 2: Confirmación inteligente 'Entendí: …' */}
        {entendidoVoz && (
          <div className="pm-entendido-voz-container no-print" style={{ margin: "10px 0", animation: "fadeIn 0.2s ease" }}>
            {entendidoVoz.tipo === "confirmacion_previa" ? (
              <div style={{ padding: "14px 16px", borderRadius: "12px", background: "#f8fafc", border: "1.5px solid #0d9488", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", color: "#0f766e", fontSize: "14px" }}>
                    <span>🎙️ Confirmar lo que entendí antes de generar:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEntendidoVoz(null)}
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "16px", padding: "0 4px" }}
                    aria-label="Cerrar"
                  >
                    ✕
                  </button>
                </div>

                <div style={{ background: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px", color: "#1e293b", lineHeight: "1.5" }}>
                  {entendidoVoz.analisis?.resumenEstructurado || entendidoVoz.texto}
                </div>

                {/* Etiquetas sutiles de discrepancia con el perfil (sin bloquear) */}
                {entendidoVoz.analisis?.difiereDocente && (
                  <div style={{ fontSize: "12px", color: "#b45309", background: "#fef3c7", padding: "4px 8px", borderRadius: "6px", marginTop: "6px", display: "inline-block" }}>
                    ℹ️ Nombre en el dictado no coincide con el perfil
                  </div>
                )}
                {entendidoVoz.analisis?.difiereEscuela && (
                  <div style={{ fontSize: "12px", color: "#b45309", background: "#fef3c7", padding: "4px 8px", borderRadius: "6px", marginTop: "6px", marginLeft: entendidoVoz.analisis?.difiereDocente ? "6px" : "0", display: "inline-block" }}>
                    ℹ️ Escuela en el dictado no coincide con el perfil
                  </div>
                )}

                {/* Sugerencia fonética biografía vs bibliografía */}
                {entendidoVoz.analisis?.sugerencia?.tieneSugerencia && (
                  <div style={{ marginTop: "8px", padding: "6px 10px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "6px", fontSize: "12px", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                    <span>💡 {entendidoVoz.analisis.sugerencia.mensaje}</span>
                    <button
                      type="button"
                      style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "4px", padding: "3px 8px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
                      onClick={() => {
                        const nuevoTxt = entendidoVoz.texto.replace(/bibliograf[íi]a/gi, "biografía");
                        let p = {};
                        try { p = cargarPerfil() || {}; } catch(e) {}
                        const nuevoAnalisis = analizarEntidadesDictado(nuevoTxt, p);
                        setEntendidoVoz({
                          ...entendidoVoz,
                          texto: nuevoTxt,
                          analisis: nuevoAnalisis
                        });
                      }}
                    >
                      Usar biografía
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                  <button
                    type="button"
                    style={{ padding: "8px 16px", borderRadius: "8px", background: "#0d9488", color: "white", border: "none", fontWeight: "700", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    onClick={() => {
                      const txt = entendidoVoz.texto;
                      setEntendidoVoz(null);
                      fuePorVozRef.current = true;
                      enviarMensaje(txt);
                    }}
                  >
                    ✅ Generar
                  </button>
                  <button
                    type="button"
                    style={{ padding: "8px 16px", borderRadius: "8px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", fontWeight: "600", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    onClick={() => {
                      const txt = entendidoVoz.texto;
                      setEntendidoVoz(null);
                      handleAbrirTexto(txt, "Corregir lo que entendí");
                    }}
                  >
                    ✏️ Corregir
                  </button>
                </div>
              </div>
            ) : entendidoVoz.bajaConfianza && !entendidoVoz.enviado ? (
              <div style={{ padding: "12px 16px", borderRadius: "10px", background: "#fefce8", border: "1px solid #fde047" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", color: "#854d0e" }}>
                  <span>🎙️ Entendí:</span>
                  <span style={{ fontStyle: "italic", color: "#1e293b" }}>"{entendidoVoz.texto}"</span>
                </div>
                <div style={{ fontSize: "12px", color: "#713f12", marginTop: "4px" }}>
                  Audio con baja nitidez. Puedes enviarlo directamente, editarlo o cancelar.
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button
                    type="button"
                    style={{ padding: "6px 14px", borderRadius: "6px", background: "var(--teal, #1a7d8c)", color: "white", border: "none", fontWeight: "600", cursor: "pointer" }}
                    onClick={() => {
                      const txt = entendidoVoz.texto;
                      setEntendidoVoz(null);
                      fuePorVozRef.current = true;
                      enviarMensaje(txt);
                    }}
                  >
                    ✅ Enviar
                  </button>
                  <button
                    type="button"
                    style={{ padding: "6px 14px", borderRadius: "6px", background: "#e2e8f0", color: "#1e293b", border: "none", fontWeight: "600", cursor: "pointer" }}
                    onClick={() => {
                      const txt = entendidoVoz.texto;
                      setEntendidoVoz(null);
                      handleAbrirTexto(txt, "Editar consulta dictada");
                    }}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    style={{ padding: "6px 14px", borderRadius: "6px", background: "#fee2e2", color: "#991b1b", border: "none", fontWeight: "600", cursor: "pointer" }}
                    onClick={() => setEntendidoVoz(null)}
                  >
                    ↩️ Deshacer
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "8px 14px", borderRadius: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                <span style={{ color: "#166534" }}>🎙️ Entendí: <em>"{entendidoVoz.texto}"</em></span>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "#15803d", textDecoration: "underline", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}
                  onClick={() => {
                    const txt = entendidoVoz.texto;
                    setEntendidoVoz(null);
                    handleAbrirTexto(txt, "Corregir consulta enviada");
                  }}
                >
                  ✏️ Corregir
                </button>
              </div>
            )}
          </div>
        )}

        {/* FASE A: Estado "Pensando..." con tres puntos que parpadean en sucesión y texto en vivo */}
        {cargando && (
          <div className="pm-thinking-card no-print" role="status" aria-live="polite">
            <div className="pm-thinking-header">
              <div className="pm-thinking-dots" aria-hidden="true">
                <span className="pm-dot pm-dot-1"></span>
                <span className="pm-dot pm-dot-2"></span>
                <span className="pm-dot pm-dot-3"></span>
              </div>
              <span className="pm-thinking-label">
                {cambiandoARespaldo
                  ? "El motor principal está lento, cambiando a respaldo…"
                  : (modoOperacion === "charla" || modoOperacion === "conversando"
                      ? (streamingText ? "conversando con el profe…" : "pensando…")
                      : (modoOperacion === "curriculo"
                          ? (streamingText ? "organizando los momentos de la clase…" : "estoy buscando en el currículo…")
                          : (streamingText ? "organizando la respuesta…" : "pensando…")))}
              </span>
              <button
                type="button"
                className="pm-btn-cancel-thinking"
                onClick={handleCancelarGeneracion}
                title="Cancelar generación"
              >
                ✕ Cancelar
              </button>
            </div>
            {streamingText && !streamingText.trim().startsWith("{") && (
              <div className="pm-streaming-text">
                {streamingText}
              </div>
            )}
          </div>
        )}

        {/* Aviso de error amigable en pantalla con botón Reintentar */}
        {errorGeneracion && (
          <div className="pm-error-card no-print">
            <div className="pm-error-content">
              <span className="pm-error-icon">⚠️</span>
              <div className="pm-error-text">
                <div>{errorGeneracion.message}</div>
                {errorGeneracion.codigoTecnico && (
                  <details style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: '500' }}>Ver detalles técnicos</summary>
                    <div style={{ marginTop: '4px', fontFamily: 'monospace', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>
                      Código de evento: {errorGeneracion.codigoTecnico}
                    </div>
                  </details>
                )}
              </div>
            </div>
            <div className="pm-error-actions">
              {errorGeneracion.accionTexto && (
                <button
                  type="button"
                  className="pm-btn-retry"
                  style={{ background: "var(--teal, #1a7d8c)", color: "white" }}
                  onClick={() => {
                    setErrorGeneracion(null);
                    handleAbrirTexto("", "Escribe tu consulta pedagógica");
                  }}
                >
                  ✍️ Escribir consulta
                </button>
              )}
              {errorGeneracion.canRetry && (
                <button
                  type="button"
                  className="pm-btn-retry"
                  onClick={handleReintentar}
                >
                  🔄 Reintentar
                </button>
              )}
              <button
                type="button"
                className="pm-btn-dismiss"
                onClick={() => setErrorGeneracion(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
        
        <CaptureArea
          imageSrc={imageSrc}
          onImageSelected={handleImageSelected}
          onRemoveImage={() => setImageSrc(null)}
          procesando={procesandoImagen}
        />
      </div>
      
      <BottomPanel
        periodoActivo={periodo}
        nivelActivo={nivel}
        onSeleccionarEsquema={(p, n) => { setPeriodo(p); setNivel(n); }}
        listening={listening}
        duracionTexto={tiempoTranscurrido}
        onDictadoClick={handleDictadoClick}
        onAbrirCamara={() => fileInputHiddenRef.current?.click()}
        menuOpen={menuOpen}
        setMenuOpen={(open) => { setMenuOpen(open); if(open) { setTextoModalOpen(false); setSchemaOpen(false); setPerfilOpen(false); setCurriculumOpen(false); setBibliotecaOpen(false); setAuthModalOpen(false); setNotificacionesOpen(false); setConfiguracionOpen(false); setAyudaOpen(false); } }}
        onAbrirTexto={(prompt, titulo) => handleAbrirTexto(prompt, titulo)}
        onAbrirEsquemas={() => { setSchemaOpen(true); setMenuOpen(false); setTextoModalOpen(false); setPerfilOpen(false); setCurriculumOpen(false); setBibliotecaOpen(false); setAuthModalOpen(false); }}
        onAbrirPerfil={() => { setPerfilOpen(true); setMenuOpen(false); setTextoModalOpen(false); setSchemaOpen(false); setCurriculumOpen(false); setBibliotecaOpen(false); setAuthModalOpen(false); }}
        onAbrirCurriculo={() => { setCurriculumOpen(true); setMenuOpen(false); setTextoModalOpen(false); setSchemaOpen(false); setPerfilOpen(false); setBibliotecaOpen(false); setAuthModalOpen(false); }}
        onAbrirBiblioteca={() => { setBibliotecaOpen(true); setMenuOpen(false); setTextoModalOpen(false); setSchemaOpen(false); setPerfilOpen(false); setCurriculumOpen(false); setAuthModalOpen(false); }}
        user={user}
        onAbrirAuth={() => { setAuthModalOpen(true); setMenuOpen(false); setTextoModalOpen(false); setSchemaOpen(false); setPerfilOpen(false); setCurriculumOpen(false); setBibliotecaOpen(false); }}
        onLogout={signOut}
        isOwner={isOwner}
        onAbrirOwner={() => { setOwnerStatsModalOpen(true); setMenuOpen(false); setTextoModalOpen(false); setSchemaOpen(false); setPerfilOpen(false); setCurriculumOpen(false); setBibliotecaOpen(false); }}
        canInstall={!!installPrompt}
        onInstallApp={handleInstallApp}
        onAbrirConfiguracion={() => { setConfiguracionOpen(true); setMenuOpen(false); }}
        onAbrirAyuda={() => { setAyudaOpen(true); setMenuOpen(false); }}
      />
      
      {authModalOpen && isAuthEnabled && (
        <Suspense fallback={null}>
          <AuthScreen
            onSignIn={signIn}
            onSignUp={signUp}
            onResetPassword={resetPassword}
            onCerrar={() => setAuthModalOpen(false)}
            isConfigured={isSupabaseConfigured}
          />
        </Suspense>
      )}

      {ownerModalOpen && (
        <Suspense fallback={null}>
          <OwnerModal
            onCerrar={() => setOwnerModalOpen(false)}
            onSuccess={handleOwnerSuccess}
          />
        </Suspense>
      )}

      {ownerStatsModalOpen && (
        <Suspense fallback={null}>
          <OwnerStatsModal
            onCerrar={() => setOwnerStatsModalOpen(false)}
          />
        </Suspense>
      )}
      
      {textoModalOpen && (
        <Suspense fallback={null}>
          <TextoModal
            initialValue={textoModalPrompt}
            titulo={textoModalTitulo}
            onConsultarCurriculo={() => {
              setTextoModalOpen(false);
              setCurriculumOpen(true);
            }}
            onCancel={() => {
              setTextoModalOpen(false);
              setTextoModalPrompt("");
            }}
            onConfirm={(texto) => {
              setTextoModalOpen(false);
              setTextoModalPrompt("");
              enviarMensaje(texto);
            }}
          />
        </Suspense>
      )}

      {schemaOpen && (
        <Suspense fallback={null}>
          <SchemaSelector
            periodoActivo={periodo}
            nivelActivo={nivel}
            onSeleccionar={(p, n) => { setPeriodo(p); setNivel(n); }}
            onCerrar={() => setSchemaOpen(false)}
          />
        </Suspense>
      )}

      {perfilOpen && (
        <Suspense fallback={null}>
          <PerfilDocente
            user={user}
            onActualizarPerfil={updateProfile}
            onCerrar={() => setPerfilOpen(false)}
          />
        </Suspense>
      )}

      {curriculumOpen && (
        <Suspense fallback={null}>
          <CurriculumViewer
            esquemaActivo={nivel}
            periodoActivo={periodo}
            onCerrar={() => setCurriculumOpen(false)}
            onAplicarAlEsquema={handleAplicarCurriculo}
          />
        </Suspense>
      )}

      {bibliotecaOpen && (
        <Suspense fallback={null}>
          <MisPlanificaciones
            onCerrar={() => setBibliotecaOpen(false)}
            onAbrirPlan={handleAbrirPlanDesdeBiblioteca}
            onExportarWord={(titulo, texto) => exportarWord({ titulo, plan: texto })}
          />
        </Suspense>
      )}

      {notificacionesOpen && (
        <Suspense fallback={null}>
          <NotificacionesModal
            isOnline={isOnline}
            estadoCuota={estadoCuota}
            onCerrar={() => setNotificacionesOpen(false)}
          />
        </Suspense>
      )}

      {configuracionOpen && (
        <Suspense fallback={null}>
          <ConfiguracionModal
            hablarRespuestas={hablarRespuestas}
            setHablarRespuestas={setHablarRespuestas}
            silenceTimeoutMs={silenceTimeoutMs}
            setSilenceTimeoutMs={handleGuardarSilenceTimeout}
            confirmarVozAntes={confirmarVozAntes}
            setConfirmarVozAntes={handleCambiarConfirmarVozAntes}
            onAbrirPerfil={() => { setPerfilOpen(true); setConfiguracionOpen(false); }}
            onCerrar={() => setConfiguracionOpen(false)}
          />
        </Suspense>
      )}

      {ayudaOpen && (
        <Suspense fallback={null}>
          <AyudaModal
            onCerrar={() => setAyudaOpen(false)}
          />
        </Suspense>
      )}

      {/* Reproductor de audio global único para respuestas del asistente y cámara */}
      <audio
        ref={globalAudioRef}
        style={{ display: "none" }}
        onEnded={() => setEscuchando(false)}
        onError={() => setEscuchando(false)}
      />
    </div>
  );
}

