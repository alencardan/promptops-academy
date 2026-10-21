/*
 * PromptOps Catalog — Integração de Busca, Filtros e Interface Visual.
 * Módulo unificado: Filtros (Levi) + Renderização de Interface (Carlos).
 */
(function (global) {
  "use strict";

  // ============================================================
  // LÓGICA DE BUSCA E FILTROS
  // ============================================================

  const CAMPOS_DE_FILTRO = [
    "categoryId",
    "subcategoryId",
    "status",
    "maturity",
  ];

  function normalizarTexto(valor) {
    if (typeof valor !== "string") {
      return "";
    }

    return valor
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  // Remove Markdown de links:
  // [Texto](https://exemplo.com) -> Texto
  function limparMarkdown(valor) {
    if (typeof valor !== "string") {
      return "";
    }

    return valor
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`#]/g, "")
      .trim();
  }

  function correspondeABusca(prompt, buscaNormalizada) {
    if (!buscaNormalizada) {
      return true;
    }

    var textos = [
      limparMarkdown(prompt.title),
      limparMarkdown(prompt.objective),
      limparMarkdown(prompt.problem),
    ];

    if (Array.isArray(prompt.tags)) {
      textos.push.apply(
        textos,
        prompt.tags.map(function (tag) {
          return limparMarkdown(tag);
        })
      );
    }

    return textos.some(function (texto) {
      return normalizarTexto(texto).includes(buscaNormalizada);
    });
  }

  function filtroEstaAtivo(valor) {
    return (
      valor !== undefined &&
      valor !== null &&
      !(typeof valor === "string" && valor.trim() === "")
    );
  }

  function correspondeAosFiltros(prompt, criterios) {
    return CAMPOS_DE_FILTRO.every(function (campo) {
      return (
        !filtroEstaAtivo(criterios[campo]) ||
        prompt[campo] === criterios[campo]
      );
    });
  }

  function filtrarPrompts(prompts, criterios) {
    if (!Array.isArray(prompts)) {
      return [];
    }

    var consulta =
      criterios && typeof criterios === "object"
        ? criterios
        : {};

    var buscaNormalizada = normalizarTexto(
      limparMarkdown(consulta.busca)
    );

    return prompts.filter(function (prompt) {
      if (!prompt || typeof prompt !== "object") {
        return false;
      }

      return (
        correspondeABusca(prompt, buscaNormalizada) &&
        correspondeAosFiltros(prompt, consulta)
      );
    });
  }

  function limparFiltros(criterios) {
    var consulta =
      criterios && typeof criterios === "object"
        ? criterios
        : {};

    var criteriosLimpos = {};

    if (
      Object.prototype.hasOwnProperty.call(consulta, "busca")
    ) {
      criteriosLimpos.busca = consulta.busca;
    }

    return criteriosLimpos;
  }

  // ============================================================
  // FUNÇÕES DA INTERFACE — CRIAÇÃO DE CARDS
  // ============================================================

  var STATUS_LABELS = {
    rascunho: "Rascunho",
    em_revisao: "Em revisão",
    publicado: "Publicado",
    arquivado: "Arquivado",
  };

  var STATUS_CSS = {
    rascunho: "status-rascunho",
    em_revisao: "status-em-revisao",
    publicado: "status-publicado",
    arquivado: "status-arquivado",
  };

  var MATURITY_LABELS = {
    experimental: "Experimental",
    em_validacao: "Em validação",
    validado: "Validado",
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }

    return node;
  }

  function badgeColor(index) {
    if (index % 3 === 1) return "blue";
    if (index % 3 === 2) return "green";
    return "";
  }

  /**
   * Cria um card seguindo a estrutura HTML esperada pelo CSS:
   *
   *   article.prompt-card
   *     div.card-top
   *       span.category-badge[.blue|.green]
   *       span.favorite-mark
   *     h3 > a
   *     p.objective
   *     p.subcategory
   *     div.tags > span.tag …
   *     div.card-footer
   *       span.status-{status}
   *       span (maturidade)
   *       span (versão)
   */
  function createCard(prompt, context) {
    var category = context.categories.find(function (c) {
      return c.id === prompt.categoryId;
    });

    var subcategoryName = "";
    if (category && Array.isArray(category.subcategories)) {
      var found = category.subcategories.find(function (s) {
        return typeof s === "string"
          ? s === prompt.subcategoryId
          : s.id === prompt.subcategoryId;
      });
      subcategoryName =
        typeof found === "string"
          ? found
          : found
            ? found.name || found.id
            : "";
    }

    var version = context.versions.find(function (v) {
      return v.id === prompt.currentVersionId;
    });

    var categoryIndex = category
      ? Math.max(0, context.categories.indexOf(category))
      : 0;

    // --- article.prompt-card ---
    var card = el("article", "prompt-card");
    card.setAttribute("aria-labelledby", "title-" + prompt.id);

    // --- div.card-top ---
    var top = el("div", "card-top");

    var badgeCls = "category-badge";
    var color = badgeColor(categoryIndex);
    if (color) badgeCls += " " + color;

    top.appendChild(
      el("span", badgeCls, category ? category.name : "Categoria")
    );
    top.appendChild(el("span", "favorite-mark", "☆"));

    // --- h3 > a ---
    var heading = document.createElement("h3");
    heading.id = "title-" + prompt.id;

    var link = document.createElement("a");
    link.href =
      "prompt.html?id=" + encodeURIComponent(prompt.id);
    link.textContent = limparMarkdown(prompt.title);
    heading.appendChild(link);

    // --- p.objective ---
    var objective = el(
      "p",
      "objective",
      limparMarkdown(prompt.problem || prompt.objective || "")
    );

    // --- p.subcategory ---
    var sub = el(
      "p",
      "subcategory",
      subcategoryName || "Geral"
    );

    // --- div.tags ---
    var tagsContainer = el("div", "tags");
    (prompt.tags || []).slice(0, 3).forEach(function (tagText) {
      tagsContainer.appendChild(
        el("span", "tag", "#" + limparMarkdown(tagText))
      );
    });

    // --- div.card-footer ---
    var footer = el("div", "card-footer");

    var statusCss = STATUS_CSS[prompt.status] || "";
    footer.appendChild(
      el(
        "span",
        statusCss,
        STATUS_LABELS[prompt.status] || prompt.status || "Status"
      )
    );

    footer.appendChild(
      el(
        "span",
        "",
        MATURITY_LABELS[prompt.maturity] ||
          prompt.maturity ||
          "Maturidade"
      )
    );

    footer.appendChild(
      el("span", "", "v" + (version ? version.number : 1))
    );

    // --- Monta o card ---
    card.appendChild(top);
    card.appendChild(heading);
    card.appendChild(objective);
    card.appendChild(sub);
    card.appendChild(tagsContainer);
    card.appendChild(footer);

    return card;
  }

  // ============================================================
  // ESTADOS DO CATÁLOGO (loading / error / empty / hidden)
  // ============================================================

  function showState(type, message) {
    var state = document.querySelector("#catalog-state");
    if (!state) return;

    state.classList.remove("hidden", "empty", "error", "loading");
    state.removeAttribute("hidden");
    state.innerHTML = "";

    if (type === "loading") {
      state.classList.add("loading");
      state.appendChild(el("div", "spinner"));
      state.appendChild(
        el("p", null, message || "Carregando catálogo...")
      );
      return;
    }

    if (type === "error") {
      state.classList.add("error");
      state.appendChild(
        el("h3", null, "Não foi possível carregar os prompts")
      );
      state.appendChild(
        el(
          "p",
          null,
          message ||
            "Verifique sua conexão ou tente novamente mais tarde."
        )
      );
      return;
    }

    if (type === "search-empty") {
      state.classList.add("empty");
      state.appendChild(
        el("h3", null, "Nenhum prompt encontrado")
      );
      state.appendChild(
        el(
          "p",
          null,
          "Tente ajustar os termos da busca ou limpar os filtros aplicados."
        )
      );
      return;
    }

    // empty (catálogo vazio)
    state.classList.add("empty");
    state.appendChild(
      el("h3", null, "Catálogo em construção")
    );
    state.appendChild(
      el(
        "p",
        null,
        message || "Nenhum prompt foi cadastrado até o momento."
      )
    );
  }

  // ============================================================
  // RENDERIZAÇÃO PRINCIPAL
  // ============================================================

  function render(data, filters) {
    data = data || {};
    filters = filters || {};

    var grid = document.querySelector("#prompt-grid");
    var resultCount = document.querySelector("#result-count");
    var promptCount = document.querySelector("#prompt-count");
    var categoryCount = document.querySelector("#category-count");
    var pipelineCount = document.querySelector("#pipeline-count");

    if (!grid) {
      console.error("PromptOps: #prompt-grid não encontrado.");
      return;
    }

    var safeData = {
      prompts: Array.isArray(data.prompts) ? data.prompts : [],
      categories: Array.isArray(data.categories)
        ? data.categories
        : [],
      versions: Array.isArray(data.versions)
        ? data.versions
        : [],
      tests: Array.isArray(data.tests) ? data.tests : [],
    };

    grid.innerHTML = "";

    var items = filtrarPrompts(safeData.prompts, filters);

    console.log(
      "PromptOps: busca:",
      filters.busca,
      "| resultados:",
      items.length
    );

    if (!safeData.prompts.length) {
      showState("empty");
    } else if (!items.length) {
      showState("search-empty");
    } else {
      var state = document.querySelector("#catalog-state");
      if (state) {
        state.classList.add("hidden");
        state.setAttribute("hidden", "");
      }

      var fragment = document.createDocumentFragment();
      items.forEach(function (prompt) {
        fragment.appendChild(createCard(prompt, safeData));
      });
      grid.appendChild(fragment);
    }

    // Atualiza contadores
    if (resultCount) {
      var n = items.length;
      resultCount.textContent =
        n === 1 ? "1 resultado" : n + " resultados";
    }

    if (promptCount) {
      promptCount.textContent = String(safeData.prompts.length);
    }

    if (categoryCount) {
      categoryCount.textContent = String(
        data.totalCategories !== undefined
          ? data.totalCategories
          : safeData.categories.length
      );
    }

    if (pipelineCount) {
      pipelineCount.textContent = String(
        data.totalPipelines !== undefined
          ? data.totalPipelines
          : 0
      );
    }
  }

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================

  document.addEventListener("DOMContentLoaded", function () {
    console.log("PromptOps: JavaScript carregado.");

    var currentData = null;
    var originalPrompts = null;
    var originalVersions = null;

    // --------------------------------------------------------
    // ELEMENTOS
    // --------------------------------------------------------

    var catalogSearch = document.querySelector("#catalog-search");
    var globalSearch = document.querySelector("#global-search");
    var categoryFilter = document.querySelector("#category-filter");
    var subcategoryFilter = document.querySelector(
      "#subcategory-filter"
    );
    var statusFilter = document.querySelector("#status-filter");
    var maturityFilter = document.querySelector("#maturity-filter");

    // --------------------------------------------------------
    // PEGA OS FILTROS ATUAIS
    // --------------------------------------------------------

    function getFilters() {
      var buscaCatalogo = catalogSearch
        ? catalogSearch.value.trim()
        : "";

      var buscaGlobal = globalSearch
        ? globalSearch.value.trim()
        : "";

      return {
        busca: buscaCatalogo || buscaGlobal,
        categoryId: categoryFilter ? categoryFilter.value : "",
        subcategoryId: subcategoryFilter
          ? subcategoryFilter.value
          : "",
        status: statusFilter ? statusFilter.value : "",
        maturity: maturityFilter ? maturityFilter.value : "",
      };
    }

    // --------------------------------------------------------
    // ATUALIZA O CATÁLOGO
    // --------------------------------------------------------

    function updateCatalog() {
      if (!currentData) {
        console.warn(
          "PromptOps: dados ainda não foram carregados."
        );
        return;
      }

      var filters = getFilters();
      console.log("PromptOps: atualizando catálogo", filters);
      render(currentData, filters);
    }

    function refreshData() {
      if (!currentData || !originalPrompts) return;

      // Usa getConsolidatedData para obter prompts E versões persistidas
      if (
        global.PromptOpsStorage &&
        typeof global.PromptOpsStorage.getConsolidatedData === "function"
      ) {
        var consolidated = global.PromptOpsStorage.getConsolidatedData(
          originalPrompts,
          originalVersions
        );
        currentData.prompts = consolidated.prompts;
        currentData.versions = consolidated.versions;
      } else {
        currentData.prompts = originalPrompts.slice();
      }

      // Expõe refreshData no objeto público (seguro pois catalogAPI já existe)
      if (global.PromptOpsCatalog) {
        global.PromptOpsCatalog.refreshData = refreshData;
      }

      updateCatalog();
    }

    // --------------------------------------------------------
    // POPULA FILTROS (categorias, subcategorias, status, maturidade)
    // --------------------------------------------------------

    function populateCategories(data) {
      if (categoryFilter && Array.isArray(data.categories)) {
        categoryFilter.innerHTML =
          '<option value="">Todas as categorias</option>';

        data.categories.forEach(function (category) {
          var option = document.createElement("option");
          option.value = category.id;
          option.textContent = category.name || category.id;
          categoryFilter.appendChild(option);
        });
      }

      if (statusFilter) {
        statusFilter.innerHTML =
          '<option value="">Todos os status</option>' +
          '<option value="rascunho">Rascunho</option>' +
          '<option value="em_revisao">Em revisão</option>' +
          '<option value="publicado">Publicado</option>' +
          '<option value="arquivado">Arquivado</option>';
      }

      if (maturityFilter) {
        maturityFilter.innerHTML =
          '<option value="">Todas as maturidades</option>' +
          '<option value="experimental">Experimental</option>' +
          '<option value="em_validacao">Em validação</option>' +
          '<option value="validado">Validado</option>';
      }

      // Subcategorias: começa vazio, preenche ao selecionar categoria
      populateSubcategories(data, "");
    }

    function populateSubcategories(data, selectedCategoryId) {
      if (!subcategoryFilter) return;

      subcategoryFilter.innerHTML =
        '<option value="">Todas as subcategorias</option>';

      if (
        !selectedCategoryId ||
        !Array.isArray(data.categories)
      ) {
        return;
      }

      var category = data.categories.find(function (c) {
        return c.id === selectedCategoryId;
      });

      if (!category || !Array.isArray(category.subcategories)) {
        return;
      }

      category.subcategories.forEach(function (sub) {
        var option = document.createElement("option");
        var name = typeof sub === "string" ? sub : sub.name || sub.id;
        option.value = typeof sub === "string" ? sub : sub.id;
        option.textContent = name;
        subcategoryFilter.appendChild(option);
      });
    }

    // --------------------------------------------------------
    // EVENTOS DA BUSCA E FILTROS
    // --------------------------------------------------------

    if (catalogSearch) {
      catalogSearch.addEventListener("input", updateCatalog);
      catalogSearch.addEventListener("change", updateCatalog);
      console.log("PromptOps: #catalog-search conectado.");
    } else {
      console.warn(
        "PromptOps: #catalog-search não encontrado."
      );
    }

    if (globalSearch) {
      globalSearch.addEventListener("input", updateCatalog);
      globalSearch.addEventListener("change", updateCatalog);
    }

    if (categoryFilter) {
      categoryFilter.addEventListener("change", function () {
        // Ao trocar categoria, atualiza subcategorias dinamicamente
        if (currentData) {
          populateSubcategories(
            currentData,
            categoryFilter.value
          );
        }
        updateCatalog();
      });
    }

    if (subcategoryFilter) {
      subcategoryFilter.addEventListener("change", updateCatalog);
    }

    if (statusFilter) {
      statusFilter.addEventListener("change", updateCatalog);
    }

    if (maturityFilter) {
      maturityFilter.addEventListener("change", updateCatalog);
    }

    var clearFiltersBtn = document.querySelector("#clear-filters");
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", function () {
        if (catalogSearch) catalogSearch.value = "";
        if (globalSearch) globalSearch.value = "";
        if (categoryFilter) categoryFilter.value = "";
        if (subcategoryFilter) subcategoryFilter.value = "";
        if (statusFilter) statusFilter.value = "";
        if (maturityFilter) maturityFilter.value = "";
        if (currentData) {
          populateSubcategories(currentData, "");
        }
        updateCatalog();
      });
    }

    // --------------------------------------------------------
    // MENU RESPONSIVO
    // --------------------------------------------------------

    var menuToggle = document.querySelector("#menu-toggle");
    var sidebar = document.querySelector("#sidebar");

    if (menuToggle && sidebar) {
      menuToggle.addEventListener("click", function () {
        var open = sidebar.classList.toggle("open");

        menuToggle.setAttribute(
          "aria-expanded",
          String(open)
        );

        menuToggle.setAttribute(
          "aria-label",
          open ? "Fechar menu" : "Abrir menu"
        );
      });

      sidebar.addEventListener("click", function (event) {
        if (
          event.target.closest("a") &&
          window.innerWidth <= 700
        ) {
          sidebar.classList.remove("open");
          menuToggle.setAttribute("aria-expanded", "false");
          menuToggle.setAttribute("aria-label", "Abrir menu");
        }
      });
    }

    // --------------------------------------------------------
    // CARREGAMENTO DO JSON
    // --------------------------------------------------------

    showState("loading");

    fetch("./data/prompts.json")
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        console.log(
          "PromptOps: prompts.json carregado.",
          data
        );

        currentData = data;
        originalPrompts = Array.isArray(data.prompts) ? data.prompts.slice() : [];
        originalVersions = Array.isArray(data.versions) ? data.versions.slice() : [];

        // Expõe os dados brutos do JSON para que outros módulos (ex: registration.js)
        // possam reutilizá-los sem fazer uma segunda requisição ao mesmo arquivo.
        global._promptOpsBaseData = data;

        refreshData();
        populateCategories(currentData);
      })
      .catch(function (error) {
        console.error(
          "PromptOps: erro ao carregar prompts.json:",
          error
        );

        showState(
          "error",
          "Não foi possível carregar os dados de data/prompts.json."
        );
      });
  });

  // ============================================================
  // EXPORTAÇÃO
  // ============================================================

  var catalogAPI = {
    render: render,
    showState: showState,
    createCard: createCard,
    filtrarPrompts: filtrarPrompts,
    limparFiltros: limparFiltros,
    // refreshData é atribuído pela primeira vez dentro do DOMContentLoaded,
    // após a função local ser definida. Placeholder seguro enquanto o DOM
    // não terminou de carregar.
    refreshData: function() {}
  };

  global.PromptOpsCatalog = catalogAPI;
})(globalThis);