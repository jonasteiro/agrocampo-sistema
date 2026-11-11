// ============================================================================
// Armazenamento em Nuvem Isolado por Conta de Produtor e Controle de Rede
// ============================================================================

const DB_KEY = "agrocampo_cloud_db_v1";
const RECORD_LIMIT_PER_USER = 200;

let isSimulatedOffline = false;
let currentProducerEmail = null;
let currentCropId = null;

const CROP_MODELS = {
  soja: {
    safraName: "Safra 2026/2027 — Talhão 01 (Soja)",
    species: "Soja (Glycine max) — Ciclo Semiprecoce",
    cycleDays: 120,
    idealWindow: "Outubro a Dezembro (Início das chuvas regulares e solo aquecido)",
    waterTolerance: "Alta exigência hídrica na germinação e no enchimento de grãos",
    moisturePlantingMin: 55,
    moisturePlantingMax: 80,
    moistureDevMin: 60,
    moistureDevMax: 85,
    moistureHarvestMin: 40,
    moistureHarvestMax: 65,
    tempMin: 20,
    tempMax: 32,
    physiologyNotes: "Requer boa umidade no solo para emergência uniforme e enchimento de vagens, além de período seco na maturação para colheita sem avarias."
  },
  milho: {
    safraName: "Safra 2026/2027 — Talhão 02 (Milho)",
    species: "Milho (Zea mays) — Híbrido Simples",
    cycleDays: 135,
    idealWindow: "Setembro a Novembro (Safra Verão) ou Janeiro a Fevereiro (Segunda Safra)",
    waterTolerance: "Alta exigência hídrica no pendoamento e espigamento",
    moisturePlantingMin: 55,
    moisturePlantingMax: 82,
    moistureDevMin: 62,
    moistureDevMax: 85,
    moistureHarvestMin: 38,
    moistureHarvestMax: 62,
    tempMin: 18,
    tempMax: 33,
    physiologyNotes: "Planta com alta demanda por radiação solar e sensível a déficits hídricos durante a polinização e formação de grãos."
  },
  feijao: {
    safraName: "Safra 2026/2027 — Talhão 03 (Feijão)",
    species: "Feijão Carioca (Phaseolus vulgaris) — Ciclo Curto",
    cycleDays: 90,
    idealWindow: "Setembro a Novembro (Águas) ou Fevereiro a Março (Seca)",
    waterTolerance: "Sensível ao encharcamento prolongado e a geadas",
    moisturePlantingMin: 50,
    moisturePlantingMax: 75,
    moistureDevMin: 55,
    moistureDevMax: 78,
    moistureHarvestMin: 35,
    moistureHarvestMax: 58,
    tempMin: 18,
    tempMax: 30,
    physiologyNotes: "Ciclo curto de 90 dias. Sensível a excesso de chuva próximo à colheita e à falta de água na florada."
  },
  trigo: {
    safraName: "Safra Inverno 2026 — Talhão Sul (Trigo)",
    species: "Trigo (Triticum aestivum) — Classe Pão",
    cycleDays: 120,
    idealWindow: "Abril a Junho (Período de Outono/Inverno)",
    waterTolerance: "Sensível ao encharcamento prolongado e geadas na floração",
    moisturePlantingMin: 50,
    moisturePlantingMax: 76,
    moistureDevMin: 52,
    moistureDevMax: 78,
    moistureHarvestMin: 35,
    moistureHarvestMax: 55,
    tempMin: 10,
    tempMax: 25,
    physiologyNotes: "Exige temperaturas amenas no perfilhamento e tempo seco na maturação para preservar a qualidade industrial do grão."
  },
  cafe: {
    safraName: "Safra 2026/2027 — Talhão Alto (Café Arábica)",
    species: "Café Arábica (Coffea arabica) — Catuaí",
    cycleDays: 210,
    idealWindow: "Outubro a Dezembro (Período chuvoso e térmico ameno)",
    waterTolerance: "Exigência moderada com boa tolerância a estiagens curtas",
    moisturePlantingMin: 55,
    moisturePlantingMax: 80,
    moistureDevMin: 58,
    moistureDevMax: 82,
    moistureHarvestMin: 40,
    moistureHarvestMax: 60,
    tempMin: 17,
    tempMax: 28,
    physiologyNotes: "Sensível a geadas severas e temperaturas acima de 32°C durante a florada. Colheita favorecida por tempo seco."
  }
};

function createDefaultDatabase() {
  const demoEmail = "produtor@agrocampo.com.br";
  const initialDB = {
    users: {
      [demoEmail]: {
        name: "Fazenda Boa Esperança (Produtor Demonstração)",
        email: demoEmail,
        password: "safra2026",
        crops: [
          {
            id: "safra_soja_01",
            safraName: "Safra 2026/2027 — Talhão 01 (Soja em Desenvolvimento)",
            species: "Soja (Glycine max) — Ciclo Semiprecoce",
            cycleDays: 120,
            idealWindow: "Outubro a Dezembro (Início das chuvas regulares)",
            waterTolerance: "Alta exigência hídrica na germinação e no enchimento de grãos",
            moisturePlantingMin: 55,
            moisturePlantingMax: 80,
            moistureDevMin: 60,
            moistureDevMax: 85,
            moistureHarvestMin: 40,
            moistureHarvestMax: 65,
            tempMin: 20,
            tempMax: 32,
            physiologyNotes: "Cultivar adaptada à região, exigindo umidade do solo entre 55% e 80% no plantio e temperaturas entre 20°C e 32°C.",
            plantingDate: "2026-08-01",
            harvestConclusion: null,
            records: [
              {
                id: "reg_101",
                category: "plantio_clima",
                date: "2026-08-01",
                moisture: 68,
                temperature: 25.5,
                rainfall: 28,
                weatherCondition: "Sol com chuvas regulares bem distribuídas",
                notes: "Plantio realizado com umidade adequada no perfil do solo após chuva de 28 mm."
              },
              {
                id: "reg_102",
                category: "desenvolvimento",
                date: "2026-09-10",
                stage: "Floração Plena",
                progress: 50,
                moisture: 70,
                temperature: 26.0,
                weatherCondition: "Sol com chuvas regulares bem distribuídas",
                notes: "Lavoura em plena floração com plantas vigorosas e boa sanidade."
              },
              {
                id: "reg_103",
                category: "desenvolvimento",
                date: "2026-10-15",
                stage: "Enchimento de Grãos / Frutificação",
                progress: 74,
                moisture: 64,
                temperature: 27.0,
                weatherCondition: "Parcialmente nublado e ameno",
                notes: "Vagens em enchimento de grãos. Ainda requer aguardar maturação fisiológica."
              },
              {
                id: "reg_104",
                category: "decisao",
                date: "2026-10-15",
                adherence: "Seguiu a recomendação do sistema",
                actionTaken: "Manteve a lavoura em desenvolvimento e aguardou o ponto ideal para colher",
                notes: "Decisão de aguardar conforme alerta técnico pois os grãos ainda estão em fase de enchimento."
              }
            ]
          },
          {
            id: "safra_trigo_02",
            safraName: "Safra Inverno 2026 — Talhão 02 (Trigo Pronto para Colher)",
            species: "Trigo (Triticum aestivum) — Classe Pão",
            cycleDays: 120,
            idealWindow: "Abril a Junho (Outono/Inverno)",
            waterTolerance: "Sensível ao encharcamento prolongado e geadas na floração",
            moisturePlantingMin: 50,
            moisturePlantingMax: 76,
            moistureDevMin: 52,
            moistureDevMax: 78,
            moistureHarvestMin: 35,
            moistureHarvestMax: 55,
            tempMin: 10,
            tempMax: 25,
            physiologyNotes: "Trigo de inverno com ciclo de 120 dias; requer tempo firme na maturação.",
            plantingDate: "2026-06-10",
            harvestConclusion: null,
            records: [
              {
                id: "reg_201",
                category: "plantio_clima",
                date: "2026-06-10",
                moisture: 62,
                temperature: 18.0,
                rainfall: 18,
                weatherCondition: "Parcialmente nublado e ameno",
                notes: "Semeadura realizada dentro da janela ideal de inverno."
              },
              {
                id: "reg_202",
                category: "desenvolvimento",
                date: "2026-10-14",
                stage: "Maturação Fisiológica (Ponto de Colheita)",
                progress: 98,
                moisture: 44,
                temperature: 22.0,
                weatherCondition: "Tempo firme e seco (Favorável à maturação/colheita)",
                notes: "Espigas secas e douradas, ciclo completo e umidade ideal para colheita."
              }
            ]
          }
        ]
      }
    }
  };
  localStorage.setItem(DB_KEY, JSON.stringify(initialDB));
  return initialDB;
}

function getCloudDatabase() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return createDefaultDatabase();
  try {
    return JSON.parse(raw);
  } catch (e) {
    return createDefaultDatabase();
  }
}

function saveCloudDatabase(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function hasInternetConnection() {
  return window.navigator.onLine && !isSimulatedOffline;
}

function getTotalUserRecords(user) {
  if (!user || !user.crops) return 0;
  return user.crops.reduce((acc, crop) => acc + (crop.records ? crop.records.length : 0), 0);
}
