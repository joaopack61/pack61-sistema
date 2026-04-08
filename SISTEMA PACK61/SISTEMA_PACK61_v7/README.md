# PACK61 - Sistema de Gestao Industrial

Sistema web completo para gestao comercial, logistica, producao e estoque da Pack61 (industria de filme stretch e fita adesiva industrial).

---

## Requisitos

- **Node.js 18+** — https://nodejs.org
- Windows 10/11 (scripts `.ps1`) ou Linux/Mac (use comandos equivalentes)
- Navegador moderno (Chrome, Edge, Firefox)

---

## Instalacao (primeira vez)

### Windows — Metodo Rapido

```powershell
# Abra o PowerShell como Administrador na pasta do projeto e execute:
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
.\install.ps1
```

### Manual (qualquer SO)

```bash
# Instalar dependencias do backend
cd backend
npm install

# Instalar dependencias do frontend
cd ../frontend
npm install
```

---

## Como Rodar

### Windows

```powershell
.\start.ps1
```

Abre automaticamente duas janelas de terminal (backend + frontend) e o navegador.

### Manual

```bash
# Terminal 1 — Backend (porta 3001)
cd backend
node server.js

# Terminal 2 — Frontend (porta 5173)
cd frontend
npm run dev
```

Acesse: **http://localhost:5173**

---

## Logins para Teste

| Perfil        | E-mail                      | Senha    |
|---------------|-----------------------------|----------|
| Administrador | admin@pack61.com.br         | admin123 |
| Vendedor      | carlos@pack61.com.br        | 123456   |
| Vendedor 2    | marina@pack61.com.br        | 123456   |
| Motorista     | joao@pack61.com.br          | 123456   |
| Producao      | producao@pack61.com.br      | 123456   |

---

## Estrutura do Projeto

```
SISTEMA PACK61/
|-- backend/
|   |-- server.js              # Servidor Express principal
|   |-- database.js            # Schema SQLite + dados de teste
|   |-- middleware/
|   |   |-- auth.js            # JWT + controle de perfis
|   |   |-- audit.js           # Log de auditoria
|   |-- routes/
|   |   |-- auth.js            # Login / me
|   |   |-- clients.js         # Clientes
|   |   |-- visits.js          # Visitas dos vendedores
|   |   |-- orders.js          # Pedidos + reserva de estoque
|   |   |-- production.js      # Modulo de producao
|   |   |-- stock.js           # Estoque + movimentacoes
|   |   |-- deliveries.js      # Entregas dos motoristas
|   |   |-- dashboard.js       # KPIs por perfil
|   |   |-- reports.js         # Relatorios filtrados
|   |   |-- users.js           # Gestao de usuarios
|   |-- uploads/               # Fotos e canhotos (criado automaticamente)
|   |-- pack61.db              # Banco de dados SQLite (criado automaticamente)
|
|-- frontend/
|   |-- src/
|   |   |-- pages/
|   |   |   |-- Login.jsx
|   |   |   |-- admin/         # Dashboard, Pedidos, Clientes, Logistica, Relatorios, Usuarios
|   |   |   |-- vendedor/      # Dashboard, Visitas, Clientes, Nova Visita
|   |   |   |-- motorista/     # Dashboard, Entregas
|   |   |   |-- producao/      # Dashboard, Pedidos, Estoque, Movimentacoes
|   |   |-- components/        # Layout, Header, Sidebar, Modal, etc.
|   |   |-- context/           # AuthContext (JWT)
|   |   |-- api.js             # Axios configurado
|   |   |-- App.jsx            # Rotas protegidas por perfil
|
|-- install.ps1                # Instalacao (Windows)
|-- start.ps1                  # Iniciar sistema (Windows)
|-- README.md
```

---

## Modulos do Sistema

### Administrador
- Dashboard com KPIs financeiros (faturamento, ticket medio, conversao)
- Pipeline de pedidos com barra de progresso
- Gestao de pedidos com troca de status e financeiro
- Modulo de logistica (expedicao, motoristas, veiculos)
- Gestao de clientes com WhatsApp
- Relatorios filtrados com exportacao CSV
- Gestao de usuarios

### Vendedor
- Registro de visitas em 3 passos (cliente, resultado, pedido)
- Cadastro de clientes com WhatsApp
- Motivos de perda estruturados
- Prazo de pagamento e data de entrega no pedido
- Alerta de estoque baixo ao criar pedido
- Dashboard com conversao, recompras previstas, motivos de perda

### Motorista
- Dashboard ultra simples com total de pendentes
- Botao "Navegar para entrega" que abre Google Maps
- Gestao de entregas: saiu / chegou / entregue / ocorrencia
- Upload de canhoto assinado (foto da camera)
- Registro de tubos vazios recolhidos
- Registro de ocorrencias e nao entrega

### Producao / Estoque
- Fila de producao ordenada por urgencia (data de entrega)
- Timer ao vivo mostrando tempo em producao
- Barra de status: Pendente > Em Producao > Produzido > Pronto Expedicao
- Estoque com barra visual de reserva vs disponivel por SKU
- Movimentacoes: entrada, saida, producao, perda, avaria, ajuste
- Inventario manual em lote
- Alertas de estoque critico

---

## Banco de Dados

- **SQLite** via `better-sqlite3` (arquivo unico `pack61.db`)
- Criado automaticamente na primeira execucao
- Inclui seed com dados de teste realistas:
  - 5 usuarios (1 admin, 2 vendedores, 1 motorista, 1 producao)
  - 8 clientes de diferentes segmentos
  - 6 SKUs de produtos
  - 8 pedidos em diferentes status
  - Visitas, entregas, movimentacoes de estoque

---

## Integracao Futura (preparado)

- Tabela `integrations` pronta para webhooks WhatsApp/financeiro
- Tabela `notifications_queue` para filas de notificacao
- Campo `whatsapp` em clientes com botao de contato direto
- Estrutura de auditoria completa (quem fez o que e quando)

---

## Tecnologias

**Backend:** Node.js, Express, better-sqlite3, JWT, bcrypt, Multer  
**Frontend:** React, Vite, Tailwind CSS, Recharts, React Router, Axios  
**Banco:** SQLite (sem necessidade de servidor externo)

---

## Resetar o Banco de Dados

Para apagar todos os dados e recriar com os dados de teste:

```bash
cd backend
del pack61.db   # Windows
# ou: rm pack61.db  # Linux/Mac
node server.js  # Recria automaticamente
```
