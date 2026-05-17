import { db, schema } from './index.ts';

const TOPICS = [
  { slug: 'macroeconomia', name: 'Macroeconomía', description: 'Inflación, crecimiento, desempleo, ciclos.', sortOrder: 10 },
  { slug: 'politica-monetaria', name: 'Política monetaria', description: 'Bancos centrales, tasas, dinero.', sortOrder: 20 },
  { slug: 'politica-fiscal', name: 'Política fiscal', description: 'Impuestos, gasto público, deuda.', sortOrder: 30 },
  { slug: 'comercio-internacional', name: 'Comercio internacional', description: 'Aranceles, integración, balanza.', sortOrder: 40 },
  { slug: 'desarrollo', name: 'Desarrollo y desigualdad', description: 'Pobreza, distribución, instituciones.', sortOrder: 50 },
  { slug: 'sistemas-electorales', name: 'Sistemas electorales', description: 'Reglas, representación, partidos.', sortOrder: 60 },
  { slug: 'instituciones', name: 'Instituciones y estado de derecho', description: 'División de poderes, justicia, constitución.', sortOrder: 70 },
  { slug: 'geopolitica', name: 'Geopolítica', description: 'Bloques, conflictos, relaciones internacionales.', sortOrder: 80 },
  { slug: 'energia-y-recursos', name: 'Energía y recursos', description: 'Transición energética, materias primas.', sortOrder: 90 },
  { slug: 'tecnologia-y-poder', name: 'Tecnología y poder', description: 'Plataformas, IA, regulación.', sortOrder: 100 },
];

const COUNTRIES = [
  { slug: 'global', name: 'Global / sin país', sortOrder: 0 },
  { slug: 'argentina', name: 'Argentina', sortOrder: 10 },
  { slug: 'brasil', name: 'Brasil', sortOrder: 20 },
  { slug: 'chile', name: 'Chile', sortOrder: 30 },
  { slug: 'colombia', name: 'Colombia', sortOrder: 40 },
  { slug: 'mexico', name: 'México', sortOrder: 50 },
  { slug: 'peru', name: 'Perú', sortOrder: 60 },
  { slug: 'uruguay', name: 'Uruguay', sortOrder: 70 },
  { slug: 'venezuela', name: 'Venezuela', sortOrder: 80 },
  { slug: 'estados-unidos', name: 'Estados Unidos', sortOrder: 100 },
  { slug: 'union-europea', name: 'Unión Europea', sortOrder: 110 },
  { slug: 'china', name: 'China', sortOrder: 120 },
  { slug: 'rusia', name: 'Rusia', sortOrder: 130 },
];

await db.insert(schema.topics).values(TOPICS).onConflictDoNothing({ target: schema.topics.slug });
await db.insert(schema.countries).values(COUNTRIES).onConflictDoNothing({ target: schema.countries.slug });

console.log(`Seeded ${TOPICS.length} topics and ${COUNTRIES.length} countries.`);
process.exit(0);
