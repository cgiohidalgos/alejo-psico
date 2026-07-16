#!/usr/bin/env python3
"""Produce manuscrito_final.md: quita avisos/notas editoriales para una versión de envío."""
import re
src=open("/root/alejo-psico/articulo/manuscrito.md").read().split("\n")
out=[]
skip_block=False
for ln in src:
    s=ln.strip()
    # quitar blockquotes (avisos/notas)
    if s.startswith(">"):
        continue
    # quitar bloque de andamiaje de fuentes latinoamericanas y sus viñetas
    if s.startswith("**Fuentes latinoamericanas."):
        skip_block=True
        continue
    if skip_block:
        if s.startswith("- [") or s=="" :
            # seguir saltando viñetas y blanco intermedio
            if s.startswith("- ["):
                continue
            else:
                skip_block=False
                # no añadimos el blanco extra
                continue
        else:
            skip_block=False
    # quitar viñetas-placeholder sueltas
    if s.startswith("- ["):
        continue
    # quitar nota de palabras clave (línea italic completa)
    if s.startswith("*(Términos alineados"):
        continue
    # quitar línea de Agradecimientos placeholder
    if s.startswith("**Agradecimientos.**"):
        continue
    out.append(ln)

txt="\n".join(out)
# limpiezas inline
txt=txt.replace(" *(38 caracteres; máx. 40)*","")
txt=txt.replace(" *(firmar siempre igual; registrar firma en IraLIS y ORCID).*","")
txt=re.sub(r" \*\(Si hubo financiación.*?\)\*","",txt)
txt=txt.replace(" [completar con fuentes latinoamericanas adicionales sobre prácticas clínicas y supervisión]","")
txt=txt.replace("¹ [Afiliación: institución que financió o apoyó la investigación; dirección postal; teléfono; correo; web]. ORCID: [____].","¹ [Afiliación, ciudad, país]. ORCID: [____].")
# colapsar líneas en blanco triples
txt=re.sub(r"\n{3,}","\n\n",txt)
open("/root/alejo-psico/articulo/manuscrito_final.md","w").write(txt)
print("manuscrito_final.md escrito. Líneas:", txt.count(chr(10)))
