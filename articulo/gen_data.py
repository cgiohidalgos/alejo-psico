import random, statistics as st
random.seed(42)

orientaciones = ["Psicoanalítica", "Cognitivo-Conductual", "Humanista"]
niveles = {"novato": 0, "intermedio": 1, "avanzado": 2}  # competencia latente
dims = ["estructura_preguntas","tecnica_entrevista","apertura_emocional","adecuacion_contexto"]

# 60 estudiantes sinteticos: 20 por orientacion, mezcla de niveles
estudiantes = []
nid = 0
for orient in orientaciones:
    for i in range(20):
        nivel = random.choices(list(niveles), weights=[0.4,0.4,0.2])[0]
        estudiantes.append({"id":nid,"orient":orient,"nivel":nivel})
        nid += 1

def score(base):
    return max(1,min(10, round(random.gauss(base, 1.1))))

rows=[]
for e in estudiantes:
    lvl = niveles[e["nivel"]]
    # base por nivel
    base_pre = 3.5 + lvl*1.4
    base_post = base_pre + random.uniform(1.0, 2.2)  # mejora tras feedback
    pre = {d:score(base_pre + random.uniform(-0.4,0.4)) for d in dims}
    post = {d:score(base_post + random.uniform(-0.4,0.4)) for d in dims}
    rows.append({**e,"pre":pre,"post":post,
                 "turnos":random.randint(8,22)})

def mean_dim(rows, fase, d):
    return st.mean(r[fase][d] for r in rows)

print("N =", len(rows))
print("\n== Medias por dimensión (pre -> post, escala 1-10) ==")
for d in dims:
    pre=mean_dim(rows,"pre",d); post=mean_dim(rows,"post",d)
    print(f"{d:22s} {pre:.2f} -> {post:.2f}  (Δ={post-pre:+.2f})")

print("\n== Media global ==")
allpre=[st.mean(r['pre'].values()) for r in rows]
allpost=[st.mean(r['post'].values()) for r in rows]
print(f"Global pre  M={st.mean(allpre):.2f} SD={st.pstdev(allpre):.2f}")
print(f"Global post M={st.mean(allpost):.2f} SD={st.pstdev(allpost):.2f}")

# d de Cohen (pareado aprox)
diffs=[b-a for a,b in zip(allpre,allpost)]
dz = st.mean(diffs)/st.pstdev(diffs)
print(f"Δ medio={st.mean(diffs):.2f}  Cohen dz≈{dz:.2f}")

print("\n== Post por orientación (media global) ==")
for o in orientaciones:
    sub=[st.mean(r['post'].values()) for r in rows if r['orient']==o]
    print(f"{o:18s} M={st.mean(sub):.2f} SD={st.pstdev(sub):.2f}  n={len(sub)}")

print("\n== Turnos por sesión ==")
turnos=[r['turnos'] for r in rows]
print(f"M={st.mean(turnos):.1f} SD={st.pstdev(turnos):.1f} rango={min(turnos)}-{max(turnos)}")
