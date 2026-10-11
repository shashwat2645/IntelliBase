# 🧠 IntelliBase — AI Knowledge Assistant

> **IntelliBase** is a private, intelligent knowledge assistant that turns your documents into an interactive, question-answering AI. Upload your PDF files, ask questions in natural language, and receive accurate answers cited directly from your documents.

---

## 🌟 What is IntelliBase?

Imagine having a research assistant who has read all your documents, study guides, reports, and manuals, and can answer any question about them in seconds. 

That is **IntelliBase**. Instead of searching through hundreds of pages manually, you simply ask questions in plain English, and IntelliBase:
1. Searches your uploaded documents for the most relevant sections.
2. Uses advanced AI to synthesize a clear, helpful response.
3. Shows you the exact sources and quotes it used so you can verify the facts.

---

## ✨ Key Features

- **📄 PDF Document Uploads:** Easily upload textbooks, research papers, notes, or business reports.
- **💬 Natural Language Chat:** Ask questions just like you would with ChatGPT or a colleague.
- **🎯 Precise Source Citations:** Every answer cites the document name and extracts the relevant quotes used to formulate the answer.
- **✨ Animated Responses:** Real-time typewriter responses with Markdown support (formatting, bullet points, headers, and code snippets).
- **🏷️ Smart Conversation Titles:** Automatically summarizes your questions into clean, memorable chat titles in your sidebar.
- **🔒 Complete Privacy & Data Isolation:** Each user has an isolated workspace. No other user can see your uploaded files, chat history, or personal data.
- **📱 Seamless Mobile & Tablet Experience:** Fully responsive layout designed for smooth use across phones, tablets, and desktop computers.

---

## 🛠️ Technology Stack

IntelliBase is built with modern, battle-tested technologies designed for speed, security, and accuracy:

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/) (Python) | High-performance, asynchronous REST API |
| **AI Model & Embeddings** | [Google Gemini 2.5](https://ai.google.dev/) | Generates semantic embeddings and answers |
| **Vector Database** | [PostgreSQL](https://www.postgresql.org/) + [pgvector](https://github.com/pgvector/pgvector) | Fast vector search across document text chunks |
| **Database ORM & Migrations**| [SQLAlchemy](https://www.sqlalchemy.org/) & [Alembic](https://alembic.sqlalchemy.org/) | Async database access and schema migrations |
| **User Authentication** | JWT (JSON Web Tokens) & Bcrypt | Secure password hashing and token authentication |
| **Document Processing** | PyPDF & ReportLab | Text extraction and document reconstruction |
| **Frontend UI** | HTML5, CSS3, JavaScript (ES6+), Bootstrap 5 | Glassmorphism dark-themed responsive interface |

---

## 🚀 How to Run the Project

Follow these simple steps to run IntelliBase on your computer:

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Python 3.10+** (Python 3.11 recommended)
- **PostgreSQL** with the `pgvector` extension enabled
- A free **Google Gemini API Key** (obtainable from [Google AI Studio](https://aistudio.google.com/app/apikey))

---

### 2. Setup the Project

1. **Clone the repository and enter the directory:**
   ```bash
   git clone https://github.com/your-username/AIKnowledgeBase.git
   cd AIKnowledgeBase
   ```

2. **Create and activate a Python virtual environment:**
   ```bash
   # On macOS / Linux:
   python3 -m venv venv
   source venv/bin/activate

   # On Windows:
   python -m venv venv
   venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

---

### 3. Configure Environment Variables

Create a `.env` file in the project root by copying the provided example:
```bash
cp .env.example .env
```

Open `.env` and fill in your details:
```env
# Your PostgreSQL connection string with pgvector
DATABASE_URL=postgresql+asyncpg://postgres:your_password@localhost:5432/ai_knowledge_base

# Your Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# A random secret string for login token encryption
SECRET_KEY=create_a_long_random_secret_string_here
```

---

### 4. Initialize Database & Run Migrations

Ensure your PostgreSQL service is running, and the `vector` extension is active:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Run database migrations to generate all necessary tables:
```bash
alembic upgrade head
```

---

### 5. Launch the Application

Start the web server:
```bash
uvicorn app.main:app --reload
```

Open your web browser and navigate to:
```
http://localhost:8000
```

---

## 📖 User Guide: How to Use IntelliBase

### Step 1: Create an Account & Sign In
1. Click the **Sign In** button in the top navigation bar.
2. If it is your first time, click **"Create one"** to switch to the registration form.
3. Enter your email and password, then click **Register**.
4. You will be logged in automatically, and your private workspace will activate.

---

### Step 2: Upload Documents
1. In the left sidebar, click the **Documents** tab.
2. Drag and drop any `.pdf` file into the upload dropzone, or click the dropzone to select a file from your computer.
3. IntelliBase will automatically:
   - Extract the text from your document.
   - Break it into manageable, searchable chunks.
   - Generate AI semantic vectors and save them into your private database.
4. Once completed, your document will appear in your **Knowledge Base** list.
5. You can click the **eye icon** next to any document to view the PDF right inside your browser.

---

### Step 3: Ask Questions & Chat
1. Click the **Chats** tab in the sidebar or click **"New Chat"**.
2. Type your question in the text box at the bottom (e.g., *"What are the main key points in Chapter 2?"* or *"Summarize the security policies"*).
3. Click the **Send** button (or press `Enter`).
4. The AI will search your uploaded documents, retrieve relevant passages, and stream the answer word-by-word.

---

### Step 4: Verify Sources & Citations
- Below each assistant response, you will see a **Sources Used** section.
- Expand or review the source cards to see:
  - The exact document filename.
  - The excerpted quote used to generate the answer.
- This ensures full transparency and prevents misinformation.

---

### Step 5: Manage Chats & Documents
- **Start Fresh:** Click **New Chat** anytime to begin a new inquiry.
- **View Past Chats:** Click any conversation in the sidebar to review past questions and responses.
- **Delete Chats:** Click the trash icon on any conversation (with a confirmation prompt) to permanently remove it.
- **Delete Documents:** Click the red trash icon next to a document in the Documents tab to remove it and its index vectors.

---

## 🔒 Privacy & Data Protection

- **Tenant Isolation:** All documents, chunks, and chats are strictly associated with your user account ID.
- **No Shared Knowledge:** The AI only references documents uploaded by the currently authenticated user.
- **Safety Prompts:** The AI system prompt strictly forbids revealing personal information, emails, system IDs, or machine paths.
- **Protected Secrets:** API keys and passwords are encrypted and never exposed in client scripts or API docs.

---

## 📱 Mobile & Tablet Friendly

IntelliBase features a responsive layout designed to work smoothly on mobile screens:
- **Collapsible Sidebar:** Tap the sidebar icon in the navbar to slide out your chats and documents.
- **Floating Input:** The question box stays pinned and visible above mobile toolbars and keyboards.
- **Auto-fit Typography:** Bubble text, cards, and buttons dynamically adapt to all screen sizes.
