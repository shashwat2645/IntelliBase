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

function setupEventListeners() {
  // Mobile sidebar drawer toggle
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }

  // Close mobile sidebar on outside click
  document.addEventListener("click", (e) => {
    if (window.innerWidth < 992 && sidebar.classList.contains("open")) {
      if (!sidebar.contains(e.target) && !sidebarToggleBtn.contains(e.target)) {
        sidebar.classList.remove("open");
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
    updateAuthUI();
    showToast("Signed out successfully.");
    renderWelcomeScreen();
    docList.innerHTML = '<div class="text-subtle text-center py-4 small">Sign in to view uploaded documents.</div>';
    conversationList.innerHTML = '<div class="text-subtle text-center py-4 small">Sign in to see past chats.</div>';
    docCountBadge.textContent = "0";
  });

  // New Chat Button
  newChatBtn.addEventListener("click", () => {
    startNewChat();
    if (window.innerWidth < 992) sidebar.classList.remove("open");
  });

  // Delete Active Chat Button
  deleteActiveChatBtn.addEventListener("click", async () => {
    if (currentConversationId) {
      if (confirm("Delete this conversation and its message history?")) {
        await deleteConversation(currentConversationId);
      }
    }
  });

  // Refresh Docs
  refreshDocsBtn.addEventListener("click", fetchDocuments);

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
    chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + "px";
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
  if (currentUser) {
    authBtn.classList.add("d-none");
    userProfile.classList.remove("d-none");
    userEmailText.textContent = currentUser.email;
  } else {
    authBtn.classList.remove("d-none");
    userProfile.classList.add("d-none");
  }
}

// ---------------------------------------------------------------------------
// Conversation / Chat History
// ---------------------------------------------------------------------------
async function fetchConversations() {
  if (!token) return;
  try {
    const res = await fetch("/chat/conversations", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) return;
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
  currentConversationId = null;
  activeChatTitle.textContent = "New Chat";
  deleteActiveChatBtn.classList.add("d-none");
  renderConversationList();
  renderWelcomeScreen();
  chatInput.focus();
}

async function selectConversation(conversationId) {
  if (!token) return;
  currentConversationId = conversationId;
  renderConversationList();

  if (window.innerWidth < 992) sidebar.classList.remove("open");

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

  try {
    const res = await fetch(`/chat/conversations/${conversationId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to delete conversation");

    showToast("Conversation deleted.");
    if (currentConversationId === conversationId) {
      startNewChat();
    }
    await fetchConversations();
  } catch (err) {
    showToast(err.message, "danger");
  }
}

// ---------------------------------------------------------------------------
// Documents Management & Viewing
// ---------------------------------------------------------------------------
async function fetchDocuments() {
  if (!token) return;
  try {
    const res = await fetch("/documents", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) return;
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
  if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

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
        top_k: 4
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

    // Refresh conversation list to show new conversation / updated title
    await fetchConversations();
    const activeConv = conversations.find(c => c.id === currentConversationId);
    if (activeConv) {
      activeChatTitle.textContent = activeConv.title;
    }

    // Append synthesized assistant answer with clean citations
    appendMessageBubble(data.answer, "assistant", data.sources || []);
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

function appendMessageBubble(text, role, sources = []) {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (role === "user") {
    bubble.textContent = text;
  } else {
    // Render ChatGPT-style rich Markdown
    let parsedContent = "";
    if (window.marked && typeof marked.parse === "function") {
      parsedContent = marked.parse(text);
    } else {
      parsedContent = escapeHtml(text).replace(/\n/g, "<br>");
    }

    let html = `<div class="markdown-body">${parsedContent}</div>`;

    // Render Clean Sources & Citations (PDF filenames & quoted lines only, NO chunk IDs!)
    if (sources && sources.length > 0) {
      html += `
        <div class="citations-wrapper">
          <div class="citations-title">
            <i class="bi bi-file-earmark-check-fill text-primary"></i>
            <span>Grounded in your documents</span>
          </div>
          <div class="citations-cards">
      `;

      sources.forEach((src, idx) => {
        const cleanSnippet = (src.snippet || "").trim();
        // Match document ID for view link if available
        const matchedDoc = documents.find(d => d.filename === src.filename);
        const viewLink = matchedDoc && token
          ? `<a href="/documents/${matchedDoc.id}/view?token=${encodeURIComponent(token)}" target="_blank" class="btn-icon-action btn-view py-0 px-2" style="font-size: 0.72rem;">
              <i class="bi bi-eye"></i> View PDF
             </a>`
          : "";

        html += `
          <div class="citation-item-card">
            <div class="citation-header">
              <span class="citation-filename">
                <i class="bi bi-file-earmark-pdf text-danger"></i>
                <span>${escapeHtml(src.filename)}</span>
              </span>
              ${viewLink}
            </div>
            ${cleanSnippet ? `<div class="citation-quote">"${escapeHtml(cleanSnippet)}"</div>` : ''}
          </div>
        `;
      });

      html += `</div></div>`;
    }

    bubble.innerHTML = html;
  }

  row.appendChild(bubble);
  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;
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
