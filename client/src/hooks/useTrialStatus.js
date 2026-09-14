import { useEffect, useState } from "react";

const DIAS_PRUEBA = 30;
const STORAGE_KEY = "planifica_maestro_trial_start";

export function useTrialStatus() {
  const [diasRestantes, setDiasRestantes] = useState(null);
  const [expirado, setExpirado] = useState(false);

  useEffect(() => {
    let inicio = localStorage.getItem(STORAGE_KEY);
    if (!inicio) {
      inicio = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, inicio);
    }
    const inicioDate = new Date(inicio);
    const hoy = new Date();
    const diasTranscurridos = Math.floor((hoy - inicioDate) / (1000 * 60 * 60 * 24));
    const restantes = Math.max(DIAS_PRUEBA - diasTranscurridos, 0);
    setDiasRestantes(restantes);
    setExpirado(restantes <= 0);
  }, []);

  return { diasRestantes, expirado, diasPrueba: DIAS_PRUEBA };
}
