import { useState, useRef, useEffect, lazy, Suspense } from "react";
import Header from "./components/Header.jsx";
import CaptureArea from "./components/CaptureArea.jsx";
import BottomPanel from "./components/BottomPanel.jsx";
import WizardStepper from "./components/WizardStepper.jsx";
import UnifiedEntrySelector from "./components/UnifiedEntrySelector.jsx";
import { ESQUEMAS, PERIODOS } from "./data/esquemasData.js";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition.js";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis.js";
import { useTrialStatus } from "./hooks/useTrialStatus.js";
import { useAuth } from "./hooks/useAuth.js";
import { generarPlanificacion, exportarWord, generarVoz, guardarAjustesPlan, obtenerCuotaDocente, obtenerOwnerKey } from "./services/api.js";
import { registrarAjusteConRespaldoOffline, sincronizarAjustesPendientes } from "./services/offlineSync.js";
import { guardarPlanEnBiblioteca } from "./services/bibliotecaStorage.js";

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
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile
  } = useAuth();
  const { diasRestantes, expirado, diasPrueba } = useTrialStatus();
  const [periodo, setPeriodo] = useState("diaria");
  const [nivel, setNivel] = useState("primario");
  const [imageSrc, setImageSrc] = useState(null);
  const [procesandoImagen, setProcesandoImagen] = useState(false);
  const [textoModalOpen, setTextoModalOpen] = useState(false);
  const [textoModalPrompt, setTextoModalPrompt] = useState("");
  const [textoModalTitulo, setTextoModalTitulo] = useState("Describe la planificación");
  const [menuOpen, setMenuOpen] = useState(false);
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
  const [streamingText, setStreamingText] = useState("");
  const [errorGeneracion, setErrorGeneracion] = useState(null);
  const abortControllerRef = useRef(null);
  const [exportando, setExportando] = useState(false);
  const [hablarRespuestas, setHablarRespuestas] = useState(true);
  
  // Voice states
  const [escuchando, setEscuchando] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);

  // PWA Install prompt state
  const [installPrompt, setInstallPrompt] = useState(null);

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

  const { listening, transcript, start, stop } = useSpeechRecognition();
  const { speak, stopSpeaking, isSpeaking } = useSpeechSynthesis();
  const fuePorVozRef = useRef(false);

  // Auto-scroll chat
  const chatEndRef = useRef(null);
  const fileInputHiddenRef = useRef(null);

  // Esquema y periodo legibles
  const esquemaActual = ESQUEMAS.find((e) => e.id === nivel);
  const esquemaLabel = esquemaActual ? esquemaActual.nombre : nivel;
  const periodoObj = PERIODOS.find((p) => p.value === periodo);
  const periodoLabel = periodoObj ? periodoObj.label : periodo;

  // Paso del wizard (1: Configurar, 2: Tema/Material, 3: Revisar y Exportar)
  const tienePlanGenerado = messages.some((m) => m.role === "assistant" && m.datosGenerados);
  const pasoActual = tienePlanGenerado ? 3 : (messages.length > 0 || cargando || imageSrc) ? 2 : 2;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  async function enviarMensaje(texto, imageBase64, mediaType) {
    if (!texto && !imageBase64) return;

    setErrorGeneracion(null);
    const newUserMsg = { role: "user", text: texto, imageBase64, mediaType };
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
    setStreamingText("");
    abortControllerRef.current = new AbortController();

    try {
      const data = await generarPlanificacion({
        messages: newHistory,
        nivel,
        periodo,
        signal: abortControllerRef.current.signal,
        onChunk: (delta, accumulated) => {
          setStreamingText(accumulated);
        },
      });

      // Actualizar contador de cuota devuelto por backend
      if (data.cuota) {
        setEstadoCuota(data.cuota);
      }

      // Handle new structured JSON response
      const chatText = data.mensaje_chat || data.plan || "";
      const planDatos = data.datos_planificacion || null;
      const planCompleto = data.plan_completado || false;

      const newAssistantMsg = {
        role: "assistant",
        text: chatText,
        datosGenerados: planCompleto ? planDatos : null,
        confianzaCurricular: data.confianzaCurricular || null,
        planId: data.planId || null,
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
      setCargando(false);
      setStreamingText("");
      abortControllerRef.current = null;
    }
  }

  function handleCancelarGeneracion() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setCargando(false);
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
    setTextoModalPrompt(promptInicial || "");
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

  async function handleImageSelected(dataUrl, mediaType) {
    setImageSrc(dataUrl);
    setProcesandoImagen(true);
    try {
      const base64 = dataUrl.split(",")[1];
      const promptMultimodal = "📸 Analiza esta imagen con visión pedagógica avanzada como un docente experto: 1) Identifica y transcribe el contenido del libro, pizarra, ejercicio o guía didáctica. 2) Determina el tema central, área curricular y grado escolar según el diseño curricular del MINERD. 3) Genera de inmediato la planificación didáctica completa para este contenido según el esquema y período activo.";
      await enviarMensaje(promptMultimodal, base64, mediaType);
    } catch (err) {
      setErrorGeneracion({
        message: err.friendlyMessage || err.message || "Error procesando la imagen.",
        canRetry: false,
      });
    } finally {
      setProcesandoImagen(false);
    }
  }

  function handleDictadoClick() {
    if (listening) {
      const finalText = stop();
      const textToSend = (finalText || transcript).trim();
      if (textToSend) {
        fuePorVozRef.current = true;
        enviarMensaje(textToSend);
      }
    } else {
      stopSpeaking();
      start();
    }
  }

  async function handleExportar(planText) {
    setExportando(true);
    try {
      await exportarWord({ titulo: "Planificacion_" + periodo + "_" + nivel, plan: planText });
    } catch (err) {
      setErrorGeneracion({
        message: err.friendlyMessage || err.message || "Error al exportar a Word.",
        canRetry: true,
      });
    } finally {
      setExportando(false);
    }
  }

  async function handleEscuchar(planText) {
    setEscuchando(true);
    const resumen = planText.substring(0, 500);
    try {
      const url = await generarVoz(resumen + "...");
      setAudioUrl(url);
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
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => handleImageSelected(reader.result, file.type);
          reader.readAsDataURL(file);
          e.target.value = "";
        }}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 100px 10px', background: 'var(--pm-bg)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <UnifiedEntrySelector
            onDictadoClick={handleDictadoClick}
            listening={listening}
            onAbrirCamara={() => fileInputHiddenRef.current?.click()}
            onAbrirTexto={(prompt, titulo) => handleAbrirTexto(prompt, titulo)}
            onAbrirCurriculo={() => { setCurriculumOpen(true); setMenuOpen(false); }}
            onAbrirEsquemas={() => { setSchemaOpen(true); setMenuOpen(false); }}
          />
        )}
        
        {messages.map((m, i) => (
          <div key={i} style={{ 
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            background: m.role === 'user' ? '#1a7d8c' : '#fff',
            color: m.role === 'user' ? '#fff' : '#334155',
            padding: '12px',
            borderRadius: '12px',
            maxWidth: '85%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            border: m.role === 'assistant' ? '1px solid #e2e8f0' : 'none'
          }}>
            {m.imageBase64 && (
              <img src={"data:" + m.mediaType + ";base64," + m.imageBase64} alt="Adjunto" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px' }} />
            )}
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>{m.text}</div>
            
            {m.role === 'assistant' && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
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
                  planId={m.planId}
                  nivel={nivel}
                  periodo={periodo}
                  onExportar={(datos) => handleExportar(Object.entries(datos).map(([k,v]) => `${k}\n${v}`).join("\n\n"))} 
                  exportando={exportando}
                  onEscuchar={(datos) => handleEscuchar(Object.values(datos).join(" ").substring(0, 500))}
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
          </div>
        ))}
        {/* Vista previa en vivo del dictado mientras se habla */}
        {listening && (
          <div className="pm-dictado-live-preview no-print">
            <span className="pm-dictado-pulse">🎙️</span>
            <div className="pm-dictado-content">
              <div className="pm-dictado-hint">Escuchando... Di tu tema o requerimiento pedagógico:</div>
              <div className="pm-dictado-text">{transcript || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Habla ahora...</span>}</div>
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
                    cursor: "pointer"
                  }}
                  onClick={() => {
                    const finalText = stop();
                    const textToSend = (finalText || transcript).trim();
                    if (textToSend) {
                      fuePorVozRef.current = true;
                      enviarMensaje(textToSend);
                    }
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
                    cursor: "pointer"
                  }}
                  onClick={() => stop()}
                >
                  ✕ Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Estado "Pensando..." con streaming en tiempo real y botón Cancelar */}
        {cargando && (
          <div className="pm-thinking-card no-print">
            <div className="pm-thinking-header">
              <div className="pm-thinking-spinner"></div>
              <span className="pm-thinking-label">Pensando con IA...</span>
              <button
                type="button"
                className="pm-btn-cancel-thinking"
                onClick={handleCancelarGeneracion}
                title="Cancelar generación"
              >
                ✕ Cancelar
              </button>
            </div>
            {streamingText && (
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
              <div className="pm-error-text">{errorGeneracion.message}</div>
            </div>
            <div className="pm-error-actions">
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
      
      {authModalOpen && (
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
    </div>
  );
}

