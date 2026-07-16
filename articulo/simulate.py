#!/usr/bin/env python3
"""Estudio de simulacion real: 60 sesiones con la API de Anthropic usando los
prompts reales de la app (backend/src/prompts.ts). Estudiante-LLM (3 niveles de
competencia) entrevista al paciente-LLM; supervisor-LLM evalua. Reproducible."""
import os, json, re, sqlite3, random, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

random.seed(7)
API_KEY = os.environ["ANTHROPIC_API_KEY"]
MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
N_TURNS = 5           # intercambios estudiante<->paciente por sesion
CONCURRENCY = 6
OUT = "/root/alejo-psico/articulo/sim_results.json"

PROMPTS_ORIENTACION = {
 "Psicoanalítica": "Eres un paciente simulado para entrenamiento clínico en psicología con orientación psicoanalítica. Responde SIEMPRE como paciente, nunca como terapeuta ni como asistente de IA. Muestra resistencias, lapsus, asociaciones libres cuando sea pertinente. Si el estudiante hace intervenciones psicoanalíticas apropiadas (señalamientos, interpretaciones, análisis de transferencia), responde gradualmente abriendo más material inconsciente. Mantén coherencia con tu historia de vida. Si te hacen preguntas muy directas, muestra incomodidad o evasión natural. No reveles todo de inmediato; permite que el proceso terapéutico avance naturalmente.",
 "Cognitivo-Conductual": "Eres un paciente simulado para entrenamiento clínico en psicología con orientación cognitivo-conductual. Responde SIEMPRE como paciente, nunca como terapeuta ni como asistente de IA. Muestra pensamientos automáticos negativos, distorsiones cognitivas identificables (catastrofización, lectura de pensamiento, generalización excesiva). Si el estudiante utiliza técnicas TCC apropiadas (registro de pensamientos, reestructuración cognitiva, experimentos conductuales), muestra apertura gradual al cambio. Describe situaciones concretas con pensamientos, emociones y conductas identificables. Mantén coherencia con tu historia.",
 "Humanista": "Eres un paciente simulado para entrenamiento clínico en psicología con orientación humanista. Responde SIEMPRE como paciente, nunca como terapeuta ni como asistente de IA. Muestra incongruencia entre tu yo real y tu yo ideal. Si el estudiante muestra empatía genuina, aceptación incondicional y congruencia, responde abriéndote emocionalmente de manera gradual. Expresa sentimientos en primera persona cuando te sientas escuchado. Muestra momentos de insight cuando la relación terapéutica se fortalece. Mantén coherencia con tu historia de vida.",
}

PROMPT_EVALUACION = """Eres un supervisor experto en psicología clínica. Evalúa la siguiente entrevista clínica realizada por un estudiante. Analiza la transcripción completa.

Evalúa en estas 4 dimensiones (puntuación 1-10 cada una):
1. estructura_preguntas: ¿El estudiante mantuvo una estructura lógica en la entrevista?
2. tecnica_entrevista: ¿Utilizó técnicas apropiadas según su orientación teórica?
3. apertura_emocional: ¿Logró generar un espacio seguro?
4. adecuacion_contexto: ¿Consideró el contexto sociocultural del paciente?

Además, lista 3 fortalezas y 3 áreas de mejora específicas.

RESPONDE ÚNICAMENTE con un JSON válido (sin texto antes ni después, sin bloques de código markdown) con esta estructura exacta:
{"estructura_preguntas":{"puntuacion":7,"comentario":"..."},"tecnica_entrevista":{"puntuacion":6,"comentario":"..."},"apertura_emocional":{"puntuacion":8,"comentario":"..."},"adecuacion_contexto":{"puntuacion":7,"comentario":"..."},"fortalezas":["...","...","..."],"areas_mejora":["...","...","..."]}

REGLAS DE FORMATO ESTRICTAS: cada "comentario" debe tener máximo 20 palabras. NUNCA uses comillas dobles (\") dentro de los textos; si necesitas citar algo usa comillas simples ('). No uses saltos de línea dentro de los valores."""

STUDENT_PERSONA = {
 "novato": "Eres un ESTUDIANTE de psicología PRINCIPIANTE conduciendo una entrevista clínica. Tu desempeño es DEFICIENTE: haces preguntas cerradas y vagas, a veces fuera de lugar, cambias de tema bruscamente, das consejos prematuros, no exploras las emociones y NO aplicas técnicas propias de tu orientación teórica. Habla en primera persona como terapeuta, UNA intervención breve (1-2 frases) por turno. No narres, solo interviene.",
 "intermedio": "Eres un ESTUDIANTE de psicología de NIVEL INTERMEDIO conduciendo una entrevista clínica. Tu desempeño es ACEPTABLE: mantienes cierta estructura, mezclas preguntas abiertas y cerradas, muestras empatía de forma intermitente y aplicas ALGUNAS técnicas de tu orientación, aunque de manera inconsistente. Habla en primera persona como terapeuta, UNA intervención breve (1-2 frases) por turno. No narres, solo interviene.",
 "avanzado": "Eres un ESTUDIANTE de psicología AVANZADO y competente conduciendo una entrevista clínica. Tu desempeño es BUENO: usas preguntas abiertas, escucha reflexiva, exploras el afecto y el contexto sociocultural, y aplicas de forma coherente las técnicas propias de tu orientación teórica. Habla en primera persona como terapeuta, UNA intervención breve (1-2 frases) por turno. No narres, solo interviene.",
}

def call(system, messages, max_tokens=600, retries=4):
    body = json.dumps({"model": MODEL, "max_tokens": max_tokens,
                       "system": system, "messages": messages}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body,
        headers={"content-type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01"})
    for a in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.loads(r.read())
                return d["content"][0]["text"]
        except urllib.error.HTTPError as e:
            if e.code in (429,529,500,503) and a < retries-1:
                time.sleep(2**a + random.random()); continue
            raise
        except Exception:
            if a < retries-1:
                time.sleep(2**a); continue
            raise

def load_cases():
    c = sqlite3.connect("db/clinical.sqlite"); c.row_factory = sqlite3.Row
    out=[]
    for r in c.execute("SELECT * FROM clinical_cases"):
        out.append({k: r[k] for k in ["nombre","edad","genero","motivo","categoria",
            "dificultad","presentacion","contexto","personalidad",
            "antecedentes_medicos","dinamica_familiar"]})
    return out

def run_session(idx, orient, nivel, caso):
    patient_sys = (f"{PROMPTS_ORIENTACION[orient]}\n\nDATOS DEL PACIENTE:\n"
        f"{json.dumps(caso, ensure_ascii=False, indent=2)}\n\n"
        "Responde de manera breve y natural (2-4 oraciones máximo). "
        "Usa lenguaje coloquial colombiano cuando sea apropiado.")
    student_sys = (f"{STUDENT_PERSONA[nivel]}\n\nTu orientación teórica es: {orient}. "
        f"El paciente consulta por: {caso['motivo']}.")
    # historia compartida (texto del paciente y del estudiante)
    convo = [{"role":"assistant","content":caso["presentacion"]}]  # paciente abre
    for _ in range(N_TURNS):
        # estudiante: ve paciente como 'user'
        smsgs = [{"role":("user" if m["role"]=="assistant" else "assistant"),
                  "content":m["content"]} for m in convo]
        student = call(student_sys, smsgs, max_tokens=150).strip()
        convo.append({"role":"user","content":student})
        # paciente: ve estudiante como 'user'
        pmsgs = [{"role":m["role"],"content":m["content"]} for m in convo]
        patient = call(patient_sys, pmsgs, max_tokens=300).strip()
        convo.append({"role":"assistant","content":patient})
    # evaluacion
    transcript = "\n".join(("ESTUDIANTE" if m["role"]=="user" else "PACIENTE")+": "+m["content"]
                           for m in convo)
    evalp = f"ORIENTACIÓN TEÓRICA DEL ESTUDIANTE: {orient}\n\nTRANSCRIPCIÓN:\n{transcript}"
    ev = None
    for attempt in range(3):
        raw = call(PROMPT_EVALUACION, [{"role":"user","content":evalp}], max_tokens=900)
        m = re.search(r"\{[\s\S]*\}", raw)
        if not m:
            continue
        try:
            ev = json.loads(m.group(0)); break
        except json.JSONDecodeError:
            continue
    if ev is None:
        raise ValueError("no se pudo parsear evaluacion JSON tras 3 intentos")
    return {"idx":idx,"orient":orient,"nivel":nivel,"caso":caso["nombre"],
            "turnos":len([x for x in convo if x["role"]=="user"]),
            "eval":ev}

def main():
    cases = load_cases()
    orientaciones = ["Psicoanalítica","Cognitivo-Conductual","Humanista"]
    roster=[]; idx=0
    for orient in orientaciones:
        for i in range(20):
            nivel = random.choices(["novato","intermedio","avanzado"],weights=[0.4,0.4,0.2])[0]
            caso = random.choice(cases)
            roster.append((idx,orient,nivel,caso)); idx+=1
    results=[]; errors=[]
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futs={ex.submit(run_session,*r):r for r in roster}
        for f in as_completed(futs):
            r=futs[f]
            try:
                results.append(f.result()); print(f"ok  {len(results):2d}/60  {r[1][:4]} {r[2]}",flush=True)
            except Exception as e:
                errors.append({"idx":r[0],"err":str(e)}); print(f"ERR {r[0]} {e}",flush=True)
    results.sort(key=lambda x:x["idx"])
    json.dump({"model":MODEL,"n_turns":N_TURNS,"results":results,"errors":errors},
              open(OUT,"w"), ensure_ascii=False, indent=1)
    print(f"\nSaved {len(results)} sessions, {len(errors)} errors -> {OUT}")

if __name__=="__main__":
    main()
