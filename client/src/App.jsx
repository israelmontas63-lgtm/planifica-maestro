import { useState, useRef, useEffect } from "react";
import Header from "./components/Header.jsx";
import CaptureArea from "./components/CaptureArea.jsx";
import BottomPanel from "./components/BottomPanel.jsx";
import TextoModal from "./components/TextoModal.jsx";
import PlanResult from "./components/PlanResult.jsx";
import SchemaSelector from "./components/SchemaSelector.jsx";
import PerfilDocente from "./components/PerfilDocente.jsx";
import CurriculumViewer from "./components/CurriculumViewer.jsx";
import MisPlanificaciones from "./components/MisPlanificaciones.jsx";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition.js";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis.js";
import { useTrialStatus } from "./hooks/useTrialStatus.js";
import { generarPlanificacion, exportarWord, generarVoz, guardarAjustesPlan, obtenerCuotaDocente } from "./services/api.js";
import { registrarAjusteConRespaldoOffline, sincronizarAjustesPendientes } from "./services/offlineSync.js";
import { guardarPlanEnBiblioteca } from "./services/bibliotecaStorage.js";
import AccessGate, { verificarAccesoAutorizado } from "./components/AccessGate.jsx";

export default function App() {
  const [accesoAutorizado, setAccesoAutorizado] = useState(verificarAccesoAutorizado);
  const { diasRestantes, expirado, diasPrueba } = useTrialStatus();
  const [periodo, setPeriodo] = useState("diaria");
  const [nivel, setNivel] = useState("primario");
  const [imageSrc, setImageSrc] = useState(null);
  const [procesandoImagen, setProcesandoImagen] = useState(false);
  const [textoModalOpen, setTextoModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [bibliotecaOpen, setBibliotecaOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notificacionSync, setNotificacionSync] = useState(null);
  const [estadoCuota, setEstadoCuota] = useState(null);
  
  // Chat History
  const [messages, setMessages] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [hablarRespuestas, setHablarRespuestas] = useState(true);
  
  // Voice states
  const [escuchando, setEscuchando] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);

  const { listening, transcript, start, stop } = useSpeechRecognition();
  const { speak, stopSpeaking } = useSpeechSynthesis();

  // Auto-scroll chat
  const chatEndRef = useRef(null);
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

  // FASE 14: Hook de inicialización de cuota en App.jsx al cargar la app
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
  }, []);

  async function enviarMensaje(texto, imageBase64, mediaType) {
    if (!texto && !imageBase64) return;
    
    const newUserMsg = { role: "user", text: texto, imageBase64, mediaType };
    const newHistory = [...messages, newUserMsg];
    setMessages(newHistory);
    setImageSrc(null);

    // FASE 13: Verificación estricta de conexión antes de llamar a la IA
    if (!navigator.onLine) {
      const offlineMsg = {
        role: "assistant",
        text: "⚠️ Se necesita conexión a internet para generar contenido nuevo con IA. Puedes seguir viendo tus planificaciones guardadas."
      };
      setMessages([...newHistory, offlineMsg]);
      return;
    }

    // FASE 14: Manejo de límite de cuota alcanzado antes de consumir red
    if (estadoCuota?.agotado) {
      const quotaMsg = {
        role: "assistant",
        text: `🛑 Has alcanzado tu cuota de ${estadoCuota.limite} planificaciones de este periodo. Puedes seguir viendo, editando y exportando tus trabajos guardados.`
      };
      setMessages([...newHistory, quotaMsg]);
      return;
    }

    setCargando(true);

    try {
      const data = await generarPlanificacion({ messages: newHistory, nivel, periodo });
      
      // FASE 14: Actualizar contador de cuota devuelto por backend
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
        planId: data.planId || null
      };
      setMessages([...newHistory, newAssistantMsg]);
      
      if (hablarRespuestas && chatText) {
        speak(chatText);
      }
    } catch (err) {
      if (err.cuota) {
        setEstadoCuota(err.cuota);
      }
      if (err.limiteAlcanzado || err.agotado) {
        const quotaMsg = {
          role: "assistant",
          text: `🛑 ${err.message || "Has alcanzado tu cuota de planificaciones de este periodo."}`
        };
        setMessages([...newHistory, quotaMsg]);
      } else if (!navigator.onLine || err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")) {
        const offlineMsg = {
          role: "assistant",
          text: "⚠️ Se necesita conexión a internet para generar contenido nuevo con IA. Puedes seguir viendo tus planificaciones guardadas."
        };
        setMessages([...newHistory, offlineMsg]);
      } else {
        alert(err.message);
      }
    } finally {
      setCargando(false);
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

  async function handleImageSelected(dataUrl, mediaType) {
    setImageSrc(dataUrl);
    setProcesandoImagen(true);
    try {
      const base64 = dataUrl.split(",")[1];
      // Instead of sending automatically, we might want the user to add text. 
      // But for simplicity, send it directly or prompt for text.
      await enviarMensaje("Aquí tienes una imagen adjunta.", base64, mediaType);
    } catch (err) {
      alert(err.message);
    } finally {
      setProcesandoImagen(false);
    }
  }

  function handleDictadoClick() {
    if (listening) {
      stop();
      if (transcript.trim()) enviarMensaje(transcript);
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
      alert(err.message);
    } finally {
      setExportando(false);
    }
  }

  async function handleEscuchar(planText) {
    setEscuchando(true);
    try {
      const resumen = planText.substring(0, 500) + "...";
      const url = await generarVoz(resumen);
      setAudioUrl(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setEscuchando(false);
    }
  }

  if (!accesoAutorizado) {
    return <AccessGate onUnlock={() => setAccesoAutorizado(true)} />;
  }

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

      <Header onLogout={() => alert("Sesion cerrada")} estadoCuota={estadoCuota} />
      
      <section className="pm-title-card">
        <h1 className="pm-title">{periodo} - {nivel}</h1>
        <label className="pm-switch">
          Voz (Bot)
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

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 100px 10px', background: 'var(--pm-bg)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#64748b', marginTop: '20px' }}>
            <p>Sube una foto de la pizarra o presiona el micrófono para decirme qué clase quieres planificar.</p>
          </div>
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
            
            {m.role === 'assistant' && m.datosGenerados && (
               <PlanResult 
                datosGenerados={m.datosGenerados}
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
            )}
          </div>
        ))}
        {cargando && <div style={{ alignSelf: 'flex-start', color: '#64748b', fontStyle: 'italic' }}>Pensando...</div>}
        <div ref={chatEndRef} />
        
        <CaptureArea imageSrc={imageSrc} onImageSelected={handleImageSelected} procesando={procesandoImagen} />
      </div>
      
      <BottomPanel
        periodoActivo={periodo}
        nivelActivo={nivel}
        onSeleccionarEsquema={(p, n) => { setPeriodo(p); setNivel(n); }}
        listening={listening}
        onDictadoClick={handleDictadoClick}
        menuOpen={menuOpen}
        setMenuOpen={(open) => { setMenuOpen(open); if(open) { setTextoModalOpen(false); setSchemaOpen(false); setPerfilOpen(false); setCurriculumOpen(false); setBibliotecaOpen(false); } }}
        onAbrirTexto={() => { setTextoModalOpen(true); setMenuOpen(false); setSchemaOpen(false); setPerfilOpen(false); setCurriculumOpen(false); setBibliotecaOpen(false); }}
        onAbrirEsquemas={() => { setSchemaOpen(true); setMenuOpen(false); setTextoModalOpen(false); setPerfilOpen(false); setCurriculumOpen(false); setBibliotecaOpen(false); }}
        onAbrirPerfil={() => { setPerfilOpen(true); setMenuOpen(false); setTextoModalOpen(false); setSchemaOpen(false); setCurriculumOpen(false); setBibliotecaOpen(false); }}
        onAbrirCurriculo={() => { setCurriculumOpen(true); setMenuOpen(false); setTextoModalOpen(false); setSchemaOpen(false); setPerfilOpen(false); setBibliotecaOpen(false); }}
        onAbrirBiblioteca={() => { setBibliotecaOpen(true); setMenuOpen(false); setTextoModalOpen(false); setSchemaOpen(false); setPerfilOpen(false); setCurriculumOpen(false); }}
      />
      
      {textoModalOpen && (
        <TextoModal
          onCancel={() => setTextoModalOpen(false)}
          onConfirm={(texto) => { setTextoModalOpen(false); enviarMensaje(texto); }}
        />
      )}

      {schemaOpen && (
        <SchemaSelector
          periodoActivo={periodo}
          nivelActivo={nivel}
          onSeleccionar={(p, n) => { setPeriodo(p); setNivel(n); }}
          onCerrar={() => setSchemaOpen(false)}
        />
      )}

      {perfilOpen && (
        <PerfilDocente onCerrar={() => setPerfilOpen(false)} />
      )}

      {curriculumOpen && (
        <CurriculumViewer
          esquemaActivo={nivel}
          periodoActivo={periodo}
          onCerrar={() => setCurriculumOpen(false)}
          onAplicarAlEsquema={handleAplicarCurriculo}
        />
      )}

      {bibliotecaOpen && (
        <MisPlanificaciones
          onCerrar={() => setBibliotecaOpen(false)}
          onAbrirPlan={handleAbrirPlanDesdeBiblioteca}
          onExportarWord={(titulo, texto) => exportarWord({ titulo, plan: texto })}
        />
      )}
    </div>
  );
}

