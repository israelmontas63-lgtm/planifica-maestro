"""
scripts/busqueda_hibrida_curriculo.py

Motor de Búsqueda Híbrida Curricular (MINERD)
Implementa:
- BM25 (Léxico)
- Similitud Coseno de Embeddings Densos (Semántico)
- Fusión RRF (Cormack et al., SIGIR 2009)
"""

import math
import re
from typing import List, Dict, Any

# -------------------------------------------------------------------------
# 1. MOTOR LÉXICO: BM25 (Stephen Robertson & Karen Spärck Jones)
# -------------------------------------------------------------------------
class BM25Curricular:
    def __init__(self, corpus: List[Dict[str, Any]], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus = corpus
        self.doc_lengths = []
        self.avg_doc_len = 0.0
        self.doc_freqs: Dict[str, int] = {}
        self.total_docs = len(corpus)
        self.tokenized_corpus = []
        self._construir_indice()

    def _tokenizar(self, texto: str) -> List[str]:
        texto_limpio = texto.lower()
        texto_limpio = re.sub(r'[^\w\s]', ' ', texto_limpio)
        return [t for t in texto_limpio.split() if len(t) > 2]

    def _construir_indice(self):
        total_len = 0
        for doc in self.corpus:
            tokens = self._tokenizar(doc.get("texto", ""))
            self.tokenized_corpus.append(tokens)
            length = len(tokens)
            self.doc_lengths.append(length)
            total_len += length
            
            seen = set(tokens)
            for token in seen:
                self.doc_freqs[token] = self.doc_freqs.get(token, 0) + 1
                
        self.avg_doc_len = (total_len / self.total_docs) if self.total_docs > 0 else 1.0

    def buscar(self, query: str, top_n: int = 10) -> List[Dict[str, Any]]:
        tokens_query = self._tokenizar(query)
        puntuaciones = []

        for idx, tokens_doc in enumerate(self.tokenized_corpus):
            score = 0.0
            doc_len = self.doc_lengths[idx]
            token_counts = {}
            for t in tokens_doc:
                token_counts[t] = token_counts.get(t, 0) + 1

            for q_term in tokens_query:
                if q_term not in self.doc_freqs:
                    continue
                # Cálculo IDF de Robertson-Spärck Jones
                df = self.doc_freqs[q_term]
                idf = math.log((self.total_docs - df + 0.5) / (df + 0.5) + 1.0)
                
                # Frecuencia del término en documento
                tf = token_counts.get(q_term, 0)
                numerador = tf * (self.k1 + 1.0)
                denominador = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avg_doc_len))
                score += idf * (numerador / denominador)

            puntuaciones.append((idx, score))

        puntuaciones.sort(key=lambda x: x[1], reverse=True)
        return [{"id": self.corpus[i]["id"], "score_bm25": s, "doc": self.corpus[i]} 
                for i, s in puntuaciones[:top_n] if s > 0]


# -------------------------------------------------------------------------
# 2. MOTOR SEMÁNTICO: SIMILITUD COSENO L2
# -------------------------------------------------------------------------
def similitud_coseno(vec_a: List[float], vec_b: List[float]) -> float:
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot_product / (norm_a * norm_b)


# -------------------------------------------------------------------------
# 3. FUSIÓN DE RANGO RECÍPROCO: RRF (Cormack, Clarke & Büttcher, SIGIR 2009)
# -------------------------------------------------------------------------
def fusion_rrf(
    resultados_lexicos: List[Dict[str, Any]], 
    resultados_vectoriales: List[Dict[str, Any]], 
    k: int = 60, 
    top_final: int = 5
) -> List[Dict[str, Any]]:
    """
    Combina rankings léxicos y vectoriales mediante RRF: Score = SUM(1 / (k + rank)).
    Garantiza que ningún método domine de forma desproporcionada.
    """
    scores_rrf = {}
    documentos_map = {}

    # 1. Ponderar ranking léxico
    for rank, item in enumerate(resultados_lexicos, start=1):
        doc_id = item["id"]
        scores_rrf[doc_id] = scores_rrf.get(doc_id, 0.0) + (1.0 / (k + rank))
        documentos_map[doc_id] = item["doc"]

    # 2. Ponderar ranking vectorial
    for rank, item in enumerate(resultados_vectoriales, start=1):
        doc_id = item["id"]
        scores_rrf[doc_id] = scores_rrf.get(doc_id, 0.0) + (1.0 / (k + rank))
        if doc_id not in documentos_map:
            documentos_map[doc_id] = item["doc"]

    # 3. Ordenar por puntuación RRF combinada
    ranking_final = sorted(scores_rrf.items(), key=lambda x: x[1], reverse=True)

    salida = []
    for doc_id, score in ranking_final[:top_final]:
        salida.append({
            "id": doc_id,
            "score_rrf": score,
            "documento": documentos_map[doc_id]
        })
    return salida


# -------------------------------------------------------------------------
# PRUEBA UNITARIA LOCAL DE AUDITORÍA
# -------------------------------------------------------------------------
if __name__ == "__main__":
    # Base mínima de prueba representativa del MINERD
    corpus_prueba = [
        {
            "id": "1", 
            "fuente": "Adecuación 2023", 
            "pagina": 55, 
            "texto": "Comprensión oral de la anécdota como relato breve sobre hechos reales del entorno escolar y comunitario."
        },
        {
            "id": "2", 
            "fuente": "Guía CON BASE Matemática", 
            "pagina": 12, 
            "texto": "Construcción del sentido numérico y resolución de problemas con fracciones unitarias en contextos de medidas."
        },
        {
            "id": "3", 
            "fuente": "Adecuación 2023 Primaria", 
            "pagina": 180, 
            "texto": "Exploración de la biodiversidad, ecosistemas locales y la importancia de la conservación de la flora y fauna."
        }
    ]

    bm25 = BM25Curricular(corpus_prueba)
    consulta_docente = "cómo conservar las matas y seres vivos"
    res_bm25 = bm25.buscar(consulta_docente, top_n=2)

    # Simulación de vector semántico cercano a doc #3
    res_vectorial = [
        {"id": "3", "score": 0.89, "doc": corpus_prueba[2]},
        {"id": "1", "score": 0.42, "doc": corpus_prueba[0]}
    ]

    fusion = fusion_rrf(res_bm25, res_vectorial, k=60, top_final=2)
    print(f"=== RESULTADOS DE FUSIÓN RRF PARA: '{consulta_docente}' ===")
    for item in fusion:
        doc = item["documento"]
        print(f"Puntuación RRF: {item['score_rrf']:.5f} | Fuente: {doc['fuente']} (pág. {doc['pagina']})")
        print(f"Texto: {doc['texto']}\n")
