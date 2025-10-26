// =============================================
//          1. CONFIGURAÇÃO DO SUPABASE (NO TOPO E CORRIGIDA)
// =============================================
const SUPABASE_URL = 'https://xgqexwbxemftetulesve.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncWV4d2J4ZW1mdGV0dWxlc3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NDQ3NjQsImV4cCI6MjA3NTQyMDc2NH0.YbK8BoKo3JwhADpSNo8CXzPZAEMxrowMkL8w2_KC-UI';

// CORREÇÃO: Usamos o objeto global 'supabase' para criar nossa instância.
// Vamos chamá-la de 'supabaseClient' para evitar conflitos.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const WHATSAPP_NUMBER = '558194628964'; // 👈 SUBSTITUA PELO SEU NÚMERO


// =============================================
//          FUNÇÕES GLOBAIS
// =============================================

// Função INTELIGENTE para carregar componentes (header/footer)
const loadComponent = (path, elementId) => {
    // Verifica se a página atual está dentro da pasta /pages/
    const isSubPage = window.location.pathname.includes('/pages/');
    
    // Constrói o caminho correto dependendo da página
    const finalPath = isSubPage ? `../${path}` : path;

    return fetch(finalPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Arquivo não encontrado: ${finalPath} (Status: ${response.status})`);
            }
            return response.text();
        })
        .then(data => {
            document.getElementById(elementId).innerHTML = data;
        
        })
        .catch(error => console.error(`ERRO ao carregar componente '${elementId}':`, error));
};

// Função que inicializa os scripts do menu (hambúrguer, etc.)
const initializeMenu = () => {
    const header = document.getElementById('main-header');
    if (!header) return;

    // Lógica de scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Lógica do Menu Hambúrguer
    const hamburger = document.querySelector('.hamburger-menu');
    const navMenu = document.querySelector('#main-header nav');
    const navLinks = document.querySelectorAll('#main-header nav ul li a');

    if (!hamburger || !navMenu || !navLinks) return;

    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('nav-active');
        hamburger.classList.toggle('is-active');
        document.body.classList.toggle('no-scroll');
    });

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navMenu.classList.contains('nav-active')) {
                navMenu.classList.remove('nav-active');
                hamburger.classList.remove('is-active');
                document.body.classList.remove('no-scroll');
            }
        });
    });
};

// =============================================
//          LÓGICA DA PÁGINA DE PRESENTES
// =============================================

// Função para BUSCAR os presentes no banco de dados
// EM script.js

async function fetchGifts() {
    console.log("Iniciando busca de presentes no Supabase..."); // Log de início

    const { data: gifts, error } = await supabaseClient
        .from('gifts')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('ERRO DO SUPABASE AO BUSCAR:', error); // Log de erro
        return [];
    }

    // ESTE É O LOG MAIS IMPORTANTE!
    console.log("Dados recebidos do Supabase:", gifts); 

    return gifts;
}



const createGiftCardHTML = (gift) => {
    const priceFormatted = parseFloat(gift.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    if (gift.isGifted) {
        // Retorna o HTML para um cartão "presenteado"
        return `
      <div class="gift-card gifted" data-aos="fade-up">
        <img src="${gift.image}" alt="${gift.name}">
        <div class="gift-card-content">
          <h3>${gift.name}</h3>
          <p class="description">${gift.description}</p>
          <p class="price">Presenteado</p>
          <button class="button" disabled>Já foi presenteado</button>
        </div>
      </div>
    `;
    } else {
        // Retorna o HTML para um cartão disponível
        return `
      <div class="gift-card" data-aos="fade-up">
        <img src="${gift.image}" alt="${gift.name}">
        <div class="gift-card-content">
          <h3>${gift.name}</h3>
          <p class="description">${gift.description}</p>
          <p class="price">${priceFormatted}</p>
          <button class="button gift-button" 
                  data-gift-name="${gift.name}" 
                  data-gift-value="${gift.price}" 
                  data-pix-key="${gift.pixKey}">
            Presentear
          </button>
        </div>
      </div>
    `;
    }
};

// =============================================
//          LÓGICA DA PÁGINA DE PRESENTES (v4.0 - com WhatsApp)
// =============================================
// EM SEU SCRIPT.JS, SUBSTITUA A FUNÇÃO ANTIGA POR ESTA

const initializeGiftPage = async () => {
    const gridContainer = document.getElementById('gift-grid-container');
    
    // Verificação inicial: se não estamos na página de presentes, a função para aqui.
    if (!gridContainer) {
        return;
    }

    // Busca e renderiza os presentes do Supabase
    const gifts = await fetchGifts();
    if (gifts && gifts.length > 0) {
        gridContainer.innerHTML = gifts.map(createGiftCardHTML).join('');
    } else {
        gridContainer.innerHTML = '<p>Carregando presentes...</p>';
    }

    // --- Início da Lógica do Modal ---
    const modal = document.getElementById('pix-modal');
    if (!modal) return; // Se o modal não existir, a função também para.

    // 1. Seleciona todos os elementos do modal PRIMEIRO
    const closeModalButton = document.querySelector('.close-modal');
    const modalGiftName = document.getElementById('modal-gift-name');
    const modalGiftValue = document.getElementById('modal-gift-value');
    const confirmationForm = document.getElementById('confirmation-form');
    const guestNameInput = document.getElementById('guest-name');
    const pixKeyInput = document.getElementById('pix-key-input');
    const copyPixKeyButton = document.getElementById('copy-pix-key-button');
    
    let currentGift = null;

    // 2. DEFINE as funções de abrir e fechar o modal
    const openModal = (gift) => {
        currentGift = gift;
        modalGiftName.textContent = gift.name;
        modalGiftValue.textContent = parseFloat(gift.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const qrcodeImg = document.getElementById('pix-qrcode-img');
        const isSubPage = window.location.pathname.includes('/pages/');

        // Define o caminho da imagem dinamicamente
        qrcodeImg.src = isSubPage ? "../images/qr-code.jpeg" : "images/qr-code.jpeg";

        if (guestNameInput) {
            guestNameInput.value = '';
        }

        modal.classList.add('active');
        document.body.classList.add('no-scroll');
    };

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.classList.remove('no-scroll');
    };

    // 3. ADICIONA todos os Event Listeners (agora que as funções já existem)
    
    // Evento para abrir o modal
    gridContainer.addEventListener('click', (event) => {
        if (event.target && event.target.classList.contains('gift-button')) {
            const button = event.target;
            const giftName = button.dataset.giftName;
            const selectedGift = gifts.find(g => g.name === giftName);
            if (selectedGift) openModal(selectedGift);
        }
    });

    // Eventos para fechar o modal
    closeModalButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });


if (copyPixKeyButton && pixKeyInput) {
    copyPixKeyButton.addEventListener('click', () => {
        // Copia o texto para a área de transferência
        pixKeyInput.select();
        document.execCommand('copy');
        
        // --- FEEDBACK VISUAL ---
        // Guarda o texto original do botão
        const originalText = copyPixKeyButton.querySelector('.copy-text').textContent;
        
        // Muda a aparência do botão
        copyPixKeyButton.classList.add('copied');
        copyPixKeyButton.querySelector('.copy-text').textContent = 'Copiado ✓';

        // Volta ao normal após 2 segundos
        setTimeout(() => {
            copyPixKeyButton.classList.remove('copied');
            copyPixKeyButton.querySelector('.copy-text').textContent = originalText;
        }, 2000);
    });
}

    // Evento para o SUBMIT do formulário que gera o link do WhatsApp
    if (confirmationForm) {
        confirmationForm.addEventListener('submit', (event) => {
            event.preventDefault(); 
            if (!currentGift) return;

            const guestName = guestNameInput.value;
            const giftName = currentGift.name;

            const message = `Olá! Gostaria de presentear vocês com: *${giftName}*.\n\nMeu nome é *${guestName}*.`;
            const encodedMessage = encodeURIComponent(message);
            const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

            window.open(whatsappUrl, '_blank');
            
            // A função closeModal() é chamada aqui, e agora ela existe!
            closeModal();
        });
    }
};

// ... (o resto do seu script.js, como o DOMContentLoaded, continua aqui) ...

// =============================================
//          EVENTO PRINCIPAL
// =============================================

document.addEventListener('DOMContentLoaded', () => {

    // Carrega o header, e SÓ DEPOIS inicializa o menu
    loadComponent('components/header.html', 'header-placeholder').then(initializeMenu);
    
    // Carrega o footer
    loadComponent('components/footer.html', 'footer-placeholder');
    
    // Se estiver na página de presentes, inicializa a lógica dela
    if (document.getElementById('gift-grid-container')) {
        initializeGiftPage();
    }
});