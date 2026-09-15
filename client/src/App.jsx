import { useState, useRef, useEffect } from "react";
import Header from "./components/Header.jsx";
import CaptureArea from "./components/CaptureArea.jsx";
import BottomPanel from "./components/BottomPanel.jsx";
import TextoModal from "./components/TextoModal.jsx";
import PlanResult from "./components/PlanResult.jsx";
import SchemaSelector from "./components/SchemaSelector.jsx";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition.js";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis.js";
import { useTrialStatus } from "./hooks/useTrialStatus.js";
import { generarPlanificacion, exportarWord, generarVoz } from "./services/api.js";

export default function App() {
  const { diasRestantes, expirado, diasPrueba } = useTrialStatus();
  const [periodo, setPeriodo] = useState("diaria");
  const [nivel, setNivel] = useState("primario");
  const [imageSrc, setImageSrc] = useState(null);
  const [procesandoImagen, setProcesandoImagen] = useState(false);
  const [textoModalOpen, setTextoModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  
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

  async function enviarMensaje(texto, imageBase64, mediaType) {
    if (!texto && !imageBase64) return;
    
    // Add User Message
    const newUserMsg = { role: "user", text: texto, imageBase64, mediaType };
    const newHistory = [...messages, newUserMsg];
    setMessages(newHistory);
    setCargando(true);
    setImageSrc(null); // Clear image after sending

    try {
      const data = await generarPlanificacion({ messages: newHistory, nivel, periodo });
      const newAssistantMsg = { role: "assistant", text: data.plan };
      setMessages([...newHistory, newAssistantMsg]);
      
      if (hablarRespuestas) {
        speak(data.plan);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setCargando(false);
    }
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

  // Detect if the latest assistant message looks like a final plan (has MINERD sections)
  const isFinalPlan = (text) => text && text.includes("Datos generales") && text.includes("Evaluación");

  return (
    <div className="phone-shell">
      <Header onLogout={() => alert("Sesion cerrada")} />
      
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
            
            {m.role === 'assistant' && isFinalPlan(m.text) && (
               <PlanResult 
                nivel={nivel} 
                setNivel={setNivel} 
                cargando={false} 
                plan={m.text} 
                onExportar={() => handleExportar(m.text)} 
                exportando={exportando}
                onEscuchar={() => handleEscuchar(m.text)}
                escuchando={escuchando}
                audioUrl={audioUrl}
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
        setMenuOpen={(open) => { setMenuOpen(open); if(open) { setTextoModalOpen(false); setSchemaOpen(false); } }}
        onAbrirTexto={() => { setTextoModalOpen(true); setMenuOpen(false); setSchemaOpen(false); }}
        onAbrirEsquemas={() => { setSchemaOpen(true); setMenuOpen(false); setTextoModalOpen(false); }}
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
    </div>
  );
}

