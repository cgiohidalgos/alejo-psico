import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

const DB_PATH = process.env.SQLITE_DB_PATH || './db/clinical.sqlite';
const dbFolder = path.dirname(DB_PATH);

if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder, { recursive: true });
}

export type Role = 'admin' | 'teacher' | 'student' | 'guest';

let db: Database<sqlite3.Database, sqlite3.Statement>;

async function initDb() {
  if (!db) {
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        user_id INTEGER,
        case_id INTEGER,
        estudiante_nombre TEXT,
        orientacion TEXT,
        caso_json TEXT,
        mensajes_json TEXT,
        historia_json TEXT,
        evaluacion_json TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (case_id) REFERENCES clinical_cases(id)
      );

      CREATE TABLE IF NOT EXISTS clinical_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        nombre TEXT NOT NULL,
        edad INTEGER NOT NULL,
        genero TEXT NOT NULL DEFAULT 'otro',
        motivo TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'típico',
        categoria TEXT NOT NULL DEFAULT 'general',
        dificultad TEXT NOT NULL DEFAULT 'intermedio',
        tags_json TEXT NOT NULL DEFAULT '[]',
        objetivos_json TEXT NOT NULL DEFAULT '[]',
        presentacion TEXT NOT NULL,
        contexto TEXT NOT NULL,
        personalidad TEXT NOT NULL DEFAULT '',
        antecedentes_medicos TEXT NOT NULL DEFAULT '',
        dinamica_familiar TEXT NOT NULL DEFAULT '',
        notas_docente TEXT NOT NULL DEFAULT '',
        is_public INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#6b7280',
        icon TEXT NOT NULL DEFAULT 'Brain',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Migraciones
    const userCols = await db.all(`PRAGMA table_info(users)`);
    if (!userCols.find((c: any) => c.name === 'role')) {
      await db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'`);
    }

    const caseCols = await db.all(`PRAGMA table_info(clinical_cases)`);
    const addIfMissing = async (col: string, def: string) => {
      if (!caseCols.find((c: any) => c.name === col)) {
        await db.exec(`ALTER TABLE clinical_cases ADD COLUMN ${col} ${def}`);
      }
    };
    await addIfMissing('genero', "TEXT NOT NULL DEFAULT 'otro'");
    await addIfMissing('categoria', "TEXT NOT NULL DEFAULT 'general'");
    await addIfMissing('category_id', "INTEGER");
    await addIfMissing('dificultad', "TEXT NOT NULL DEFAULT 'intermedio'");
    await addIfMissing('tags_json', "TEXT NOT NULL DEFAULT '[]'");
    await addIfMissing('objetivos_json', "TEXT NOT NULL DEFAULT '[]'");
    await addIfMissing('personalidad', "TEXT NOT NULL DEFAULT ''");
    await addIfMissing('antecedentes_medicos', "TEXT NOT NULL DEFAULT ''");
    await addIfMissing('dinamica_familiar', "TEXT NOT NULL DEFAULT ''");
    await addIfMissing('notas_docente', "TEXT NOT NULL DEFAULT ''");
    await addIfMissing('updated_at', "TEXT NOT NULL DEFAULT ''");

    const sessionCols = await db.all(`PRAGMA table_info(sessions)`);
    if (!sessionCols.find((c: any) => c.name === 'case_id')) {
      await db.exec(`ALTER TABLE sessions ADD COLUMN case_id INTEGER`);
    }

    // Seeds
    await seedAdmin();
    await seedCategories();
    await seedCases();
  }
}

async function seedAdmin() {
  const existing = await db.get(`SELECT id FROM users WHERE email = ?`, 'admin@admin.com');
  if (existing) return;

  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('admin123', 10);
  await db.run(
    `INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)`,
    'Administrador', 'admin@admin.com', hash, 'admin', new Date().toISOString()
  );
  console.log('Seed: usuario admin@admin.com creado (pass: admin123)');
}

async function seedCategories() {
  const now = new Date().toISOString();
  const categories = [
    { slug: 'ansiedad', name: 'Ansiedad', description: 'Trastornos de ansiedad, fobias, ataques de pánico', color: '#f59e0b', icon: 'AlertTriangle' },
    { slug: 'depresion', name: 'Depresión', description: 'Trastornos depresivos, duelo, distimia', color: '#6366f1', icon: 'CloudRain' },
    { slug: 'trauma', name: 'Trauma', description: 'TEPT, trauma complejo, violencia, desplazamiento', color: '#ef4444', icon: 'Shield' },
    { slug: 'adolescencia', name: 'Adolescencia', description: 'Problemas de conducta, identidad, consumo de sustancias en adolescentes', color: '#10b981', icon: 'Users' },
    { slug: 'regulacion-emocional', name: 'Regulación emocional', description: 'Manejo de ira, impulsividad, violencia intrafamiliar', color: '#f97316', icon: 'Flame' },
    { slug: 'pareja', name: 'Relaciones de pareja', description: 'Conflictos de pareja, comunicación, dependencia emocional', color: '#ec4899', icon: 'Heart' },
    { slug: 'adicciones', name: 'Adicciones', description: 'Consumo problemático de sustancias, ludopatía', color: '#8b5cf6', icon: 'Pill' },
    { slug: 'infantil', name: 'Psicología infantil', description: 'Problemas del desarrollo, conducta infantil, TDAH', color: '#14b8a6', icon: 'Baby' },
    { slug: 'laboral', name: 'Psicología laboral', description: 'Burnout, estrés laboral, acoso', color: '#64748b', icon: 'Briefcase' },
    { slug: 'general', name: 'General', description: 'Casos generales no clasificados en otra categoría', color: '#6b7280', icon: 'Brain' },
  ];

  let inserted = 0;
  for (const c of categories) {
    const existing = await db.get(`SELECT id FROM categories WHERE slug = ?`, c.slug);
    if (existing) continue;
    await db.run(
      `INSERT INTO categories (slug, name, description, color, icon, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      c.slug, c.name, c.description, c.color, c.icon, now
    );
    inserted++;
  }
  if (inserted > 0) console.log(`Seed: ${inserted} categorías creadas.`);

  // Migrar casos existentes: asociar category_id según campo "categoria" (texto)
  const casesWithoutCatId = await db.all(`SELECT id, categoria FROM clinical_cases WHERE category_id IS NULL`);
  for (const c of casesWithoutCatId) {
    const cat = await db.get(`SELECT id FROM categories WHERE slug = ?`, c.categoria);
    if (cat) {
      await db.run(`UPDATE clinical_cases SET category_id = ? WHERE id = ?`, cat.id, c.id);
    }
  }
}

async function seedCases() {
  const now = new Date().toISOString();
  const cases = [
    {
      slug: 'maria-gonzalez', nombre: 'María González', edad: 23, genero: 'femenino',
      motivo: 'Dificultades en relaciones sociales',
      tipo: 'típico', categoria: 'ansiedad', dificultad: 'basico',
      tags: ['ansiedad social', 'autoestima', 'relaciones familiares', 'universitaria'],
      objetivos: [
        'Practicar técnicas de rapport con paciente ambivalente',
        'Explorar dinámica familiar y su impacto en autoestima',
        'Identificar patrones de evitación social',
        'Manejar resistencias iniciales del paciente',
      ],
      presentacion: 'Buenas tardes... mi mamá me dijo que viniera porque dice que necesito hablar con alguien. Yo no estoy tan segura, pero bueno, aquí estoy.',
      contexto: 'Estudiante universitaria de 23 años de Pasto, Nariño. Vive con su madre. Reporta dificultades para relacionarse socialmente, evita eventos y reuniones. Tiene tensiones con su madre, quien es exigente y crítica. Presenta insomnio, rumiación nocturna, baja autoestima. Tiene una amiga cercana llamada Laura. Le gusta leer y escribir poesía, pero lo mantiene en secreto. En la infancia sufrió burlas por su forma de hablar. El padre abandonó la familia cuando tenía 8 años. Es resistente a hablar de emociones profundas al inicio. Tiene buen rendimiento académico pero siente que "no encaja". Muestra ambivalencia sobre la terapia: vino por insistencia de la madre.',
      personalidad: 'Introvertida, sensible, inteligente, autocrítica. Usa el humor como defensa. Se muestra desinteresada pero en realidad está asustada. Habla poco al principio, con respuestas cortas. Se abre gradualmente si percibe empatía genuina.',
      antecedentes_medicos: 'Sin antecedentes médicos significativos. Insomnio de 6 meses de evolución. No consume medicamentos. Niega consumo de sustancias.',
      dinamica_familiar: 'Madre sobreprotectora y exigente. Padre ausente desde los 8 años. No tiene hermanos. Relación conflictiva con la madre: la ama pero se siente asfixiada. La madre quiere que sea abogada; María prefiere la literatura.',
      notas_docente: 'Caso ideal para primeras entrevistas. Permite practicar: manejo de ambivalencia, preguntas abiertas, silencio terapéutico. La resistencia es leve y cede con buen rapport. Observar si el estudiante respeta el ritmo del paciente.',
    },
    {
      slug: 'carlos-rodriguez', nombre: 'Carlos Rodríguez', edad: 42, genero: 'masculino',
      motivo: 'No puede dormir y nerviosismo constante',
      tipo: 'contextualizado', categoria: 'trauma', dificultad: 'avanzado',
      tags: ['TEPT', 'desplazamiento', 'violencia', 'consumo de alcohol', 'contexto rural'],
      objetivos: [
        'Abordar trauma en contexto de conflicto armado colombiano',
        'Manejar desconfianza institucional del paciente',
        'Trabajar con eufemismos y comunicación indirecta',
        'Evaluar riesgo por consumo de alcohol',
        'Considerar determinantes sociales de salud',
      ],
      presentacion: 'Buenos días, doctor... o doctora. Disculpe, es que me mandaron de la EPS. Yo no sé muy bien qué es esto de psicología, pero me dijeron que me podía ayudar.',
      contexto: 'Hombre de 42 años, desplazado de Samaniego, Nariño, por violencia armada hace 3 años. Vive en Pasto con su esposa e hija de 12 años en condiciones económicas difíciles. Trabaja en construcción informal. Presenta pesadillas recurrentes sobre hechos violentos, irritabilidad, hipervigilancia, consumo problemático de alcohol los fines de semana. Tiene desconfianza hacia instituciones y personas desconocidas. Muestra resistencia a hablar de la violencia directamente, usa eufemismos como "lo que pasó" o "cuando nos tocó salir". Tiene dolor crónico en espalda por trabajo pesado. Fue líder comunitario en su vereda antes del desplazamiento. La hija tiene dificultades escolares y la esposa presenta síntomas depresivos. Carlos siente culpa por no poder proteger a su familia. Desconoce qué es un psicólogo y confunde con psiquiatra. Es respetuoso pero hermético.',
      personalidad: 'Reservado, desconfiado al inicio, orgulloso, trabajador. Habla con respeto excesivo ("doctor", "sumercé"). Evita contacto visual al hablar de temas dolorosos. Se emociona brevemente pero se recompone rápido. Valora la honestidad y la sencillez.',
      antecedentes_medicos: 'Dolor crónico lumbar. Consumo problemático de alcohol (aguardiente los fines de semana). Posible hipertensión no tratada. No asiste a controles médicos por desconfianza y falta de recursos.',
      dinamica_familiar: 'Esposa (Rosa, 38 años) con síntomas depresivos. Hija (Valentina, 12 años) con dificultades escolares y conducta retraída. Carlos es proveedor principal. Antes del desplazamiento era respetado como líder comunitario. Siente que ha perdido su identidad y propósito.',
      notas_docente: 'Caso de alta complejidad. Requiere sensibilidad cultural y conocimiento del contexto colombiano de conflicto armado. Evaluar si el estudiante: respeta los tiempos del paciente, no fuerza narrativa del trauma, reconoce determinantes sociales, maneja la transferencia institucional negativa. No es apropiado para estudiantes de primer semestre.',
    },
    {
      slug: 'lucia-herrera', nombre: 'Lucía Herrera', edad: 35, genero: 'femenino',
      motivo: 'Episodios de llanto incontrolable y pérdida de interés',
      tipo: 'típico', categoria: 'depresion', dificultad: 'intermedio',
      tags: ['depresión', 'duelo', 'maternidad', 'relación de pareja', 'pérdida'],
      objetivos: [
        'Evaluar sintomatología depresiva y su severidad',
        'Explorar duelo no resuelto',
        'Identificar factores de riesgo y protección',
        'Diferenciar depresión clínica de duelo normal',
        'Evaluar ideación suicida con tacto y profesionalismo',
      ],
      presentacion: 'Hola... perdón, es que no sé ni por dónde empezar. Llevo semanas sin poder levantarme de la cama y ya no puedo más.',
      contexto: 'Mujer de 35 años, contadora de profesión, en licencia laboral desde hace 1 mes. Perdió a su madre hace 4 meses por cáncer de páncreas, tras 8 meses de ser su cuidadora principal. Tiene un hijo de 5 años (Matías). Esposo (Andrés) se queja de que ella "ya no es la misma". Presenta anhedonia, hipersomnia, llanto frecuente, pérdida de apetito (-7 kg), dificultad de concentración, culpa por "no haber hecho más" por su madre. Ha dejado de llevar al niño al parque, delega todo en el esposo. Antes del duelo era una persona activa, organizada y sociable. Tiene una hermana menor (Catalina) con quien tiene tensiones porque siente que no ayudó durante la enfermedad de la madre. No tiene ideación suicida activa pero ha tenido pensamientos de "para qué sigo aquí".',
      personalidad: 'Perfeccionista, responsable, exigente consigo misma. Llora fácilmente en sesión pero se disculpa por hacerlo. Intenta mostrarse "fuerte" pero se quiebra. Es articulada y colaboradora, pero agotada emocionalmente. Tiene insight parcial sobre su estado.',
      antecedentes_medicos: 'Tiroides controlada con levotiroxina. Pérdida de peso significativa reciente. Médico general le recetó sertralina hace 2 semanas que aún no ha empezado a tomar "porque no quiero depender de pastillas".',
      dinamica_familiar: 'Esposo Andrés: preocupado pero impaciente, la presiona para "volver a la normalidad". Hijo Matías: ha empezado a tener pesadillas y se muestra pegajoso. Hermana Catalina: relación tensa, Lucía siente resentimiento por falta de apoyo durante la enfermedad de la madre. Padre falleció cuando tenía 15 años (infarto).',
      notas_docente: 'Caso para practicar evaluación de depresión mayor con duelo complicado. Puntos clave: evaluar ideación suicida de forma ética, explorar la ambivalencia con la medicación, trabajar la culpa del sobreviviente. El estudiante debe mostrar sensibilidad con el duelo sin apresurar el proceso. Evaluar si diferencia duelo normal de depresión clínica.',
    },
    {
      slug: 'santiago-muñoz', nombre: 'Santiago Muñoz', edad: 17, genero: 'masculino',
      motivo: 'Problemas de conducta en el colegio y conflictos en casa',
      tipo: 'contextualizado', categoria: 'adolescencia', dificultad: 'intermedio',
      tags: ['adolescencia', 'conducta', 'identidad', 'bullying', 'divorcio parental'],
      objetivos: [
        'Establecer alianza terapéutica con adolescente no voluntario',
        'Distinguir entre acting-out y expresión emocional legítima',
        'Explorar identidad y autonomía en la adolescencia',
        'Manejar el encuadre con paciente menor de edad',
        'Trabajar con información de múltiples fuentes (colegio, padres)',
      ],
      presentacion: '... ¿Qué? ¿Yo tengo que hablar? Es que esto fue idea de mi mamá y del rector. Yo estoy bien, los que tienen problemas son ellos.',
      contexto: 'Adolescente de 17 años, estudiante de grado 11 en colegio privado de Cali. Remitido por el colegio por peleas frecuentes y bajo rendimiento (de ser buen estudiante a perder 4 materias). Padres divorciados hace 2 años. Vive con la madre y su nuevo compañero (Jorge). Visita al padre cada quince días. La madre reporta que se ha vuelto "agresivo e irrespetuoso". En realidad, Santiago sufre bullying por parte de compañeros que se burlan de la situación económica de su padre (el divorcio lo dejó en peores condiciones). Ha empezado a consumir marihuana esporádicamente con amigos del barrio. Tiene talento para el dibujo y los videojuegos pero lo esconde en el colegio por temor a burlas. Se siente atrapado entre dos mundos: el del colegio "de ricos" y el barrio del papá.',
      personalidad: 'Defensivo, sarcástico, desafiante con figuras de autoridad. Pero debajo hay un adolescente sensible, confundido e inseguro. Prueba límites constantemente. Si percibe que el terapeuta lo trata como "otro adulto más que quiere controlarlo", se cierra. Si percibe autenticidad y que no lo juzgan, baja la guardia lentamente. Usa memes y referencias a videojuegos.',
      antecedentes_medicos: 'Sin antecedentes relevantes. Consume marihuana 1-2 veces por semana hace 3 meses. Patrón de sueño irregular (se duerme a las 3am jugando).',
      dinamica_familiar: 'Madre (Patricia, 44): ansiosa, culpable por el divorcio, sobrecompensa con permisividad y luego estalla. Padrastro (Jorge, 40): intenta poner límites pero Santiago lo rechaza ("usted no es mi papá"). Padre (Ricardo, 46): deprimido, vive en un apartamento pequeño, emocionalmente ausente. Santiago lo idealiza y al mismo tiempo le tiene rabia por "dejarse quitar todo".',
      notas_docente: 'Caso para trabajo con adolescentes. Desafío principal: establecer alianza sin perder el encuadre profesional. El estudiante debe evitar: ponerse del lado de los padres, ser moralista con el consumo, tratar al paciente como niño. Evaluar si el estudiante logra ver más allá de la conducta disruptiva. Caso útil para discutir confidencialidad con menores y manejo de consumo de sustancias.',
    },
    {
      slug: 'elena-castro', nombre: 'Elena Castro', edad: 58, genero: 'femenino',
      motivo: 'Ataques de pánico desde que se jubiló',
      tipo: 'típico', categoria: 'ansiedad', dificultad: 'intermedio',
      tags: ['pánico', 'jubilación', 'nido vacío', 'somatización', 'identidad'],
      objetivos: [
        'Evaluar y psicoeducar sobre ataques de pánico',
        'Explorar la pérdida de identidad asociada a la jubilación',
        'Diferenciar síntomas de pánico de problemas cardíacos',
        'Trabajar con paciente que somatiza',
        'Abordar la transición vital y el síndrome del nido vacío',
      ],
      presentacion: 'Buenas tardes. Mire, yo vengo porque mi cardiólogo dice que no tengo nada en el corazón, pero yo sé que algo me pasa. Me da una cosa horrible en el pecho, se me duerme el brazo, y siento que me voy a morir. Eso no es normal.',
      contexto: 'Mujer de 58 años, se jubiló hace 6 meses de su cargo como directora de un colegio público donde trabajó 30 años. Los ataques de pánico empezaron 2 meses después de jubilarse. Ha ido a urgencias 4 veces creyendo que es un infarto. Todos los exámenes salen normales. Vive sola desde que sus dos hijos se fueron: el mayor (Diego, 30) vive en Bogotá y la menor (Camila, 27) se fue a estudiar a España hace 1 año. Fue una mujer activa, respetada, líder. Ahora siente que "no sirve para nada". Esposo falleció hace 8 años. Tiene buenas amigas pero ha dejado de verlas porque "para qué me van a ver así". Presenta también insomnio de mantenimiento, tensión muscular crónica, e hipervigilancia sobre sensaciones corporales.',
      personalidad: 'Controladora, estructurada, acostumbrada a tener todo bajo control. Le cuesta pedir ayuda. Es directa y articulada. Tiene un humor seco. Minimiza sus emociones ("yo no soy de esas que lloran por todo"). Es escéptica sobre la psicología pero desesperada porque nada médico le ha funcionado. Si el terapeuta la escucha sin condescendencia, colabora activamente.',
      antecedentes_medicos: 'Hipertensión controlada. Colesterol alto tratado. 4 visitas a urgencias por presunto infarto (todas descartadas). Electrocardiograma, ecocardiograma y prueba de esfuerzo normales. Toma enalapril y atorvastatina.',
      dinamica_familiar: 'Viuda desde hace 8 años (esposo murió de cáncer de colon). Hijo Diego (30): poco comunicativo, llama 1 vez por semana. Hija Camila (27): en España, la llama seguido pero Elena no quiere "preocuparla". Tiene un grupo de amigas del colegio con quienes se está distanciando.',
      notas_docente: 'Caso para trabajar la interfaz entre lo somático y lo psicológico. El estudiante debe: validar los síntomas físicos sin reforzar la somatización, psicoeducar sobre pánico, explorar el significado de la jubilación y la pérdida de rol. No caer en el error de decir "es solo ansiedad". Caso útil para discutir trabajo interdisciplinar con médicos.',
    },
    {
      slug: 'andres-villamizar', nombre: 'Andrés Villamizar', edad: 28, genero: 'masculino',
      motivo: 'Problemas de pareja y dificultad para controlar la ira',
      tipo: 'contextualizado', categoria: 'regulacion-emocional', dificultad: 'avanzado',
      tags: ['ira', 'regulación emocional', 'violencia intrafamiliar', 'masculinidad', 'pareja'],
      objetivos: [
        'Evaluar riesgo de violencia intrafamiliar',
        'Trabajar con un paciente que minimiza su conducta',
        'Explorar modelos de masculinidad y su impacto emocional',
        'Manejar la contratransferencia ante conductas de control',
        'Distinguir entre manejo de ira y violencia de género',
      ],
      presentacion: 'Bueno, a ver... Yo estoy aquí porque mi novia me dijo que si no venía me dejaba. Pero yo no soy violento ni nada de eso, solo que a veces me descontrolo un poquito.',
      contexto: 'Hombre de 28 años, ingeniero de sistemas, trabaja en una empresa de tecnología en Medellín. Su novia (Daniela, 26) le dio un ultimátum después de que él rompió un plato contra la pared durante una discusión. Reporta que "solo fue una vez" pero en la historia emergen patrones: gritos frecuentes, revisar el celular de Daniela, controlar con quién sale, usar el silencio como castigo. Creció en un hogar donde el padre le pegaba a la madre "cuando se lo buscaba" — lo normaliza. Tiene un hermano menor que cortó contacto con la familia. En el trabajo es funcional y exitoso, pero en casa se transforma. Bebe cerveza los viernes con amigos y los conflictos suelen ocurrir cuando regresa. Siente que Daniela "lo provoca" y que él "solo reacciona". No reconoce sus conductas como problemáticas plenamente.',
      personalidad: 'Encantador y articulado. Inteligente, usa la lógica para justificar su conducta. Minimiza, racionaliza y externaliza la responsabilidad. Puede mostrarse colaborador pero en realidad busca que el terapeuta valide su posición. Se irrita si percibe que lo están juzgando o si le señalan inconsistencias. Debajo de la fachada hay inseguridad, miedo al abandono y un modelo masculino rígido.',
      antecedentes_medicos: 'Sin antecedentes significativos. Consumo social de alcohol (cerveza los viernes, ocasionalmente excesivo). Reporta bruxismo y dolor de cabeza frecuente.',
      dinamica_familiar: 'Padre (Pedro, 55): maltratador, Andrés lo admira profesionalmente pero evita hablar de la violencia. Madre (Carmen, 53): sumisa, llamadas frecuentes, Andrés es "su orgullo". Hermano (Tomás, 24): cortó contacto con la familia, vive en Canadá. Novia Daniela: ha empezado terapia por su cuenta. Llevan 3 años juntos.',
      notas_docente: 'Caso de alta complejidad ética. El estudiante DEBE evaluar riesgo para Daniela. No debe convertirse en cómplice de la minimización. Puntos clave: identificar ciclo de violencia, no confundir "manejo de ira" con la problemática de fondo, manejar la contratransferencia (puede generar rabia o fascinación). Discutir obligaciones de reporte y límites de confidencialidad. NO es un caso de simple "control de impulsos".',
    },
  ];

  let inserted = 0;
  for (const c of cases) {
    const existing = await db.get(`SELECT id FROM clinical_cases WHERE slug = ?`, c.slug);
    if (existing) continue;
    await db.run(
      `INSERT INTO clinical_cases (slug, nombre, edad, genero, motivo, tipo, categoria, dificultad, tags_json, objetivos_json, presentacion, contexto, personalidad, antecedentes_medicos, dinamica_familiar, notas_docente, is_public, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      c.slug, c.nombre, c.edad, c.genero, c.motivo, c.tipo, c.categoria, c.dificultad,
      JSON.stringify(c.tags), JSON.stringify(c.objetivos),
      c.presentacion, c.contexto, c.personalidad, c.antecedentes_medicos,
      c.dinamica_familiar, c.notas_docente, now, now
    );
    inserted++;
  }
  if (inserted > 0) console.log(`Seed: ${inserted} casos clínicos creados.`);
}

// ==================== SESSIONS ====================

export const insertSession = async (session: {
  user_id?: number;
  case_id?: number;
  estudiante_nombre?: string;
  orientacion?: string;
  caso: unknown;
  mensajes: unknown;
  historia?: unknown;
  evaluacion?: unknown;
}) => {
  await initDb();
  const result = await db.run(
    `INSERT INTO sessions
      (created_at, user_id, case_id, estudiante_nombre, orientacion, caso_json, mensajes_json, historia_json, evaluacion_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    new Date().toISOString(),
    session.user_id || null,
    session.case_id || null,
    session.estudiante_nombre || null,
    session.orientacion || null,
    JSON.stringify(session.caso),
    JSON.stringify(session.mensajes),
    session.historia ? JSON.stringify(session.historia) : null,
    session.evaluacion ? JSON.stringify(session.evaluacion) : null
  );
  return result.lastID;
};

const parseSession = (row: any) => ({
  ...row,
  caso: row.caso_json ? JSON.parse(row.caso_json) : null,
  mensajes: row.mensajes_json ? JSON.parse(row.mensajes_json) : [],
  historia: row.historia_json ? JSON.parse(row.historia_json) : null,
  evaluacion: row.evaluacion_json ? JSON.parse(row.evaluacion_json) : null,
});

export const listSessions = async () => {
  await initDb();
  const rows = await db.all(`SELECT * FROM sessions ORDER BY created_at DESC`);
  return rows.map(parseSession);
};

export const getSession = async (id: number) => {
  await initDb();
  const row = await db.get(`SELECT * FROM sessions WHERE id = ?`, id);
  if (!row) return null;
  return parseSession(row);
};

export const listSessionsByUser = async (userId: number) => {
  await initDb();
  const rows = await db.all(`SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC`, userId);
  return rows.map(parseSession);
};

// ==================== USERS ====================

export const createUser = async (user: {name: string; email: string; password_hash: string; role?: Role}) => {
  await initDb();
  const result = await db.run(
    `INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)`,
    user.name, user.email, user.password_hash, user.role || 'student', new Date().toISOString()
  );
  return result.lastID;
};

export const getUserByEmail = async (email: string) => {
  await initDb();
  return db.get(`SELECT * FROM users WHERE email = ?`, email);
};

export const getUserById = async (id: number) => {
  await initDb();
  return db.get(`SELECT * FROM users WHERE id = ?`, id);
};

export const listUsers = async () => {
  await initDb();
  return db.all(`SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC`);
};

export const updateUserRole = async (id: number, role: Role) => {
  await initDb();
  await db.run(`UPDATE users SET role = ? WHERE id = ?`, role, id);
};

export const deleteUser = async (id: number) => {
  await initDb();
  await db.run(`DELETE FROM sessions WHERE user_id = ?`, id);
  await db.run(`DELETE FROM users WHERE id = ?`, id);
};

export const updateUser = async (id: number, data: { name?: string; email?: string; role?: Role }) => {
  await initDb();
  const sets: string[] = [];
  const vals: any[] = [];
  if (data.name) { sets.push('name = ?'); vals.push(data.name); }
  if (data.email) { sets.push('email = ?'); vals.push(data.email); }
  if (data.role) { sets.push('role = ?'); vals.push(data.role); }
  if (sets.length === 0) return;
  vals.push(id);
  await db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...vals);
};

// ==================== CLINICAL CASES ====================

const parseCase = (row: any) => ({
  ...row,
  tags: row.tags_json ? JSON.parse(row.tags_json) : [],
  objetivos: row.objetivos_json ? JSON.parse(row.objetivos_json) : [],
  is_public: !!row.is_public,
});

export const listClinicalCases = async (includePrivate = false) => {
  await initDb();
  const where = includePrivate ? '' : 'WHERE is_public = 1';
  const rows = await db.all(`SELECT * FROM clinical_cases ${where} ORDER BY created_at DESC`);
  return rows.map(parseCase);
};

export const getClinicalCase = async (id: number) => {
  await initDb();
  const row = await db.get(`SELECT * FROM clinical_cases WHERE id = ?`, id);
  if (!row) return null;
  return parseCase(row);
};

export const getClinicalCaseBySlug = async (slug: string) => {
  await initDb();
  const row = await db.get(`SELECT * FROM clinical_cases WHERE slug = ?`, slug);
  if (!row) return null;
  return parseCase(row);
};

export const createClinicalCase = async (c: {
  slug: string; nombre: string; edad: number; genero?: string; motivo: string;
  tipo?: string; categoria?: string; dificultad?: string;
  tags?: string[]; objetivos?: string[];
  presentacion: string; contexto: string;
  personalidad?: string; antecedentes_medicos?: string;
  dinamica_familiar?: string; notas_docente?: string;
  is_public?: boolean; created_by?: number;
}) => {
  await initDb();
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO clinical_cases (slug, nombre, edad, genero, motivo, tipo, categoria, dificultad, tags_json, objetivos_json, presentacion, contexto, personalidad, antecedentes_medicos, dinamica_familiar, notas_docente, is_public, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    c.slug, c.nombre, c.edad, c.genero || 'otro', c.motivo,
    c.tipo || 'típico', c.categoria || 'general', c.dificultad || 'intermedio',
    JSON.stringify(c.tags || []), JSON.stringify(c.objetivos || []),
    c.presentacion, c.contexto,
    c.personalidad || '', c.antecedentes_medicos || '',
    c.dinamica_familiar || '', c.notas_docente || '',
    (c.is_public ?? true) ? 1 : 0, c.created_by || null, now, now
  );
  return result.lastID;
};

export const updateClinicalCase = async (id: number, c: Record<string, any>) => {
  await initDb();
  const sets: string[] = [];
  const vals: any[] = [];
  const jsonFields = ['tags', 'objetivos'];
  const boolFields = ['is_public'];

  for (const [k, v] of Object.entries(c)) {
    if (v === undefined) continue;
    if (jsonFields.includes(k)) {
      sets.push(`${k}_json = ?`);
      vals.push(JSON.stringify(v));
    } else if (boolFields.includes(k)) {
      sets.push(`${k} = ?`);
      vals.push(v ? 1 : 0);
    } else {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  vals.push(new Date().toISOString());
  vals.push(id);
  await db.run(`UPDATE clinical_cases SET ${sets.join(', ')} WHERE id = ?`, ...vals);
};

export const deleteClinicalCase = async (id: number) => {
  await initDb();
  await db.run(`DELETE FROM clinical_cases WHERE id = ?`, id);
};

export const duplicateClinicalCase = async (id: number, newSlug: string) => {
  await initDb();
  const original = await db.get(`SELECT * FROM clinical_cases WHERE id = ?`, id);
  if (!original) return null;
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO clinical_cases (slug, nombre, edad, genero, motivo, tipo, categoria, dificultad, tags_json, objetivos_json, presentacion, contexto, personalidad, antecedentes_medicos, dinamica_familiar, notas_docente, is_public, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newSlug, original.nombre + ' (copia)', original.edad, original.genero, original.motivo,
    original.tipo, original.categoria, original.dificultad,
    original.tags_json, original.objetivos_json,
    original.presentacion, original.contexto,
    original.personalidad, original.antecedentes_medicos,
    original.dinamica_familiar, original.notas_docente,
    original.is_public, original.created_by, now, now
  );
  return result.lastID;
};

// ==================== CASE STATS ====================

export const getCaseStats = async (caseId: number) => {
  await initDb();
  const stats = await db.get(`
    SELECT
      COUNT(*) as total_sessions,
      COUNT(evaluacion_json) as total_evaluated
    FROM sessions WHERE case_id = ?
  `, caseId);

  return { ...stats, case_id: caseId };
};

export const getAllCaseStats = async () => {
  await initDb();
  const rows = await db.all(`
    SELECT
      case_id,
      COUNT(*) as total_sessions,
      COUNT(evaluacion_json) as total_evaluated
    FROM sessions
    WHERE case_id IS NOT NULL
    GROUP BY case_id
  `);

  // Calculate average scores per case
  const result: Record<number, any> = {};
  for (const row of rows) {
    const evalRows = await db.all(`
      SELECT evaluacion_json FROM sessions
      WHERE case_id = ? AND evaluacion_json IS NOT NULL
    `, row.case_id);

    let sumScore = 0;
    let countScore = 0;
    for (const er of evalRows) {
      try {
        const ev = JSON.parse(er.evaluacion_json);
        const dims = [ev.estructura_preguntas, ev.tecnica_entrevista, ev.apertura_emocional, ev.adecuacion_contexto];
        const scores = dims.filter((d: any) => d?.puntuacion).map((d: any) => d.puntuacion);
        if (scores.length > 0) {
          sumScore += scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
          countScore++;
        }
      } catch {}
    }

    result[row.case_id] = {
      total_sessions: row.total_sessions,
      total_evaluated: row.total_evaluated,
      avg_score: countScore > 0 ? (sumScore / countScore).toFixed(1) : null,
    };
  }
  return result;
};

// ==================== CONFIG ====================

export const getConfig = async (key: string) => {
  await initDb();
  const row = await db.get(`SELECT value FROM config WHERE key = ?`, key);
  return row ? row.value : null;
};

export const setConfig = async (key: string, value: string) => {
  await initDb();
  await db.run(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, key, value);
};

export const listConfig = async () => {
  await initDb();
  return db.all(`SELECT * FROM config`);
};
