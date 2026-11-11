// ============================================================================
// Motor de Análise Agronômica, Recomendações, Alertas e Máquina de Estados
// ============================================================================

function formatDateToBR(isoDate) {
  if (!isoDate) return "—";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Máquina de Estados da Cultura / Safra:
 * - "Cadastrada": Cultura recém-cadastrada (características definidas).
 * - "Em Desenvolvimento": Dados de plantio, umidade, clima ou desenvolvimento inseridos.
 * - "Colheita Concluída": Cultura atingiu desenvolvimento adequado / colheita finalizada.
 */
function resolveCropState(crop) {
  if (!crop) return "Cadastrada";
  if (crop.harvestConclusion) {
    return "Colheita Concluída";
  }
  const devRecords = (crop.records || []).filter(r => r.category === "desenvolvimento");
  const latestDev = devRecords.length > 0 ? devRecords[devRecords.length - 1] : null;
  if (latestDev && Number(latestDev.progress) >= 100 && latestDev.stage.includes("Maturação")) {
    return "Colheita Concluída";
  }
  const hasStarted = Boolean(crop.plantingDate) ||
    (crop.records && crop.records.some(r => r.category === "plantio_clima" || r.category === "desenvolvimento"));
  return hasStarted ? "Em Desenvolvimento" : "Cadastrada";
}

/**
 * Calcula recomendações de plantio e colheita, alertas de umidade fora dos
 * padrões seguros e riscos climáticos de perdas, junto ao detalhamento técnico.
 */
function runAgronomicAnalysis(crop) {
  const plantingList = (crop.records || []).filter(r => r.category === "plantio_clima");
  const devList = (crop.records || []).filter(r => r.category === "desenvolvimento");

  const latestPlanting = plantingList.length > 0 ? plantingList[plantingList.length - 1] : null;
  const latestDev = devList.length > 0 ? devList[devList.length - 1] : null;
  const latestEnv = latestDev || latestPlanting;

  const currentMoisture = latestEnv ? Number(latestEnv.moisture) : null;
  const currentTemp = latestEnv ? Number(latestEnv.temperature) : null;
  const currentWeather = latestEnv ? latestEnv.weatherCondition : null;

  // Definir faixa segura de umidade conforme a fase atual
  let phaseLabel = "Plantio / Semeadura";
  let safeMin = Number(crop.moisturePlantingMin);
  let safeMax = Number(crop.moisturePlantingMax);

  if (latestDev) {
    if (latestDev.progress >= 90 || (latestDev.stage && latestDev.stage.includes("Maturação"))) {
      phaseLabel = "Maturação / Colheita";
      safeMin = Number(crop.moistureHarvestMin);
      safeMax = Number(crop.moistureHarvestMax);
    } else {
      phaseLabel = `Desenvolvimento (${latestDev.stage})`;
      safeMin = Number(crop.moistureDevMin);
      safeMax = Number(crop.moistureDevMax);
    }
  }

  // 1. Notificação Visual de Umidade Fora dos Padrões Seguros
  const moistureAlert = {
    hasMeasurement: currentMoisture !== null,
    isWithinSafeRange: true,
    title: "Nível de Umidade Dentro dos Padrões Seguros",
    description: "",
    technicalPoints: []
  };

  if (currentMoisture !== null) {
    if (currentMoisture < safeMin) {
      moistureAlert.isWithinSafeRange = false;
      moistureAlert.title = `Alerta Visual: Umidade Abaixo do Padrão Seguro (${currentMoisture}%)`;
      moistureAlert.description = `A umidade medida na área de cultivo (${currentMoisture}%) está abaixo do mínimo seguro (${safeMin}% a ${safeMax}%) para a fase de ${phaseLabel}. Há risco de estresse hídrico e comprometimento do desenvolvimento da planta.`;
    } else if (currentMoisture > safeMax) {
      moistureAlert.isWithinSafeRange = false;
      moistureAlert.title = `Alerta Visual: Umidade Acima do Padrão Seguro (${currentMoisture}%)`;
      moistureAlert.description = `A umidade registrada (${currentMoisture}%) está acima do limite máximo seguro (${safeMin}% a ${safeMax}%) para a fase de ${phaseLabel}. O excesso de umidade eleva o risco de asfixia radicular, doenças fúngicas e perdas na qualidade.`;
    } else {
      moistureAlert.description = `A umidade medida na área (${currentMoisture}%) está dentro da faixa segura (${safeMin}% a ${safeMax}%) recomendada para a fase de ${phaseLabel}.`;
    }

    moistureAlert.technicalPoints = [
      `Umidade registrada na área: ${currentMoisture}% (Data da leitura: ${formatDateToBR(latestEnv.date)})`,
      `Padrão seguro estabelecido para a fase (${phaseLabel}): ${safeMin}% a ${safeMax}%`,
      `Característica hídrica da cultura: ${crop.waterTolerance}`
    ];
  }

  // 2. Cruzamento das Características da Cultura com Condições Climáticas (Riscos de Perdas)
  const climateRiskItems = [];
  if (latestEnv) {
    if (currentTemp < Number(crop.tempMin)) {
      climateRiskItems.push(`Temperatura observada (${currentTemp}°C) abaixo do limite mínimo ideal (${crop.tempMin}°C) para ${crop.species}, podendo reduzir o metabolismo ou causar danos por frio.`);
    }
    if (currentTemp > Number(crop.tempMax)) {
      climateRiskItems.push(`Temperatura observada (${currentTemp}°C) acima do limite máximo seguro (${crop.tempMax}°C), gerando risco de abortamento de flores e redução de produtividade.`);
    }
    if (currentWeather && (currentWeather.includes("Estiagem") || currentWeather.includes("Calor extremo"))) {
      climateRiskItems.push(`Condição climática de ${currentWeather.toLowerCase()} cruzada com ${crop.waterTolerance.toLowerCase()} aponta risco de perdas na produção por deficiência hídrica.`);
    }
    if (currentWeather && currentWeather.includes("Chuva intensa")) {
      climateRiskItems.push(`Ocorrência de ${currentWeather.toLowerCase()} eleva o risco de erosão, lixiviação de nutrientes e incidência de doenças na lavoura.`);
    }
    if (currentWeather && (currentWeather.includes("geada") || currentWeather.includes("Ventos fortes"))) {
      climateRiskItems.push(`Condição adversa severa (${currentWeather}) com potencial direto de dano mecânico e perda de área produtiva.`);
    }
  }

  // 3. Cálculo do Período Mais Adequado para o Plantio + Detalhamento Técnico
  const plantingRecommendation = {
    level: "info",
    title: "Aguardando Dados de Plantio, Umidade e Clima",
    text: "Registre a data de plantio, a umidade do solo e o clima atual na aba 'Plantio e Clima' para calcular o período mais adequado para plantar.",
    technicalBasis: [
      `Janela sazonal indicada para a cultura: ${crop.idealWindow}`,
      `Umidade ideal para semeadura: ${crop.moisturePlantingMin}% a ${crop.moisturePlantingMax}%`,
      `Faixa térmica ideal: ${crop.tempMin}°C a ${crop.tempMax}°C`
    ]
  };

  if (latestPlanting) {
    const pMoist = Number(latestPlanting.moisture);
    const pTemp = Number(latestPlanting.temperature);
    const pWeather = latestPlanting.weatherCondition;

    const moistSafe = pMoist >= Number(crop.moisturePlantingMin) && pMoist <= Number(crop.moisturePlantingMax);
    const tempSafe = pTemp >= Number(crop.tempMin) && pTemp <= Number(crop.tempMax);
    const badWeather = pWeather.includes("Estiagem") || pWeather.includes("Chuva intensa") || pWeather.includes("geada") || pWeather.includes("Calor extremo");

    if (moistSafe && tempSafe && !badWeather) {
      plantingRecommendation.level = "success";
      plantingRecommendation.title = "Período Adequado para o Plantio Confirmado";
      plantingRecommendation.text = `As condições registradas em ${formatDateToBR(latestPlanting.date)} apresentaram umidade de ${pMoist}% e temperatura de ${pTemp}°C (${pWeather.toLowerCase()}), atendendo aos padrões fisiológicos da cultura ${crop.species} para uma germinação vigorosa e uniforme.`;
    } else {
      plantingRecommendation.level = "warning";
      plantingRecommendation.title = "Atenção: Condições de Plantio Exigem Cautela";
      const motives = [];
      if (!moistSafe) motives.push(`umidade (${pMoist}%) fora da faixa segura de plantio (${crop.moisturePlantingMin}% a ${crop.moisturePlantingMax}%)`);
      if (!tempSafe) motives.push(`temperatura (${pTemp}°C) fora da faixa ideal (${crop.tempMin}°C a ${crop.tempMax}°C)`);
      if (badWeather) motives.push(`condição climática desfavorável (${pWeather})`);
      plantingRecommendation.text = `Foram identificadas condições de atenção no plantio: ${motives.join(", ")}. Recomenda-se concentrar a semeadura dentro do período sazonal (${crop.idealWindow}) assim que a umidade do solo e o clima estabilizarem.`;
    }

    plantingRecommendation.technicalBasis = [
      `Data do plantio registrado: ${formatDateToBR(latestPlanting.date)} | Período sazonal da cultura: ${crop.idealWindow}`,
      `Umidade medida na área: ${pMoist}% (Faixa segura de plantio: ${crop.moisturePlantingMin}% a ${crop.moisturePlantingMax}%)`,
      `Clima observado no local: ${pTemp}°C, chuva de ${latestPlanting.rainfall} mm, ${pWeather} (Temperatura ideal: ${crop.tempMin}°C a ${crop.tempMax}°C)`,
      `Características fisiológicas consideradas: ${crop.physiologyNotes}`
    ];
  }

  // 4. Cálculo do Momento Ideal para Colheita e Alerta para Aguardar Mais Tempo
  const harvestRecommendation = {
    level: "info",
    isReadyToHarvest: false,
    estimatedHarvestDate: null,
    daysSincePlanting: 0,
    daysToWait: Number(crop.cycleDays),
    progressPercent: 0,
    title: "Aguardando Registro de Desenvolvimento para Calcular Colheita",
    text: "Registre a data de plantio e o status de desenvolvimento da planta para que o sistema calcule o momento ideal da colheita.",
    technicalBasis: []
  };

  const refPlantingDate = crop.plantingDate || (latestPlanting ? latestPlanting.date : "");
  if (refPlantingDate) {
    const startObj = new Date(refPlantingDate + "T12:00:00");
    const evalDateStr = latestDev ? latestDev.date : "2026-10-15";
    const evalObj = new Date(evalDateStr + "T12:00:00");

    const elapsedDays = Math.max(0, Math.round((evalObj - startObj) / (1000 * 60 * 60 * 24)));
    const cycleDays = Number(crop.cycleDays) || 120;

    const idealHarvestObj = new Date(startObj.getTime() + cycleDays * 24 * 60 * 60 * 1000);
    const idealHarvestISO = idealHarvestObj.toISOString().slice(0, 10);

    const calendarPct = Math.min(100, Math.round((elapsedDays / cycleDays) * 100));
    const currentProgress = latestDev ? Number(latestDev.progress) : calendarPct;
    const stageName = latestDev ? latestDev.stage : "Fase Inicial Pós-Plantio";

    const remainingByPct = Math.max(0, Math.round(((100 - currentProgress) / 100) * cycleDays));
    const remainingByDays = Math.max(0, cycleDays - elapsedDays);
    const waitDays = Math.max(remainingByPct, remainingByDays > 5 && currentProgress < 95 ? remainingByDays : remainingByPct);

    harvestRecommendation.estimatedHarvestDate = idealHarvestISO;
    harvestRecommendation.daysSincePlanting = elapsedDays;
    harvestRecommendation.daysToWait = waitDays;
    harvestRecommendation.progressPercent = currentProgress;

    if (crop.harvestConclusion) {
      harvestRecommendation.level = "success";
      harvestRecommendation.isReadyToHarvest = true;
      harvestRecommendation.title = "Etapa de Colheita Concluída na Safra";
      harvestRecommendation.text = `A colheita desta safra foi concluída em ${formatDateToBR(crop.harvestConclusion.date)}, alcançando produtividade de ${crop.harvestConclusion.yield} com umidade final de ${crop.harvestConclusion.finalMoisture}%.`;
      harvestRecommendation.technicalBasis = [
        `Data do plantio: ${formatDateToBR(refPlantingDate)} | Conclusão da colheita: ${formatDateToBR(crop.harvestConclusion.date)}`,
        `Qualidade final registrada: ${crop.harvestConclusion.quality}`,
        `Observações de encerramento: ${crop.harvestConclusion.notes}`
      ];
    } else if (currentProgress < 95 || (latestDev && !latestDev.stage.includes("Maturação"))) {
      // Alerta instruindo o produtor a aguardar mais tempo para a colheita
      harvestRecommendation.level = "warning";
      harvestRecommendation.isReadyToHarvest = false;
      harvestRecommendation.title = `Alerta: Aguardar Mais Tempo para a Colheita (${currentProgress}% concluído)`;
      harvestRecommendation.text = `A análise dos dados indica que a cultura ainda NÃO atingiu o desenvolvimento adequado para a colheita (estágio atual: ${stageName}). Recomenda-se aguardar aproximadamente mais ${waitDays} dias (momento ideal previsto a partir de ${formatDateToBR(idealHarvestISO)}) para evitar perdas por grãos imaturos ou umidade inadequada.`;
      harvestRecommendation.technicalBasis = [
        `Tempo decorrido desde o plantio (${formatDateToBR(refPlantingDate)}): ${elapsedDays} dias de um ciclo estimado em ${cycleDays} dias`,
        `Progresso do desenvolvimento avaliado: ${currentProgress}% (${stageName})`,
        `Umidade atual medida na área: ${currentMoisture !== null ? currentMoisture + "%" : "Não registrada"} (Faixa segura na colheita: ${crop.moistureHarvestMin}% a ${crop.moistureHarvestMax}%)`,
        `Condição climática observada: ${currentWeather || "Normal"}${currentTemp !== null ? ` (${currentTemp}°C)` : ""}`
      ];
    } else {
      // Cultura atingiu o desenvolvimento adequado -> Momento ideal para colheita
      const rainDelay = currentWeather && currentWeather.includes("Chuva intensa");
      harvestRecommendation.level = rainDelay ? "warning" : "success";
      harvestRecommendation.isReadyToHarvest = true;
      harvestRecommendation.title = rainDelay
        ? `Maturação Atingida (${currentProgress}%), mas Aguarde Estiada para Colher`
        : `Momento Ideal para a Realização da Colheita Confirmado (${currentProgress}%)`;
      harvestRecommendation.text = rainDelay
        ? `A cultura atingiu o desenvolvimento fisiológico adequado (${currentProgress}%), mas a ocorrência de chuva intensa recomenda aguardar a redução da umidade antes da entrada das máquinas.`
        : `A cultura atingiu o desenvolvimento fisiológico adequado (${currentProgress}% — ${stageName}). O momento atual (janela prevista em ${formatDateToBR(idealHarvestISO)}) é ideal para realizar a colheita com segurança e máxima produtividade.`;
      harvestRecommendation.technicalBasis = [
        `Tempo total desde o plantio (${formatDateToBR(refPlantingDate)}): ${elapsedDays} dias (Ciclo da cultura: ${cycleDays} dias)`,
        `Estágio fenológico atingido: ${stageName} (${currentProgress}% do desenvolvimento)`,
        `Umidade atual na área: ${currentMoisture !== null ? currentMoisture + "%" : "Adequada"} (Faixa segura para colheita: ${crop.moistureHarvestMin}% a ${crop.moistureHarvestMax}%)`,
        `Clima observado no local: ${currentWeather || "Tempo firme"}${currentTemp !== null ? ` (${currentTemp}°C)` : ""}`
      ];
    }
  }

  return {
    phaseLabel,
    safeMin,
    safeMax,
    currentMoisture,
    currentTemp,
    currentWeather,
    moistureAlert,
    climateRiskItems,
    plantingRecommendation,
    harvestRecommendation
  };
}
