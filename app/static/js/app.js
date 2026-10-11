// Application State
let token = localStorage.getItem("token");
let currentUser = null;
let currentConversationId = null;
let conversations = [];
let documents = [];

// DOM Elements
const authBtn = document.getElementById("authBtn");
const userProfile = document.getElementById("userProfile");
const userEmailText = document.getElementById("userEmailText");
const authModalElement = document.getElementById("authModal");
const authModal = new bootstrap.Modal(authModalElement);
const authForm = document.getElementById("authForm");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const isLoginInput = document.getElementById("isLoginInput");
const authModalTitle = document.getElementById("authModalTitle");
const authToggleText = document.getElementById("authToggleText");
const authToggleLink = document.getElementById("authToggleLink");

// Sidebar & Layout elements
const sidebar = document.getElementById("sidebar");
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
const newChatBtn = document.getElementById("newChatBtn");
const conversationList = document.getElementById("conversationList");
const activeChatTitle = document.getElementById("activeChatTitle");
const deleteActiveChatBtn = document.getElementById("deleteActiveChatBtn");

// Document elements
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const uploadStatus = document.getElementById("uploadStatus");
const docList = document.getElementById("docList");
const docCountBadge = document.getElementById("docCountBadge");
const refreshDocsBtn = document.getElementById("refreshDocsBtn");

// Chat elements
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

// Confirmation Modal Elements
const confirmModalElement = document.getElementById("confirmModal");
const confirmModalTitle = document.getElementById("confirmModalTitle");
const confirmModalMessage = document.getElementById("confirmModalMessage");
const confirmModalActionBtn = document.getElementById("confirmModalActionBtn");
let pendingConfirmCallback = null;

function getConfirmModalInstance() {
  const el = document.getElementById("confirmModal");
  if (!el || typeof bootstrap === "undefined") return null;
  return bootstrap.Modal.getOrCreateInstance(el);
}

if (confirmModalElement) {
  confirmModalElement.addEventListener("hidden.bs.modal", () => {
    pendingConfirmCallback = null;
    document.querySelectorAll(".modal-backdrop").forEach(b => {
      if (!document.querySelector(".modal.show")) {
        b.remove();
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("padding-right");
      }
    });
  });
}

if (confirmModalActionBtn) {
  confirmModalActionBtn.addEventListener("click", async () => {
    if (typeof pendingConfirmCallback === "function") {
      const cb = pendingConfirmCallback;
      pendingConfirmCallback = null;
      const modalInstance = getConfirmModalInstance();
      if (modalInstance) modalInstance.hide();
      await cb();
    }
  });
}

function requestConfirmation(title, message, callback) {
  const modalEl = document.getElementById("confirmModal");
  const titleEl = document.getElementById("confirmModalTitle");
  const msgEl = document.getElementById("confirmModalMessage");
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  pendingConfirmCallback = callback;

  if (modalEl && typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();
  } else {
    if (confirm(`${title}\n${message}`)) {
      callback();
    }
  }
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  setupTextareaAutoResize();

  if (token) {
    await checkAuth();
  } else {
    updateAuthUI();
    renderWelcomeScreen();
  }
});

function closeMobileSidebar() {
  sidebar.classList.remove("open");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  if (sidebarBackdrop) sidebarBackdrop.classList.remove("show");
}

function toggleMobileSidebar() {
  sidebar.classList.toggle("open");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  if (sidebarBackdrop) {
    sidebarBackdrop.classList.toggle("show", sidebar.classList.contains("open"));
  }
}

function setupEventListeners() {
  // Mobile sidebar drawer toggle
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMobileSidebar();
    });
  }

  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", () => {
      closeMobileSidebar();
    });
  }

  // Close mobile sidebar on outside click
  document.addEventListener("click", (e) => {
    if (window.innerWidth < 992 && sidebar.classList.contains("open")) {
      if (!sidebar.contains(e.target) && !sidebarToggleBtn.contains(e.target)) {
        closeMobileSidebar();
      }
    }
  });

  // Auth toggle (Sign In vs Register)
  authToggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    const isLogin = isLoginInput.value === "true";
    if (isLogin) {
      isLoginInput.value = "false";
      authModalTitle.textContent = "Create an Account";
      authSubmitBtn.textContent = "Register";
      authToggleText.innerHTML = 'Already have an account? <a href="#" id="authToggleLink" class="text-primary text-decoration-none fw-semibold">Sign In</a>';
    } else {
      isLoginInput.value = "true";
      authModalTitle.textContent = "Sign In to IntelliBase";
      authSubmitBtn.textContent = "Sign In";
      authToggleText.innerHTML = 'Don\'t have an account? <a href="#" id="authToggleLink" class="text-primary text-decoration-none fw-semibold">Create one</a>';
    }
    document.getElementById("authToggleLink").addEventListener("click", arguments.callee);
  });

  // Auth Submit
  authForm.addEventListener("submit", handleAuthSubmit);

  // Sign out
  document.getElementById("signOutBtn").addEventListener("click", () => {
    token = null;
    currentUser = null;
    currentConversationId = null;
    localStorage.removeItem("token");
    conversations = [];
    documents = [];
    updateAuthUI();
    renderWelcomeScreen();
    showToast("Signed out successfully.");
  });

  // New Chat Button
  newChatBtn.addEventListener("click", () => {
    startNewChat();
    if (window.innerWidth < 992) sidebar.classList.remove("open");
  });

  // Delete Active Chat Button
  deleteActiveChatBtn.addEventListener("click", () => {
    if (currentConversationId) {
      deleteConversation(currentConversationId);
    }
  });

  // Refresh Docs
  refreshDocsBtn.addEventListener("click", fetchDocuments);

  // Switch to Documents Tab
  const docsTab = document.getElementById("docs-tab");
  if (docsTab) {
    docsTab.addEventListener("click", () => {
      fetchDocuments();
    });
  }

  // Upload File Click & Drag-Drop
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleFileUpload);

  ["dragenter", "dragover"].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    });
  });
  dropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleFileUpload();
    }
  });

  // Send Chat Message
  sendBtn.addEventListener("click", sendChatMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
}

function setupTextareaAutoResize() {
  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    const maxHeight = window.innerWidth < 768 ? 90 : 140;
    chatInput.style.height = Math.min(chatInput.scrollHeight, maxHeight) + "px";
  });
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value;
  const isLogin = isLoginInput.value === "true";

  authSubmitBtn.disabled = true;
  authSubmitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';

  try {
    if (isLogin) {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");

      token = data.access_token;
      localStorage.setItem("token", token);
      await checkAuth();
      authModal.hide();
      showToast("Signed in successfully!");
    } else {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");

      // Automatically sign in after registration
      isLoginInput.value = "true";
      return handleAuthSubmit(e);
    }
  } catch (err) {
    showToast(err.message, "danger");
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = isLogin ? "Sign In" : "Register";
  }
}

async function checkAuth() {
  try {
    const res = await fetch("/auth/me", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Invalid session");
    currentUser = await res.json();
    updateAuthUI();
    await Promise.all([fetchConversations(), fetchDocuments()]);
  } catch {
    token = null;
    currentUser = null;
    localStorage.removeItem("token");
    updateAuthUI();
    renderWelcomeScreen();
  }
}

function updateAuthUI() {
  const userEmailDropdown = document.getElementById("userEmailDropdown");
  if (currentUser) {
    authBtn.classList.add("d-none");
    userProfile.classList.remove("d-none");
    if (userEmailText) {
      userEmailText.textContent = currentUser.email;
      userEmailText.title = currentUser.email;
    }
    if (userEmailDropdown) {
      userEmailDropdown.textContent = currentUser.email;
      userEmailDropdown.title = currentUser.email;
    }
  } else {
    authBtn.classList.remove("d-none");
    userProfile.classList.add("d-none");
    docCountBadge.textContent = "0";

    // Show clean, welcoming signed-out state with Sign In buttons
    conversationList.innerHTML = `
      <div class="text-subtle text-center py-4 px-2 small">
        <i class="bi bi-chat-square-text fs-3 d-block mb-2 text-primary opacity-75"></i>
        <div class="fw-medium text-light mb-1">Sign in to save chat history</div>
        <div class="text-subtle mb-3" style="font-size: 0.74rem;">Your conversations will be privately saved here.</div>
        <button class="btn btn-glass btn-sm px-3" onclick="authModal.show()">
          <i class="bi bi-box-arrow-in-right me-1"></i>Sign In
        </button>
      </div>
    `;

    docList.innerHTML = `
      <div class="text-subtle text-center py-4 px-2 small">
        <i class="bi bi-file-earmark-lock fs-3 d-block mb-2 text-primary opacity-75"></i>
        <div class="fw-medium text-light mb-1">Sign in to manage documents</div>
        <div class="text-subtle mb-3" style="font-size: 0.74rem;">Upload and view reference PDFs for your private knowledge base.</div>
        <button class="btn btn-glass btn-sm px-3" onclick="authModal.show()">
          <i class="bi bi-box-arrow-in-right me-1"></i>Sign In
        </button>
      </div>
    `;
  }
}

// ---------------------------------------------------------------------------
// Conversation / Chat History
// ---------------------------------------------------------------------------
async function fetchConversations() {
  if (!token) {
    updateAuthUI();
    return;
  }
  try {
    const res = await fetch("/chat/conversations", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) {
      if (res.status === 401) {
        token = null;
        currentUser = null;
        localStorage.removeItem("token");
        updateAuthUI();
      }
      return;
    }
    conversations = await res.json();
    renderConversationList();
  } catch (err) {
    console.error("Error fetching conversations:", err);
  }
}

function renderConversationList() {
  if (!conversations.length) {
    conversationList.innerHTML = `
      <div class="text-subtle text-center py-4 small">
        <i class="bi bi-chat-dots fs-4 d-block mb-1 opacity-50"></i>
        No past chats yet.
      </div>
    `;
    return;
  }

  conversationList.innerHTML = conversations.map(c => `
    <div class="conversation-item ${c.id === currentConversationId ? 'active' : ''}" onclick="selectConversation(${c.id})">
      <i class="bi bi-chat-left-text me-2 opacity-75"></i>
      <span class="conversation-title-text" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</span>
      <button class="conversation-delete-btn" onclick="deleteConversation(${c.id}, event)" title="Delete chat">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `).join("");
}

function startNewChat() {
  if (activeTypewriterTimer) {
    clearInterval(activeTypewriterTimer);
    activeTypewriterTimer = null;
  }
  currentConversationId = null;
  activeChatTitle.textContent = "New Chat";
  deleteActiveChatBtn.classList.add("d-none");
  renderConversationList();
  renderWelcomeScreen();
  if (window.innerWidth < 992) closeMobileSidebar();
  chatInput.focus();
}

async function selectConversation(conversationId) {
  if (!token) return;
  if (activeTypewriterTimer) {
    clearInterval(activeTypewriterTimer);
    activeTypewriterTimer = null;
  }
  currentConversationId = conversationId;
  renderConversationList();

  if (window.innerWidth < 992) closeMobileSidebar();

  // Show loading indicator in message pane
  chatMessages.innerHTML = `
    <div class="d-flex align-items-center justify-content-center h-100 text-subtle py-5">
      <span class="spinner-border spinner-border-sm me-2 text-primary"></span>
      <span>Loading conversation history...</span>
    </div>
  `;

  try {
    const res = await fetch(`/chat/conversations/${conversationId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Could not load conversation");

    const conv = await res.json();
    activeChatTitle.textContent = conv.title || "Chat";
    deleteActiveChatBtn.classList.remove("d-none");

    chatMessages.innerHTML = "";

    if (!conv.messages || conv.messages.length === 0) {
      renderWelcomeScreen();
      return;
    }

    conv.messages.forEach(msg => {
      appendMessageBubble(msg.content, msg.role, msg.sources || []);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    showToast(err.message, "danger");
    renderWelcomeScreen();
  }
}

async function deleteConversation(conversationId, event) {
  if (event) event.stopPropagation();
  if (!token) return;

  const numId = Number(conversationId);
  const conv = conversations.find(c => Number(c.id) === numId);
  const convTitle = conv ? `"${conv.title}"` : "this conversation";

  requestConfirmation(
    "Delete Conversation?",
    `Are you sure you want to delete ${convTitle} and all its message history?`,
    async () => {
      try {
        const res = await fetch(`/chat/conversations/${numId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to delete conversation");

        showToast("Conversation deleted.");
        if (Number(currentConversationId) === numId) {
          startNewChat();
        }
        await fetchConversations();
      } catch (err) {
        showToast(err.message, "danger");
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Documents Management & Viewing
// ---------------------------------------------------------------------------
async function fetchDocuments() {
  if (!token) {
    updateAuthUI();
    return;
  }
  try {
    const res = await fetch("/documents", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) {
      if (res.status === 401) {
        token = null;
        currentUser = null;
        localStorage.removeItem("token");
        updateAuthUI();
      }
      return;
    }
    documents = await res.json();

    docCountBadge.textContent = documents.length;

    if (!documents.length) {
      docList.innerHTML = `
        <div class="text-subtle text-center py-4 small">
          <i class="bi bi-file-earmark-arrow-up fs-4 d-block mb-1 opacity-50"></i>
          No documents uploaded yet.<br>Upload a PDF above to get started.
        </div>
      `;
      return;
    }

    docList.innerHTML = documents.map(doc => {
      const dateStr = doc.created_at ? new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
      const viewUrl = `/documents/${doc.id}/view?token=${encodeURIComponent(token)}`;

      return `
        <div class="doc-item">
          <div class="d-flex align-items-center gap-2 overflow-hidden flex-grow-1">
            <i class="bi bi-file-earmark-pdf-fill text-danger fs-5 flex-shrink-0"></i>
            <div class="overflow-hidden">
              <div class="doc-item-title text-truncate" title="${escapeHtml(doc.filename)}">${escapeHtml(doc.filename)}</div>
              <div class="doc-item-date">${dateStr}</div>
            </div>
          </div>
          <div class="d-flex align-items-center gap-1 flex-shrink-0">
            <a href="${viewUrl}" target="_blank" class="btn-icon-action btn-view" title="Open and read PDF">
              <i class="bi bi-eye"></i>
              <span class="d-none d-sm-inline">View</span>
            </a>
            <button onclick="deleteDocumentItem(${doc.id}, '${escapeHtml(doc.filename)}')" class="btn-icon-action btn-del" title="Delete document">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error fetching documents:", err);
  }
}

async function handleFileUpload() {
  const file = fileInput.files[0];
  if (!file) return;

  if (!token) {
    authModal.show();
    showToast("Please sign in first to upload documents.", "warning");
    fileInput.value = "";
    return;
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    showToast("Only PDF documents are supported.", "danger");
    fileInput.value = "";
    return;
  }

  uploadStatus.innerHTML = `
    <div class="d-flex align-items-center justify-content-center text-primary py-2 small">
      <span class="spinner-border spinner-border-sm me-2"></span>
      <span>Extracting & indexing document...</span>
    </div>
  `;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/documents/upload", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Upload failed");

    showToast(`Successfully uploaded "${data.filename}"!`);
    await fetchDocuments();
  } catch (err) {
    showToast(err.message, "danger");
  } finally {
    uploadStatus.innerHTML = "";
    fileInput.value = "";
  }
}

async function deleteDocumentItem(docId, filename) {
  if (!token) return;

  requestConfirmation(
    "Delete Document?",
    `Are you sure you want to delete "${filename}"? Its vector chunks will also be removed from your knowledge base.`,
    async () => {
      try {
        const res = await fetch(`/documents/${docId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to delete document");

        showToast(`Deleted "${filename}".`);
        await fetchDocuments();
      } catch (err) {
        showToast(err.message, "danger");
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Interactive Chat / RAG
// ---------------------------------------------------------------------------
async function sendChatMessage() {
  const query = chatInput.value.trim();
  if (!query) return;

  if (!token) {
    authModal.show();
    showToast("Please sign in first to ask questions.", "warning");
    return;
  }

  // Remove welcome screen if present
  const welcome = document.querySelector(".welcome-container");
  if (welcome) welcome.remove();

  // Append user message
  appendMessageBubble(query, "user");
  chatInput.value = "";
  chatInput.style.height = "auto";

  // Append thinking bubble
  const thinkingId = "thinking-" + Date.now();
  const thinkingRow = document.createElement("div");
  thinkingRow.className = "message-row assistant";
  thinkingRow.id = thinkingId;
  thinkingRow.innerHTML = `
    <div class="message-bubble">
      <div class="d-flex align-items-center gap-2 text-subtle">
        <span class="spinner-grow spinner-grow-sm text-primary"></span>
        <span class="small fst-italic">Reading documents & synthesizing answer...</span>
      </div>
    </div>
  `;
  chatMessages.appendChild(thinkingRow);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  sendBtn.disabled = true;

  try {
    const res = await fetch("/chat/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        query: query,
        conversation_id: currentConversationId,
        top_k: 8
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error generating response");

    // Remove thinking bubble
    const elem = document.getElementById(thinkingId);
    if (elem) elem.remove();

    // If starting a new conversation, record its ID
    if (!currentConversationId && data.conversation_id) {
      currentConversationId = data.conversation_id;
      deleteActiveChatBtn.classList.remove("d-none");
    }

    if (data.conversation_title) {
      activeChatTitle.textContent = data.conversation_title;
    }

    // Refresh conversation list to show new conversation / updated title
    await fetchConversations();
    const activeConv = conversations.find(c => Number(c.id) === Number(currentConversationId));
    if (activeConv) {
      activeChatTitle.textContent = activeConv.title;
    }

    // Append synthesized assistant answer with animated typewriter effect
    appendMessageBubble(data.answer, "assistant", data.sources || [], true);
  } catch (err) {
    const elem = document.getElementById(thinkingId);
    if (elem) {
      elem.innerHTML = `
        <div class="message-bubble border border-danger text-danger">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>${escapeHtml(err.message)}
        </div>
      `;
    }
  } finally {
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

let activeTypewriterTimer = null;

function appendMessageBubble(text, role, sources = [], animate = false) {
  if (activeTypewriterTimer) {
    clearInterval(activeTypewriterTimer);
    activeTypewriterTimer = null;
  }

  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (role === "user") {
    bubble.textContent = text;
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return;
  }

  // Assistant bubble with separate markdown container and citations mount
  const markdownContainer = document.createElement("div");
  markdownContainer.className = "markdown-body";
  bubble.appendChild(markdownContainer);

  const citationsContainer = document.createElement("div");
  citationsContainer.className = "citations-mount";
  bubble.appendChild(citationsContainer);

  row.appendChild(bubble);
  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const renderCitations = () => {
    if (sources && sources.length > 0) {
      const uniqueSources = [];
      const seenFilenames = new Set();

      sources.forEach(src => {
        const fname = src.filename || "";
        if (fname && !seenFilenames.has(fname)) {
          seenFilenames.add(fname);
          uniqueSources.push(src);
        }
      });

      if (uniqueSources.length > 0) {
        let html = `
          <div class="citations-wrapper">
            <div class="citations-title">
              <i class="bi bi-file-earmark-check-fill text-primary"></i>
              <span>Grounded in your documents</span>
            </div>
            <div class="citations-cards">
        `;

        uniqueSources.forEach(src => {
          let docId = src.document_id;
          if (!docId && documents && documents.length > 0) {
            const matched = documents.find(d => d.filename === src.filename);
            if (matched) docId = matched.id;
          }

          const viewLink = docId && token
            ? `<a href="/documents/${docId}/view?token=${encodeURIComponent(token)}" target="_blank" class="btn-icon-action btn-view py-1 px-2.5" style="font-size: 0.76rem;">
                <i class="bi bi-eye"></i> View PDF
               </a>`
            : "";

          html += `
            <div class="citation-item-card d-flex align-items-center justify-content-between py-2 px-3">
              <span class="citation-filename d-flex align-items-center gap-2">
                <i class="bi bi-file-earmark-pdf-fill text-danger fs-6"></i>
                <span class="fw-medium">${escapeHtml(src.filename)}</span>
              </span>
              ${viewLink}
            </div>
          `;
        });

        html += `</div></div>`;
        citationsContainer.innerHTML = html;
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  };

  const parseMarkdown = (raw) => {
    if (window.marked && typeof marked.parse === "function") {
      return marked.parse(raw);
    }
    return escapeHtml(raw).replace(/\n/g, "<br>");
  };

  if (!animate) {
    markdownContainer.innerHTML = parseMarkdown(text);
    renderCitations();
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return;
  }

  // Typewriter streaming effect (word by word)
  const tokens = text.match(/\S+|\s+/g) || [text];
  let tokenIdx = 0;
  // Adaptive step: completes in ~1.8 to 3.0 seconds
  const step = Math.max(1, Math.ceil(tokens.length / 90));

  activeTypewriterTimer = setInterval(() => {
    tokenIdx += step;
    if (tokenIdx >= tokens.length) {
      clearInterval(activeTypewriterTimer);
      activeTypewriterTimer = null;
      markdownContainer.innerHTML = parseMarkdown(text);
      renderCitations();
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return;
    }

    const currentSlice = tokens.slice(0, tokenIdx).join("");
    markdownContainer.innerHTML = parseMarkdown(currentSlice) + '<span class="typing-cursor">▋</span>';
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 22);
}

// ---------------------------------------------------------------------------
// Welcome Hero Screen & Prompt Suggestions
// ---------------------------------------------------------------------------
function renderWelcomeScreen() {
  chatMessages.innerHTML = `
    <div class="welcome-container">
      <div class="welcome-icon-glow">
        <i class="bi bi-chat-square-quote-fill fs-2 text-white"></i>
      </div>
      <h3 class="welcome-title">Ask your Knowledge Base</h3>
      <p class="welcome-desc">
        Upload your PDF documents on the left panel, and ask any question below. IntelliBase synthesizes thorough, articulate answers directly grounded in your files.
      </p>

      <div class="prompt-suggestions">
        <div class="suggestion-card" onclick="useSuggestedPrompt('Summarize the primary conclusions and key takeaways of my uploaded documents')">
          <div class="suggestion-card-title">
            <i class="bi bi-file-text text-primary me-1"></i> Summarize key takeaways
          </div>
          <div class="suggestion-card-desc">Extract high-level overview and conclusions</div>
        </div>

        <div class="suggestion-card" onclick="useSuggestedPrompt('What are the key methodologies, findings, or data presented in the text?')">
          <div class="suggestion-card-title">
            <i class="bi bi-search text-info me-1"></i> Explain core findings
          </div>
          <div class="suggestion-card-desc">Deep-dive into methodology and critical data</div>
        </div>

        <div class="suggestion-card" onclick="useSuggestedPrompt('List the main action items, recommendations, and important steps.')">
          <div class="suggestion-card-title">
            <i class="bi bi-check2-circle text-success me-1"></i> Action items & steps
          </div>
          <div class="suggestion-card-desc">Identify actionable recommendations</div>
        </div>

        <div class="suggestion-card" onclick="useSuggestedPrompt('Explain the main concept in simple terms with examples.')">
          <div class="suggestion-card-title">
            <i class="bi bi-lightbulb text-warning me-1"></i> Simple explanation
          </div>
          <div class="suggestion-card-desc">Break down complex technical terms simply</div>
        </div>
      </div>
    </div>
  `;
}

function useSuggestedPrompt(text) {
  chatInput.value = text;
  sendChatMessage();
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toastContainer");
  const toastEl = document.createElement("div");
  toastEl.className = `toast align-items-center text-bg-${type} border-0 show shadow-lg mb-2`;
  toastEl.setAttribute("role", "alert");
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body small fw-medium">${escapeHtml(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  toastContainer.appendChild(toastEl);
  setTimeout(() => toastEl.remove(), 4000);
}
