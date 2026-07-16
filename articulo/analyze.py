#!/usr/bin/env python3
import json, statistics as st
d = json.load(open("/root/alejo-psico/articulo/sim_results.json"))
R = d["results"]
dims = ["estructura_preguntas","tecnica_entrevista","apertura_emocional","adecuacion_contexto"]
dl = {"estructura_preguntas":"Estructura de las preguntas","tecnica_entrevista":"Técnica de entrevista",
      "apertura_emocional":"Apertura emocional","adecuacion_contexto":"Adecuación al contexto"}

def sc(r,dimn): return r["eval"][dimn]["puntuacion"]
def glob(r): return st.mean(sc(r,dm) for dm in dims)

print(f"N={len(R)}  model={d['model']}  turnos={d['n_turns']} intercambios")
print("\n== Distribución por nivel ==")
for lv in ["novato","intermedio","avanzado"]:
    n=[r for r in R if r["nivel"]==lv]; print(f"  {lv:11s} n={len(n)}")
print("\n== Global por nivel (escala 1-10) ==")
for lv in ["novato","intermedio","avanzado"]:
    g=[glob(r) for r in R if r["nivel"]==lv]
    print(f"  {lv:11s} M={st.mean(g):.2f} DE={st.pstdev(g):.2f}")
gn=[glob(r) for r in R if r["nivel"]=="novato"]; ga=[glob(r) for r in R if r["nivel"]=="avanzado"]
gi=[glob(r) for r in R if r["nivel"]=="intermedio"]
pooled=( (st.pstdev(gn)**2+st.pstdev(ga)**2)/2 )**.5
print(f"\n  d de Cohen novato vs avanzado = {(st.mean(ga)-st.mean(gn))/pooled:.2f}")

print("\n== Tabla: medias por dimensión x nivel ==")
print(f"{'Dimensión':28s} {'Novato':>8s} {'Interm.':>8s} {'Avanz.':>8s}")
for dm in dims:
    row=[st.mean(sc(r,dm) for r in R if r['nivel']==lv) for lv in ['novato','intermedio','avanzado']]
    print(f"{dl[dm]:28s} {row[0]:8.2f} {row[1]:8.2f} {row[2]:8.2f}")

print("\n== Global por orientación ==")
for o in ["Psicoanalítica","Cognitivo-Conductual","Humanista"]:
    g=[glob(r) for r in R if r["orient"]==o]
    print(f"  {o:20s} M={st.mean(g):.2f} DE={st.pstdev(g):.2f} n={len(g)}")

allg=[glob(r) for r in R]
print(f"\n== Global muestra: M={st.mean(allg):.2f} DE={st.pstdev(allg):.2f} min={min(allg):.2f} max={max(allg):.2f}")
print("== Por dimensión (global) ==")
for dm in dims:
    v=[sc(r,dm) for r in R]; print(f"  {dl[dm]:28s} M={st.mean(v):.2f} DE={st.pstdev(v):.2f}")
print(f"\n== Turnos: M={st.mean(r['turnos'] for r in R):.1f}")
