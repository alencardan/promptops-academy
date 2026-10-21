(function (global) {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const modal = document.querySelector('#modal');
    const form = document.querySelector('#prompt-form');
    const formMessage = document.querySelector('#form-message');
    const newPromptBtn = document.querySelector('#new-prompt');
    const modalCloseBtn = document.querySelector('#modal-close');
    const modalCancelBtn = document.querySelector('#modal-cancel');

    if (!modal || !form) return;

    const formCategory = form.elements.categoryId;
    const formSubcategory = form.elements.subcategoryId;

    let categoriesData = [];

    /**
     * Carrega categorias para o formulário.
     * Tenta reutilizar os dados já carregados pelo catálogo para evitar
     * uma segunda requisição a data/prompts.json. Faz fetch apenas como
     * fallback, se os dados do catálogo ainda não estiverem disponíveis.
     */
    function loadCategories() {
      // Tenta reutilizar dados do catálogo se já estiverem disponíveis
      if (
        global._promptOpsBaseData &&
        Array.isArray(global._promptOpsBaseData.categories)
      ) {
        categoriesData = global._promptOpsBaseData.categories;
        fillFormCategories();
        return;
      }

      // Fallback: busca direta ao JSON
      fetch('./data/prompts.json')
        .then(response => response.json())
        .then(data => {
          if (data && Array.isArray(data.categories)) {
            categoriesData = data.categories;
            fillFormCategories();
          }
        })
        .catch(error => {
          console.error("Registration: Erro ao carregar categorias", error);
          // Garante que o formulário continua funcional mesmo sem categorias
          fillFormCategories();
        });
    }

    loadCategories();

    function fillFormCategories() {
      const options = categoriesData.map(category => `<option value="${category.id}">${category.name}</option>`).join('');
      formCategory.innerHTML = '<option value="">Selecione a categoria</option>' + options;
      fillFormSubcategories();
    }

    function fillFormSubcategories() {
      const selectedCat = categoriesData.find(c => c.id === formCategory.value);
      const subcats = selectedCat && selectedCat.subcategories ? selectedCat.subcategories : [];
      
      const options = subcats.map(sub => {
        const id = typeof sub === 'string' ? sub : sub.id;
        const name = typeof sub === 'string' ? sub : (sub.name || sub.id);
        return `<option value="${id}">${name}</option>`;
      }).join('');
      
      formSubcategory.innerHTML = `<option value="">${options ? 'Selecione a subcategoria' : 'Selecione a categoria primeiro'}</option>${options}`;
    }

    formCategory.addEventListener('change', fillFormSubcategories);

    function openModal() {
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      form.elements.title.focus();
    }

    function closeModal() {
      modal.hidden = true;
      document.body.style.overflow = '';
      form.reset();
      if (formMessage) {
        formMessage.hidden = true;
        formMessage.className = 'form-message error';
      }
      fillFormSubcategories();
    }

    if (newPromptBtn) newPromptBtn.addEventListener('click', openModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);
    
    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.hidden) closeModal();
    });

    function makeId(prefix) {
      return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }

    function validatePrompt(formData) {
      const title = formData.get('title').trim();
      const text = formData.get('text').trim();
      const categoryId = formData.get('categoryId');
      const subcategoryId = formData.get('subcategoryId');
      
      if (title.length < 8) return 'O título precisa ter pelo menos 8 caracteres.';
      if (text.length < 80) return 'O texto do prompt precisa ter pelo menos 80 caracteres.';
      if (!categoryId || !subcategoryId) return 'Selecione uma categoria e subcategoria válidas.';
      
      return '';
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      
      const formData = new FormData(form);
      const error = validatePrompt(formData);
      
      if (error) {
        formMessage.textContent = error;
        formMessage.hidden = false;
        return;
      }
      
      const promptId = makeId('prompt');
      const versionId = makeId('version');
      
      const tagsString = formData.get('tags') || '';
      const tagsArray = tagsString.split(',').map(tag => tag.trim()).filter(Boolean);

      // Adaptação dos dados ao formato utilizado em data/prompts.json
      const promptData = {
        id: promptId,
        title: formData.get('title').trim(),
        categoryId: formData.get('categoryId'),
        subcategoryId: formData.get('subcategoryId'),
        tags: tagsArray,
        problem: formData.get('problem').trim(),
        objective: formData.get('objective').trim(),
        responsible: formData.get('responsible').trim(),
        status: formData.get('status'),
        maturity: formData.get('maturity'),
        currentVersionId: versionId,
        version: {
          id: versionId,
          promptId: promptId,
          number: 1,
          text: formData.get('text').trim(),
          context: formData.get('context') ? formData.get('context').trim() : '',
          restrictions: formData.get('restrictions') ? formData.get('restrictions').trim() : '',
          format: formData.get('format') ? formData.get('format').trim() : '',
          qualityCriteria: formData.get('qualityCriteria') ? formData.get('qualityCriteria').trim() : '',
          nextAction: formData.get('nextAction') ? formData.get('nextAction').trim() : '',
          author: formData.get('responsible').trim(),
          createdAt: new Date().toISOString().split('T')[0]
        }
      };
      
      // Chamada para camada de persistência
      if (global.PromptOpsStorage && typeof global.PromptOpsStorage.saveNewPrompt === 'function') {
        try {
          global.PromptOpsStorage.saveNewPrompt(promptData);
          if (formMessage) {
            formMessage.textContent = 'Prompt salvo com sucesso!';
            formMessage.className = 'form-message success';
            formMessage.hidden = false;
          }
          setTimeout(() => closeModal(), 1500);
        } catch (e) {
          console.error("Erro ao salvar:", e);
          if (formMessage) {
            formMessage.textContent = 'Erro ao salvar o prompt. Tente novamente.';
            formMessage.className = 'form-message error';
            formMessage.hidden = false;
          }
        }
      } else {
        console.error("PromptOpsStorage indisponível!");
        if (formMessage) {
          formMessage.textContent = 'Erro interno: Storage indisponível.';
          formMessage.className = 'form-message error';
          formMessage.hidden = false;
        }
      }
    });
  });
})(globalThis);
