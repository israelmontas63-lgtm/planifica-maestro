import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured, isAuthEnabled } from "../services/supabaseClient.js";
import { limpiarDatosUsuario } from "../services/perfilStorage.js";

const LOCAL_USER_STORAGE = "pm_local_user";
const DEVICE_ID_KEY = "pm_device_id";

// Identificador anónimo estable por dispositivo (guardado en localStorage)
export function obtenerOrearDispositivoId() {
  try {
    let devId = localStorage.getItem(DEVICE_ID_KEY);
    if (!devId) {
      const rand = Math.random().toString(36).substring(2, 10);
      const ts = Date.now().toString(36);
      devId = `dev_${ts}_${rand}`;
      localStorage.setItem(DEVICE_ID_KEY, devId);
    }
    return devId;
  } catch (e) {
    return "dev_local_fallback";
  }
}

export function obtenerUsuarioIdActual() {
  if (isAuthEnabled) {
    if (isSupabaseConfigured && supabase) {
      try {
        // Supabase guarda la sesión bajo sb-<projectId>-auth-token en localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              const uid = parsed?.user?.id;
              if (uid) return uid;
            }
          }
        }
      } catch (e) {}
    }
    // Fallback a usuario local o simulado cuando la autenticación está activa
    try {
      const local = localStorage.getItem(LOCAL_USER_STORAGE);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed?.id) return parsed.id;
      }
    } catch (e) {}
    return null;
  }
  // En MODO BETA ABIERTA (isAuthEnabled === false):
  // Cada dispositivo recibe un identificador anónimo estable para sus planes y perfil
  return obtenerOrearDispositivoId();
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Inicializar y escuchar cambios de sesión
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (!error && data?.session && mounted) {
            setSession(data.session);
            setUser(data.session.user);
          }
        } catch (err) {
          console.error("Error al obtener sesión de Supabase:", err);
        } finally {
          if (mounted) setLoading(false);
        }

        // Escuchar eventos de autenticación en tiempo real
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
          if (mounted) {
            setSession(newSession);
            setUser(newSession?.user || null);
            setLoading(false);
          }
        });

        return () => {
          authListener?.subscription?.unsubscribe();
        };
      } else {
        // Modo local de respaldo si aún no se configuran las claves de Supabase
        try {
          const saved = localStorage.getItem(LOCAL_USER_STORAGE);
          if (saved && mounted) {
            const parsed = JSON.parse(saved);
            setUser(parsed);
          }
        } catch (e) {}
        if (mounted) setLoading(false);
      }
    }

    const cleanup = initSession();
    return () => {
      mounted = false;
      if (cleanup && typeof cleanup.then === "function") {
        cleanup.then((fn) => fn && fn());
      }
    };
  }, []);

  // 2. Iniciar sesión
  const signIn = useCallback(async ({ email, password }) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setSession(data.session);
      setUser(data.user);
      return data;
    } else {
      // Modo demo local
      const mockUser = {
        id: "usr_" + btoa(email.trim()).replace(/=/g, "").substring(0, 16),
        email: email.trim(),
        user_metadata: {
          nombre: email.split("@")[0].replace(/[._-]/g, " "),
          escuela: "Centro Educativo MINERD"
        }
      };
      localStorage.setItem(LOCAL_USER_STORAGE, JSON.stringify(mockUser));
      setUser(mockUser);
      return { user: mockUser };
    }
  }, []);

  // 3. Registro de usuario con metadatos (Fase 4: Nombre y Escuela unificados en user_metadata)
  const signUp = useCallback(async ({ email, password, nombre, escuela }) => {
    const trimmedEmail = email.trim();
    const trimmedNombre = nombre?.trim() || trimmedEmail.split("@")[0];
    const trimmedEscuela = escuela?.trim() || "";

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            nombre: trimmedNombre,
            full_name: trimmedNombre,
            escuela: trimmedEscuela,
          }
        }
      });
      if (error) throw error;
      // Si la confirmación de correo está desactivada en Supabase, la sesión se inicia de inmediato
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
      }
      return data;
    } else {
      // Modo demo local
      const mockUser = {
        id: "usr_" + btoa(trimmedEmail).replace(/=/g, "").substring(0, 16),
        email: trimmedEmail,
        user_metadata: {
          nombre: trimmedNombre,
          full_name: trimmedNombre,
          escuela: trimmedEscuela
        }
      };
      localStorage.setItem(LOCAL_USER_STORAGE, JSON.stringify(mockUser));
      setUser(mockUser);
      return { user: mockUser, session: { user: mockUser } };
    }
  }, []);

  // 4. Cerrar sesión
  const signOut = useCallback(async () => {
    const userIdActual = user?.id || obtenerUsuarioIdActual();
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("Error cerrando sesión en Supabase:", err);
      }
    }
    if (userIdActual) {
      limpiarDatosUsuario(userIdActual);
    }
    localStorage.removeItem(LOCAL_USER_STORAGE);
    setSession(null);
    setUser(null);
  }, [user]);

  // 5. Recuperación de contraseña por correo
  const resetPassword = useCallback(async (email) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      return true;
    } else {
      // Simulación en modo demo
      return true;
    }
  }, []);

  // 6. Actualizar perfil en Supabase Auth
  const updateProfile = useCallback(async (nuevosDatos) => {
    if (isSupabaseConfigured && supabase && user) {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          ...nuevosDatos,
        }
      });
      if (error) throw error;
      if (data.user) {
        setUser(data.user);
      }
      return data;
    } else if (user) {
      const updated = {
        ...user,
        user_metadata: {
          ...user.user_metadata,
          ...nuevosDatos
        }
      };
      localStorage.setItem(LOCAL_USER_STORAGE, JSON.stringify(updated));
      setUser(updated);
      return { user: updated };
    }
  }, [user]);

  return {
    user,
    session,
    loading,
    isSupabaseConfigured,
    isAuthEnabled,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
  };
}
