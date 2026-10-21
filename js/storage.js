/*
 * PromptOps Storage — Camada de Persistência via localStorage
 *
 * Formato armazenado (v2):
 *   { prompts: [...], versions: [...] }
 *
 * Retrocompatibilidade: se o valor salvo for um Array (formato v1, lista
 * plana de prompts com "version" embutido), migra automaticamente para v2.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "promptops_academy_prompts";

  // -------------------------------------------------------
  // Leitura interna — retorna { prompts, versions }
  // -------------------------------------------------------
  function loadStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { prompts: [], versions: [] };

      var parsed = JSON.parse(raw);

      // Formato v2 esperado: { prompts: [], versions: [] }
      if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.prompts)) {
        return {
          prompts: parsed.prompts || [],
          versions: parsed.versions || []
        };
      }

      // Formato v1 legado: array plano de prompts com "version" embutido
      // Migra para v2 extraindo as versões embutidas
      if (Array.isArray(parsed)) {
        var migratedPrompts = [];
        var migratedVersions = [];
        parsed.forEach(function (item) {
          var prompt = Object.assign({}, item);
          if (item.version && item.version.id) {
            migratedVersions.push(item.version);
            delete prompt.version;
          }
          migratedPrompts.push(prompt);
        });
        // Persiste o formato migrado
        saveStore({ prompts: migratedPrompts, versions: migratedVersions });
        return { prompts: migratedPrompts, versions: migratedVersions };
      }
    } catch (e) {
      console.error("PromptOps: Erro ao carregar do localStorage", e);
    }
    return { prompts: [], versions: [] };
  }

  // -------------------------------------------------------
  // Escrita interna
  // -------------------------------------------------------
  function saveStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      console.error("PromptOps: Erro ao salvar no localStorage", e);
      return false;
    }
  }

  // -------------------------------------------------------
  // API pública
  // -------------------------------------------------------

  /**
   * Retorna apenas os prompts persistidos (sem versões).
   * Mantido para retrocompatibilidade com eventuais chamadas externas.
   */
  function loadPersistedPrompts() {
    return loadStore().prompts;
  }

  /**
   * Salva um novo prompt + sua versão.
   * Aceita um objeto promptData que pode conter:
   *   - promptData.version  (objeto de versão embutido — padrão do registration.js)
   * Separa os dois ao persistir.
   */
  function saveNewPrompt(promptData) {
    var store = loadStore();

    // Extrai a versão embutida, se existir
    var version = promptData.version || null;
    var prompt = Object.assign({}, promptData);
    delete prompt.version;

    // Evita duplicatas por id
    var alreadyExists = store.prompts.some(function (p) {
      return p.id === prompt.id;
    });
    if (!alreadyExists) {
      store.prompts.push(prompt);
    }

    if (version && version.id) {
      var versionExists = store.versions.some(function (v) {
        return v.id === version.id;
      });
      if (!versionExists) {
        store.versions.push(version);
      }
    }

    if (!saveStore(store)) {
      throw new Error("Não foi possível gravar os dados no armazenamento local.");
    }

    // Notifica o catálogo para atualizar
    if (
      global.PromptOpsCatalog &&
      typeof global.PromptOpsCatalog.refreshData === "function"
    ) {
      global.PromptOpsCatalog.refreshData();
    }
  }

  /**
   * Retorna os dados consolidados: prompts e versões oficiais (baseData)
   * mesclados com os dados persistidos no localStorage.
   *
   * @param {Array}  basePrompts   — prompts do prompts.json
   * @param {Array}  baseVersions  — versões do prompts.json
   * @returns {{ prompts: Array, versions: Array }}
   */
  function getConsolidatedData(basePrompts, baseVersions) {
    var store = loadStore();

    // IDs já existentes na base oficial
    var basePromptIds = (basePrompts || []).reduce(function (acc, p) {
      acc[p.id] = true;
      return acc;
    }, {});
    var baseVersionIds = (baseVersions || []).reduce(function (acc, v) {
      acc[v.id] = true;
      return acc;
    }, {});

    // Filtra persistidos que não são duplicatas dos oficiais
    var newPrompts = store.prompts.filter(function (p) {
      return !basePromptIds[p.id];
    });
    var newVersions = store.versions.filter(function (v) {
      return !baseVersionIds[v.id];
    });

    return {
      prompts: (basePrompts || []).concat(newPrompts),
      versions: (baseVersions || []).concat(newVersions)
    };
  }

  /**
   * @deprecated Use getConsolidatedData() para obter prompts e versões juntos.
   * Mantido para retrocompatibilidade.
   */
  function getConsolidatedPrompts(basePrompts) {
    return getConsolidatedData(basePrompts, []).prompts;
  }

  global.PromptOpsStorage = Object.freeze({
    loadPersistedPrompts: loadPersistedPrompts,
    saveNewPrompt: saveNewPrompt,
    getConsolidatedData: getConsolidatedData,
    getConsolidatedPrompts: getConsolidatedPrompts
  });
})(globalThis);
