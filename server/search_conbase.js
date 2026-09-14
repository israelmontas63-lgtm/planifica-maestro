require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: 'Busca en internet la estructura exacta de planificación docente del programa "Con Base" del MINERD (República Dominicana) para los primeros grados (Alfabetización Inicial). Dime cuáles son los pasos, momentos, bloques o secciones que componen esta planificación y en qué se diferencia de la tradicional.',
    config: { tools: [{ googleSearch: {} }] }
  });
  console.log(response.text);
}
run();
