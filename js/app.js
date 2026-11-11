// ============================================================================
// Controlador Principal de Interface do Sistema Web AgroCampo
// ============================================================================

function escapeHTML(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showMessageToast(text, isError = false) {
  const area = document.getElementById("toastArea");
  const item = document.createElement("div");
  item.className = "toast-msg" + (isError ? " error" : "");
  item.textContent = text;
  area.appendChild(item);
  setTimeout(() => item.remove(), 4500);
}

// ----------------------------------------------------------------------------
// Verificação de Conexão com a Internet e Alerta de "Sem internet"
// ----------------------------------------------------------------------------
function updateConnectionBanner() {
  const online = hasInternetConnection();
  const banner = document.getElementById("offlineBanner");
  const simBtns = document.querySelectorAll(".sim-offline-btn");

  if (!online) {
    banner.classList.add("active");
    simBtns.forEach(b => (b.textContent = "Restaurar Conexão"));
  } else {
    banner.classList.remove("active");
    simBtns.forEach(b => (b.textContent = 'Testar "Sem Internet"'));
  }
}

function toggleOfflineSimulation() {
  isSimulatedOffline = !isSimulatedOffline;
  updateConnectionBanner();
  if (isSimulatedOffline) {
    showMessageToast('Modo "Sem internet" ativado para teste. Tente salvar um registro para ver o bloqueio.', true);
  } else {
    showMessageToast("Conexão restabelecida com o banco de dados em nuvem.", false);
  }
}

function verifyConnectionBeforeSave() {
  if (!hasInternetConnection()) {
    showMessageToast('Sem internet: Não foi possível salvar o registro. Verifique sua conexão e tente novamente.', true);
    const banner = document.getElementById("offlineBanner");
    if (banner) banner.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }
  return true;
}

window.addEventListener("online", updateConnectionBanner);
window.addEventListener("offline", updateConnectionBanner);

// ----------------------------------------------------------------------------
// Autenticação Simples por E-mail e Senha (Login e Cadastro)
// ----------------------------------------------------------------------------
function toggleAuthTab(mode) {
  const isLogin = mode === "login";
  document.getElementById("tabBtnLogin").classList.toggle("active", isLogin);
  document.getElementById("tabBtnRegister").classList.toggle("active", !isLogin);
  document.getElementById("formLogin").style.display = isLogin ? "block" : "none";
  document.getElementById("formRegister").style.display = isLogin ? "none" : "block";
}

function loginWithDemoAccount() {
  document.getElementById("loginEmail").value = "produtor@agrocampo.com.br";
  document.getElementById("loginPassword").value = "safra2026";
  onLoginSubmit(new Event("submit"));
}

function onLoginSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const db = getCloudDatabase();

  if (!db.users[email] || db.users[email].password !== password) {
    showMessageToast("E-mail ou senha incorretos. Confira seus dados ou utilize a Conta de Demonstração.", true);
    return;
  }

  openAuthenticatedApp(email);
}

function onRegisterSubmit(e) {
  e.preventDefault();
  if (!verifyConnectionBeforeSave()) return;

  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim().toLowerCase();
  const password = document.getElementById("regPassword").value;

  const db = getCloudDatabase();
  if (db.users[email]) {
    showMessageToast("Este e-mail já está cadastrado. Faça login na aba Entrar.", true);
    return;
  }

  const baseModel = CROP_MODELS.soja;
  db.users[email] = {
    name,
    email,
    password,
    crops: [
      {
        id: "safra_" + Date.now(),
        ...baseModel,
        plantingDate: "",
        harvestConclusion: null,
        records: []
      }
    ]
  };

  saveCloudDatabase(db);
  showMessageToast("Cadastro concluído com sucesso! Seus dados estão salvos na nuvem.", false);
  openAuthenticatedApp(email);
}

function openAuthenticatedApp(email) {
  currentProducerEmail = email;
  const db = getCloudDatabase();
  const user = db.users[email];

  document.getElementById("authPage").style.display = "none";
  document.getElementById("appLayout").classList.add("active");
  document.getElementById("activeProducerLabel").textContent = user.name;

  if (user.crops.length > 0) {
    currentCropId = user.crops[0].id;
  }

  setInitialInputDates();
  refreshApplicationView();
}

function logoutSession() {
  currentProducerEmail = null;
  currentCropId = null;
  document.getElementById("appLayout").classList.remove("active");
  document.getElementById("authPage").style.display = "flex";
}

function setInitialInputDates() {
  const today = "2026-10-15";
  ["inputPlantingDate", "inputDevDate", "inputDecisionDate", "inputHarvestDate"].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });
}

function getActiveSessionData() {
  const db = getCloudDatabase();
  const user = db.users[currentProducerEmail];
  if (!user) return { db, user: null, crop: null };
  const crop = user.crops.find(c => c.id === currentCropId) || user.crops[0];
  if (crop) currentCropId = crop.id;
  return { db, user, crop };
}

// ----------------------------------------------------------------------------
// Navegação entre as Seções Principais
// ----------------------------------------------------------------------------
function openSection(sectionId, createNewCrop = false) {
  document.querySelectorAll(".screen-section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));

  const targetSection = document.getElementById(sectionId);
  const targetNav = document.getElementById("nav_" + sectionId);
  if (targetSection) targetSection.classList.add("active");
  if (targetNav) targetNav.classList.add("active");

  if (sectionId === "secCultura") {
    if (createNewCrop) {
      document.getElementById("cropFormMode").value = "new";
      document.getElementById("cropSectionHeading").textContent = "Cadastrar Nova Cultura / Safra";
      applyModelPreset("milho");
      const { user } = getActiveSessionData();
      document.getElementById("cropSafraName").value = `Safra 2026/2027 — Talhão 0${user.crops.length + 1}`;
    } else {
      document.getElementById("cropFormMode").value = "edit";
      document.getElementById("cropSectionHeading").textContent = "Características Fisiológicas e Tipo da Cultura";
      populateCropForm();
    }
  }
}

function onChangeSafraSelect(cropId) {
  currentCropId = cropId;
  refreshApplicationView();
}

// ----------------------------------------------------------------------------
// Atualização das Telas, Recomendações, Alertas e Máquina de Estados
// ----------------------------------------------------------------------------
function refreshApplicationView() {
  const { user, crop } = getActiveSessionData();
  if (!user || !crop) return;

  // Atualizar seletor de safras no topo
  const selectEl = document.getElementById("safraSelect");
  selectEl.innerHTML = user.crops
    .map(c => `<option value="${c.id}" ${c.id === crop.id ? "selected" : ""}>${escapeHTML(c.safraName)}</option>`)
    .join("");

  // Atualizar Ciclo de Estados da Safra (Cadastrada -> Em Desenvolvimento -> Colheita Concluída)
  const state = resolveCropState(crop);
  const st1 = document.getElementById("stateStep1");
  const st2 = document.getElementById("stateStep2");
  const st3 = document.getElementById("stateStep3");
  [st1, st2, st3].forEach(el => el.classList.remove("completed", "current"));

  if (state === "Cadastrada") {
    st1.classList.add("current");
  } else if (state === "Em Desenvolvimento") {
    st1.classList.add("completed");
    st2.classList.add("current");
  } else {
    st1.classList.add("completed");
    st2.classList.add("completed");
    st3.classList.add("current");
  }

  // Executar análise agronômica
  const analysis = runAgronomicAnalysis(crop);

  renderRecommendationsScreen(crop, analysis, state);
  populateCropForm();
  renderPlantingSidePreview(analysis);
  renderDevelopmentSidePreview(analysis);
  renderHistoryScreen();
}

function renderRecommendationsScreen(crop, analysis, state) {
  document.getElementById("mainCropTitle").textContent = crop.safraName;
  document.getElementById("mainCropSubtitle").textContent =
    `${crop.species} • Ciclo médio de ${crop.cycleDays} dias • Período recomendado: ${crop.idealWindow}`;

  const plantDateText = crop.plantingDate ? formatDateToBR(crop.plantingDate) : "Não informado";
  const harvestDateText = analysis.harvestRecommendation.estimatedHarvestDate
    ? formatDateToBR(analysis.harvestRecommendation.estimatedHarvestDate)
    : "A calcular";

  document.getElementById("summaryCardsRow").innerHTML = `
    <div class="summary-card">
      <div class="summary-card-label">Situação da Safra</div>
      <div class="summary-card-value" style="color:var(--primary);">${state}</div>
      <div class="summary-card-sub">Plantio: ${plantDateText} (${analysis.harvestRecommendation.daysSincePlanting} dias)</div>
    </div>
    <div class="summary-card">
      <div class="summary-card-label">Umidade Medida na Área</div>
      <div class="summary-card-value">${analysis.currentMoisture !== null ? analysis.currentMoisture + "%" : "—"}</div>
      <div class="summary-card-sub">Faixa segura atual: ${analysis.safeMin}% a ${analysis.safeMax}%</div>
    </div>
    <div class="summary-card">
      <div class="summary-card-label">Condição Climática</div>
      <div class="summary-card-value">${analysis.currentTemp !== null ? analysis.currentTemp + "°C" : "—"}</div>
      <div class="summary-card-sub">${escapeHTML(analysis.currentWeather || "Aguardando registro")}</div>
    </div>
    <div class="summary-card">
      <div class="summary-card-label">Previsão de Colheita</div>
      <div class="summary-card-value">${harvestDateText}</div>
      <div class="summary-card-sub">Desenvolvimento: ${analysis.harvestRecommendation.progressPercent}% concluído</div>
    </div>
  `;

  // Alertas de Umidade e Riscos Climáticos (Fonte >= 16px)
  let alertsHTML = "";
  if (analysis.moistureAlert.hasMeasurement) {
    const cardTone = analysis.moistureAlert.isWithinSafeRange ? "recommendation-card" : "recommendation-card danger";
    const pointerPos = Math.max(2, Math.min(98, analysis.currentMoisture));
    alertsHTML += `
      <div class="${cardTone}">
        <div class="rec-card-title">${escapeHTML(analysis.moistureAlert.title)}</div>
        <div class="rec-card-text">${escapeHTML(analysis.moistureAlert.description)}</div>
        <div class="moisture-bar-wrap">
          <div style="display:flex; justify-content:space-between; font-size:0.82rem; font-weight:600; color:var(--text-secondary);">
            <span>0%</span>
            <span>Faixa Segura (${escapeHTML(analysis.phaseLabel)}): ${analysis.safeMin}% a ${analysis.safeMax}%</span>
            <span>100%</span>
          </div>
          <div class="moisture-bar-track">
            <div class="moisture-safe-range" style="left:${analysis.safeMin}%; width:${Math.max(5, analysis.safeMax - analysis.safeMin)}%;"></div>
            <div class="moisture-indicator" style="left:${pointerPos}%; background-color:${analysis.moistureAlert.isWithinSafeRange ? "#1f6b35" : "#c62828"};"></div>
          </div>
        </div>
        <div class="rec-technical-box">
          <strong class="tech-heading">Detalhamento técnico da umidade:</strong>
          <ul>
            ${analysis.moistureAlert.technicalPoints.map(pt => `<li>${escapeHTML(pt)}</li>`).join("")}
          </ul>
        </div>
      </div>
    `;
  }

  if (analysis.climateRiskItems.length > 0) {
    alertsHTML += `
      <div class="recommendation-card danger">
        <div class="rec-card-title">Alerta de Riscos Climáticos e Possíveis Perdas na Produção</div>
        <div class="rec-card-text">
          O cruzamento das características fisiológicas da cultura <strong>${escapeHTML(crop.species)}</strong> com as condições climáticas observadas identificou fatores de risco para a lavoura:
        </div>
        <div class="rec-technical-box">
          <strong class="tech-heading">Fatores climáticos e fisiológicos analisados:</strong>
          <ul>
            ${analysis.climateRiskItems.map(item => `<li>${escapeHTML(item)}</li>`).join("")}
          </ul>
        </div>
      </div>
    `;
  }

  document.getElementById("alertsContainer").innerHTML = alertsHTML;

  // Recomendações Principais: Plantio e Colheita com Detalhamento Técnico (Fonte >= 16px)
  const pRec = analysis.plantingRecommendation;
  const hRec = analysis.harvestRecommendation;

  const pTone = pRec.level === "success" ? "" : pRec.level;
  const hTone = hRec.level === "success" ? "" : hRec.level;

  document.getElementById("mainRecommendationsGrid").innerHTML = `
    <div class="recommendation-card ${pTone}">
      <div class="rec-card-title">${escapeHTML(pRec.title)}</div>
      <div class="rec-card-text">${escapeHTML(pRec.text)}</div>
      <div class="rec-technical-box">
        <strong class="tech-heading">Detalhamento técnico que embasou a recomendação:</strong>
        <ul>
          ${pRec.technicalBasis.map(b => `<li>${escapeHTML(b)}</li>`).join("")}
        </ul>
      </div>
    </div>

    <div class="recommendation-card ${hTone}">
      <div class="rec-card-title">${escapeHTML(hRec.title)}</div>
      <div class="rec-card-text">${escapeHTML(hRec.text)}</div>
      ${
        hRec.technicalBasis.length > 0
          ? `<div class="rec-technical-box">
              <strong class="tech-heading">Detalhamento técnico que embasou a recomendação:</strong>
              <ul>
                ${hRec.technicalBasis.map(b => `<li>${escapeHTML(b)}</li>`).join("")}
              </ul>
            </div>`
          : ""
      }
    </div>
  `;
}

function renderPlantingSidePreview(analysis) {
  const pRec = analysis.plantingRecommendation;
  const pTone = pRec.level === "success" ? "" : pRec.level;
  const box = document.getElementById("plantingPreviewArea");
  if (!box) return;
  box.innerHTML = `
    <div class="recommendation-card ${pTone}" style="margin-bottom:0;">
      <div class="rec-card-title">${escapeHTML(pRec.title)}</div>
      <div class="rec-card-text">${escapeHTML(pRec.text)}</div>
      <div class="rec-technical-box">
        <strong class="tech-heading">Detalhamento técnico (clima, umidade e cultura):</strong>
        <ul>
          ${pRec.technicalBasis.map(b => `<li>${escapeHTML(b)}</li>`).join("")}
        </ul>
      </div>
    </div>
  `;
}

function renderDevelopmentSidePreview(analysis) {
  const hRec = analysis.harvestRecommendation;
  const hTone = hRec.level === "success" ? "" : hRec.level;
  const box = document.getElementById("developmentPreviewArea");
  if (!box) return;
  box.innerHTML = `
    <div class="recommendation-card ${hTone}" style="margin-bottom:0;">
      <div class="rec-card-title">${escapeHTML(hRec.title)}</div>
      <div class="rec-card-text">${escapeHTML(hRec.text)}</div>
      ${
        hRec.technicalBasis.length > 0
          ? `<div class="rec-technical-box">
              <strong class="tech-heading">Detalhamento técnico (tempo, desenvolvimento e clima):</strong>
              <ul>
                ${hRec.technicalBasis.map(b => `<li>${escapeHTML(b)}</li>`).join("")}
              </ul>
            </div>`
          : ""
      }
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Cadastro e Edição das Características Fisiológicas da Cultura
// ----------------------------------------------------------------------------
function applyModelPreset(key) {
  const model = CROP_MODELS[key];
  if (!model) return;
  document.getElementById("cropSafraName").value = model.safraName;
  document.getElementById("cropSpecies").value = model.species;
  document.getElementById("cropCycleDays").value = model.cycleDays;
  document.getElementById("cropIdealWindow").value = model.idealWindow;
  document.getElementById("cropWaterTolerance").value = model.waterTolerance;
  document.getElementById("cropMoistPlantMin").value = model.moisturePlantingMin;
  document.getElementById("cropMoistPlantMax").value = model.moisturePlantingMax;
  document.getElementById("cropMoistDevMin").value = model.moistureDevMin;
  document.getElementById("cropMoistDevMax").value = model.moistureDevMax;
  document.getElementById("cropMoistHarvMin").value = model.moistureHarvestMin;
  document.getElementById("cropMoistHarvMax").value = model.moistureHarvestMax;
  document.getElementById("cropTempMin").value = model.tempMin;
  document.getElementById("cropTempMax").value = model.tempMax;
  document.getElementById("cropPhysiologyNotes").value = model.physiologyNotes;
}

function populateCropForm() {
  const { crop } = getActiveSessionData();
  if (!crop) return;
  document.getElementById("cropSafraName").value = crop.safraName;
  document.getElementById("cropSpecies").value = crop.species;
  document.getElementById("cropCycleDays").value = crop.cycleDays;
  document.getElementById("cropIdealWindow").value = crop.idealWindow;
  document.getElementById("cropWaterTolerance").value = crop.waterTolerance;
  document.getElementById("cropMoistPlantMin").value = crop.moisturePlantingMin;
  document.getElementById("cropMoistPlantMax").value = crop.moisturePlantingMax;
  document.getElementById("cropMoistDevMin").value = crop.moistureDevMin;
  document.getElementById("cropMoistDevMax").value = crop.moistureDevMax;
  document.getElementById("cropMoistHarvMin").value = crop.moistureHarvestMin;
  document.getElementById("cropMoistHarvMax").value = crop.moistureHarvestMax;
  document.getElementById("cropTempMin").value = crop.tempMin;
  document.getElementById("cropTempMax").value = crop.tempMax;
  document.getElementById("cropPhysiologyNotes").value = crop.physiologyNotes;
  if (crop.plantingDate) {
    document.getElementById("inputPlantingDate").value = crop.plantingDate;
  }
}

function onSaveCropSubmit(e) {
  e.preventDefault();
  if (!verifyConnectionBeforeSave()) return;

  const { db, user, crop } = getActiveSessionData();
  const mode = document.getElementById("cropFormMode").value;

  const data = {
    safraName: document.getElementById("cropSafraName").value.trim(),
    species: document.getElementById("cropSpecies").value.trim(),
    cycleDays: Number(document.getElementById("cropCycleDays").value),
    idealWindow: document.getElementById("cropIdealWindow").value.trim(),
    waterTolerance: document.getElementById("cropWaterTolerance").value,
    moisturePlantingMin: Number(document.getElementById("cropMoistPlantMin").value),
    moisturePlantingMax: Number(document.getElementById("cropMoistPlantMax").value),
    moistureDevMin: Number(document.getElementById("cropMoistDevMin").value),
    moistureDevMax: Number(document.getElementById("cropMoistDevMax").value),
    moistureHarvestMin: Number(document.getElementById("cropMoistHarvMin").value),
    moistureHarvestMax: Number(document.getElementById("cropMoistHarvMax").value),
    tempMin: Number(document.getElementById("cropTempMin").value),
    tempMax: Number(document.getElementById("cropTempMax").value),
    physiologyNotes: document.getElementById("cropPhysiologyNotes").value.trim()
  };

  if (mode === "new") {
    const newCrop = {
      id: "safra_" + Date.now(),
      ...data,
      plantingDate: "",
      harvestConclusion: null,
      records: []
    };
    user.crops.push(newCrop);
    currentCropId = newCrop.id;
    showMessageToast("Nova cultura cadastrada e salva no banco de dados em nuvem!", false);
  } else {
    Object.assign(crop, data);
    showMessageToast("Características fisiológicas da cultura atualizadas com sucesso!", false);
  }

  saveCloudDatabase(db);
  refreshApplicationView();
  openSection("secRecomendacoes");
}

// ----------------------------------------------------------------------------
// Registro de Plantio, Umidade e Condições Climáticas
// ----------------------------------------------------------------------------
function onSavePlantingClimateSubmit(e) {
  e.preventDefault();
  if (!verifyConnectionBeforeSave()) return;

  const { db, user, crop } = getActiveSessionData();
  if (getTotalUserRecords(user) >= RECORD_LIMIT_PER_USER) {
    showMessageToast("Limite de 200 registros por conta atingido.", true);
    return;
  }

  const date = document.getElementById("inputPlantingDate").value;
  const moisture = Number(document.getElementById("inputPlantingMoisture").value);
  const temperature = Number(document.getElementById("inputPlantingTemp").value);
  const rainfall = Number(document.getElementById("inputPlantingRain").value);
  const weatherCondition = document.getElementById("inputPlantingWeather").value;
  const notes = document.getElementById("inputPlantingNotes").value.trim() || "Registro de plantio, umidade e clima efetuado na área de cultivo.";

  crop.plantingDate = date;
  crop.records.push({
    id: "reg_" + Date.now(),
    category: "plantio_clima",
    date,
    moisture,
    temperature,
    rainfall,
    weatherCondition,
    notes
  });

  saveCloudDatabase(db);
  refreshApplicationView();
  showMessageToast("Dados de plantio, umidade e clima salvos! Recomendações atualizadas.", false);
}

// ----------------------------------------------------------------------------
// Acompanhamento de Desenvolvimento, Decisão Prática e Conclusão da Colheita
// ----------------------------------------------------------------------------
function switchCycleSubTab(tabName) {
  ["dev", "decision", "harvest"].forEach(t => {
    document.getElementById("subTabBtn_" + t).classList.toggle("active", t === tabName);
    document.getElementById("subTabPane_" + t).style.display = t === tabName ? "block" : "none";
  });
}

function choosePhenologicalStage(stageLabel, defaultPct, btnEl) {
  document.querySelectorAll(".stage-btn").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  document.getElementById("inputDevStage").value = stageLabel;
  document.getElementById("inputDevProgress").value = defaultPct;
  document.getElementById("devProgressDisplay").textContent = defaultPct + "%";
}

function onSaveDevelopmentSubmit(e) {
  e.preventDefault();
  if (!verifyConnectionBeforeSave()) return;

  const { db, user, crop } = getActiveSessionData();
  if (getTotalUserRecords(user) >= RECORD_LIMIT_PER_USER) {
    showMessageToast("Limite de 200 registros por conta atingido.", true);
    return;
  }

  const date = document.getElementById("inputDevDate").value;
  const stage = document.getElementById("inputDevStage").value;
  const progress = Number(document.getElementById("inputDevProgress").value);
  const moisture = Number(document.getElementById("inputDevMoisture").value);
  const temperature = Number(document.getElementById("inputDevTemp").value);
  const weatherCondition = document.getElementById("inputDevWeather").value;
  const notes = document.getElementById("inputDevNotes").value.trim();

  crop.records.push({
    id: "reg_" + Date.now(),
    category: "desenvolvimento",
    date,
    stage,
    progress,
    moisture,
    temperature,
    weatherCondition,
    notes
  });

  saveCloudDatabase(db);
  refreshApplicationView();

  if (progress < 95 || !stage.includes("Maturação")) {
    showMessageToast("Status salvo! Alerta emitido: aguardar mais tempo até atingir o desenvolvimento adequado.", false);
  } else {
    showMessageToast("Status salvo! A cultura atingiu o momento ideal para realização da colheita.", false);
  }
}

function onSaveDecisionSubmit(e) {
  e.preventDefault();
  if (!verifyConnectionBeforeSave()) return;

  const { db, user, crop } = getActiveSessionData();
  if (getTotalUserRecords(user) >= RECORD_LIMIT_PER_USER) {
    showMessageToast("Limite de 200 registros por conta atingido.", true);
    return;
  }

  const date = document.getElementById("inputDecisionDate").value;
  const adherence = document.getElementById("inputDecisionAdherence").value;
  const actionTaken = document.getElementById("inputDecisionAction").value.trim();
  const notes = document.getElementById("inputDecisionNotes").value.trim();

  crop.records.push({
    id: "reg_" + Date.now(),
    category: "decisao",
    date,
    adherence,
    actionTaken,
    notes
  });

  saveCloudDatabase(db);
  document.getElementById("inputDecisionAction").value = "";
  document.getElementById("inputDecisionNotes").value = "";
  refreshApplicationView();
  showMessageToast("Decisão executada na prática registrada no histórico da safra!", false);
}

function onSaveHarvestConclusionSubmit(e) {
  e.preventDefault();
  if (!verifyConnectionBeforeSave()) return;

  const { db, crop } = getActiveSessionData();
  const date = document.getElementById("inputHarvestDate").value;
  const yieldVal = document.getElementById("inputHarvestYield").value.trim();
  const finalMoisture = Number(document.getElementById("inputHarvestMoisture").value);
  const quality = document.getElementById("inputHarvestQuality").value;
  const notes = document.getElementById("inputHarvestNotes").value.trim();

  crop.harvestConclusion = { date, yield: yieldVal, finalMoisture, quality, notes };
  crop.records.push({
    id: "reg_" + Date.now(),
    category: "colheita",
    date,
    yield: yieldVal,
    finalMoisture,
    quality,
    notes
  });

  saveCloudDatabase(db);
  refreshApplicationView();
  showMessageToast("Conclusão da colheita registrada com sucesso no banco em nuvem!", false);
  openSection("secRecomendacoes");
}

// ----------------------------------------------------------------------------
// Histórico Consolidado da Safra + Alteração e Exclusão de Registros
// ----------------------------------------------------------------------------
function renderHistoryScreen() {
  const { crop } = getActiveSessionData();
  if (!crop) return;

  const catFilter = document.getElementById("filterHistoryCategory").value;
  const query = (document.getElementById("searchHistoryInput").value || "").trim().toLowerCase();
  const tbody = document.getElementById("historyTableBody");

  const filtered = (crop.records || []).filter(r => {
    const matchCat = catFilter === "all" || r.category === catFilter;
    const matchText = !query || JSON.stringify(r).toLowerCase().includes(query);
    return matchCat && matchText;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 28px; color:var(--text-secondary);">
          Nenhum registro encontrado para esta safra com o filtro selecionado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .slice()
    .reverse()
    .map(r => {
      let badge = "";
      let details = "";

      if (r.category === "plantio_clima") {
        badge = `<span class="badge-pill badge-planting">Plantio e Clima</span>`;
        details = `<strong>Umidade:</strong> ${r.moisture}% • <strong>Temp.:</strong> ${r.temperature}°C • <strong>Chuva:</strong> ${r.rainfall} mm<br/><span style="color:var(--text-secondary);">${escapeHTML(r.weatherCondition)}</span>`;
      } else if (r.category === "desenvolvimento") {
        badge = `<span class="badge-pill badge-dev">Desenvolvimento (${r.progress}%)</span>`;
        details = `<strong>Fase:</strong> ${escapeHTML(r.stage)}<br/><strong>Umidade:</strong> ${r.moisture}% • <strong>Temp.:</strong> ${r.temperature}°C • ${escapeHTML(r.weatherCondition)}`;
      } else if (r.category === "decisao") {
        badge = `<span class="badge-pill badge-decision">Decisão na Prática</span>`;
        details = `<strong>Relação:</strong> ${escapeHTML(r.adherence)}<br/><strong>Decisão executada:</strong> ${escapeHTML(r.actionTaken)}`;
      } else if (r.category === "colheita") {
        badge = `<span class="badge-pill badge-harvest">Colheita Concluída</span>`;
        details = `<strong>Produtividade:</strong> ${escapeHTML(r.yield)} • <strong>Umidade final:</strong> ${r.finalMoisture}%<br/><strong>Qualidade:</strong> ${escapeHTML(r.quality)}`;
      }

      return `
        <tr>
          <td style="font-weight:700; white-space:nowrap;">${formatDateToBR(r.date)}</td>
          <td>${badge}</td>
          <td>${details}</td>
          <td>${escapeHTML(r.notes || "")}</td>
          <td style="text-align:right; white-space:nowrap;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="openEditModal('${r.id}')">Alterar</button>
            <button type="button" class="btn btn-danger btn-sm" onclick="removeRecord('${r.id}')">Excluir</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function openEditModal(recordId) {
  const { crop } = getActiveSessionData();
  const rec = (crop.records || []).find(r => r.id === recordId);
  if (!rec) return;

  document.getElementById("editRecordId").value = rec.id;
  document.getElementById("editRecordDate").value = rec.date;
  document.getElementById("editRecordNotes").value = rec.notes || "";

  const fieldsBox = document.getElementById("editDynamicFieldsBox");
  if (rec.category === "plantio_clima") {
    fieldsBox.innerHTML = `
      <div class="grid-2">
        <div class="form-field">
          <label>Nível de Umidade (%)</label>
          <input type="number" id="edMoistInput" class="input-control" required min="0" max="100" step="0.5" value="${rec.moisture}" />
        </div>
        <div class="form-field">
          <label>Temperatura (°C)</label>
          <input type="number" id="edTempInput" class="input-control" required min="-10" max="55" step="0.5" value="${rec.temperature}" />
        </div>
      </div>
      <div class="grid-2">
        <div class="form-field">
          <label>Chuva / Precipitação (mm)</label>
          <input type="number" id="edRainInput" class="input-control" required min="0" max="500" step="1" value="${rec.rainfall}" />
        </div>
        <div class="form-field">
          <label>Condição Climática</label>
          <input type="text" id="edWeatherInput" class="input-control" required value="${escapeHTML(rec.weatherCondition)}" />
        </div>
      </div>
    `;
  } else if (rec.category === "desenvolvimento") {
    fieldsBox.innerHTML = `
      <div class="grid-2">
        <div class="form-field">
          <label>Fase de Desenvolvimento</label>
          <select id="edStageInput" class="input-control" required>
            <option value="Germinação e Emergência" ${rec.stage === "Germinação e Emergência" ? "selected" : ""}>Germinação e Emergência</option>
            <option value="Desenvolvimento Vegetativo" ${rec.stage === "Desenvolvimento Vegetativo" ? "selected" : ""}>Desenvolvimento Vegetativo</option>
            <option value="Floração Plena" ${rec.stage === "Floração Plena" ? "selected" : ""}>Floração Plena</option>
            <option value="Enchimento de Grãos / Frutificação" ${rec.stage === "Enchimento de Grãos / Frutificação" ? "selected" : ""}>Enchimento de Grãos / Frutificação</option>
            <option value="Maturação Fisiológica (Ponto de Colheita)" ${rec.stage === "Maturação Fisiológica (Ponto de Colheita)" ? "selected" : ""}>Maturação Fisiológica (Ponto de Colheita)</option>
          </select>
        </div>
        <div class="form-field">
          <label>Progresso do Ciclo (%)</label>
          <input type="number" id="edProgressInput" class="input-control" required min="5" max="100" step="1" value="${rec.progress}" />
        </div>
      </div>
      <div class="grid-2">
        <div class="form-field">
          <label>Umidade na Área (%)</label>
          <input type="number" id="edMoistInput" class="input-control" required min="0" max="100" step="0.5" value="${rec.moisture}" />
        </div>
        <div class="form-field">
          <label>Temperatura (°C)</label>
          <input type="number" id="edTempInput" class="input-control" required min="-10" max="55" step="0.5" value="${rec.temperature}" />
        </div>
      </div>
      <div class="form-field">
        <label>Condição Climática</label>
        <input type="text" id="edWeatherInput" class="input-control" required value="${escapeHTML(rec.weatherCondition)}" />
      </div>
    `;
  } else if (rec.category === "decisao") {
    fieldsBox.innerHTML = `
      <div class="form-field">
        <label>Relação com a Recomendação</label>
        <input type="text" id="edAdherenceInput" class="input-control" required value="${escapeHTML(rec.adherence)}" />
      </div>
      <div class="form-field">
        <label>Decisão Executada na Prática</label>
        <input type="text" id="edActionInput" class="input-control" required value="${escapeHTML(rec.actionTaken)}" />
      </div>
    `;
  } else if (rec.category === "colheita") {
    fieldsBox.innerHTML = `
      <div class="grid-2">
        <div class="form-field">
          <label>Produtividade Obtida</label>
          <input type="text" id="edYieldInput" class="input-control" required value="${escapeHTML(rec.yield)}" />
        </div>
        <div class="form-field">
          <label>Umidade Final (%)</label>
          <input type="number" id="edFinalMoistInput" class="input-control" required min="5" max="90" step="0.5" value="${rec.finalMoisture}" />
        </div>
      </div>
      <div class="form-field">
        <label>Qualidade da Produção</label>
        <input type="text" id="edQualityInput" class="input-control" required value="${escapeHTML(rec.quality)}" />
      </div>
    `;
  }

  document.getElementById("modalEditRecord").classList.add("open");
}

function closeEditModal() {
  document.getElementById("modalEditRecord").classList.remove("open");
}

function onConfirmEditRecordSubmit(e) {
  e.preventDefault();
  if (!verifyConnectionBeforeSave()) return;

  const { db, crop } = getActiveSessionData();
  const recId = document.getElementById("editRecordId").value;
  const rec = (crop.records || []).find(r => r.id === recId);
  if (!rec) return;

  rec.date = document.getElementById("editRecordDate").value;
  rec.notes = document.getElementById("editRecordNotes").value.trim();

  if (rec.category === "plantio_clima") {
    rec.moisture = Number(document.getElementById("edMoistInput").value);
    rec.temperature = Number(document.getElementById("edTempInput").value);
    rec.rainfall = Number(document.getElementById("edRainInput").value);
    rec.weatherCondition = document.getElementById("edWeatherInput").value.trim();
    crop.plantingDate = rec.date;
  } else if (rec.category === "desenvolvimento") {
    rec.stage = document.getElementById("edStageInput").value;
    rec.progress = Number(document.getElementById("edProgressInput").value);
    rec.moisture = Number(document.getElementById("edMoistInput").value);
    rec.temperature = Number(document.getElementById("edTempInput").value);
    rec.weatherCondition = document.getElementById("edWeatherInput").value.trim();
  } else if (rec.category === "decisao") {
    rec.adherence = document.getElementById("edAdherenceInput").value.trim();
    rec.actionTaken = document.getElementById("edActionInput").value.trim();
  } else if (rec.category === "colheita") {
    rec.yield = document.getElementById("edYieldInput").value.trim();
    rec.finalMoisture = Number(document.getElementById("edFinalMoistInput").value);
    rec.quality = document.getElementById("edQualityInput").value.trim();
    crop.harvestConclusion = {
      date: rec.date,
      yield: rec.yield,
      finalMoisture: rec.finalMoisture,
      quality: rec.quality,
      notes: rec.notes
    };
  }

  saveCloudDatabase(db);
  closeEditModal();
  refreshApplicationView();
  showMessageToast("Alteração salva com sucesso! As recomendações da safra foram recalculadas.", false);
}

function removeRecord(recordId) {
  if (!verifyConnectionBeforeSave()) return;

  const { db, crop } = getActiveSessionData();
  const rec = (crop.records || []).find(r => r.id === recordId);
  if (!rec) return;

  crop.records = crop.records.filter(r => r.id !== recordId);
  if (rec.category === "colheita") {
    crop.harvestConclusion = null;
  } else if (rec.category === "plantio_clima") {
    const remaining = crop.records.filter(r => r.category === "plantio_clima");
    crop.plantingDate = remaining.length > 0 ? remaining[remaining.length - 1].date : "";
  }

  saveCloudDatabase(db);
  refreshApplicationView();
  showMessageToast("Registro excluído com sucesso.", false);
}

// ----------------------------------------------------------------------------
// Modal de Feedback / Ajuda (Redirecionamento Direto para WhatsApp e E-mail)
// ----------------------------------------------------------------------------
function openFeedbackModal() {
  document.getElementById("modalFeedback").classList.add("open");
}

function closeFeedbackModal() {
  document.getElementById("modalFeedback").classList.remove("open");
}

function dispatchFeedback(channel) {
  const subject = document.getElementById("feedbackSubject").value;
  const details = document.getElementById("feedbackText").value.trim() ||
    "Olá equipe de suporte, gostaria de relatar uma dúvida ou sugestão sobre o sistema.";
  const message = `[${subject}] ${details}`;

  if (channel === "whatsapp") {
    window.open("https://wa.me/5541999999999?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
  } else {
    window.location.href = `mailto:suporte@agrocampo.com.br?subject=${encodeURIComponent("Feedback AgroCampo - " + subject)}&body=${encodeURIComponent(details)}`;
  }
  closeFeedbackModal();
}

window.addEventListener("DOMContentLoaded", () => {
  getCloudDatabase();
  updateConnectionBanner();
});
