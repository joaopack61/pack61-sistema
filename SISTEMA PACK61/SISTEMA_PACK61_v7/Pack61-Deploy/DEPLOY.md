# DEPLOY.md — Como publicar o Pack61 na internet (Railway)

Guia passo a passo para quem **não é desenvolvedor**.  
Tempo estimado: 30 a 45 minutos.  
Custo: US$ 5/mês (plano Hobby do Railway).

---

## O que você vai precisar

- Computador com acesso à internet
- Conta de e-mail para criar as contas abaixo (pode ser Gmail)

---

## PASSO 1 — Criar conta no GitHub

O GitHub é o lugar onde o código do sistema vai ficar armazenado.

1. Acesse **https://github.com**
2. Clique em **Sign up** (Criar conta)
3. Preencha e-mail, usuário e senha
4. Confirme o e-mail
5. Faça login

---

## PASSO 2 — Enviar o projeto para o GitHub

1. Na tela inicial do GitHub, clique em **New repository** (Novo repositório)
2. Nome sugerido: `pack61-sistema`
3. Deixe como **Private** (privado)
4. Clique em **Create repository**
5. Siga as instruções da tela para enviar os arquivos

> Se você não souber usar o GitHub pela linha de comando, use o
> **GitHub Desktop** (https://desktop.github.com) — é visual e simples:
> 1. Instale o GitHub Desktop
> 2. Faça login com sua conta GitHub
> 3. Clique em **Add > Add Existing Repository**
> 4. Selecione a pasta do projeto Pack61
> 5. Clique em **Publish repository**
> 6. Marque como Private e confirme

---

## PASSO 3 — Criar conta no Railway

O Railway é o servidor que vai rodar o sistema na internet.

1. Acesse **https://railway.app**
2. Clique em **Login** e escolha **Login with GitHub**
3. Autorize o Railway a acessar sua conta GitHub
4. Assine o plano **Hobby** (US$ 5/mês)
   - Você recebe US$ 5 de crédito gratuito — o primeiro mês pode ser grátis

---

## PASSO 4 — Criar o projeto no Railway

1. No painel do Railway, clique em **New Project**
2. Escolha **Deploy from GitHub repo**
3. Selecione o repositório `pack61-sistema`
4. O Railway vai detectar automaticamente o arquivo `railway.json`
5. Aguarde o primeiro build (pode levar 2 a 5 minutos)

---

## PASSO 5 — Adicionar volume para o banco de dados

Sem o volume, os dados são apagados toda vez que o servidor reinicia.

1. Dentro do projeto no Railway, clique no serviço (o bloco que apareceu)
2. Clique na aba **Volumes**
3. Clique em **Add Volume**
4. Em **Mount Path**, digite exatamente: `/data`
5. Clique em **Add**

---

## PASSO 6 — Configurar as variáveis de ambiente

As variáveis são configurações secretas do sistema (como a senha do JWT).

1. Ainda dentro do serviço, clique na aba **Variables**
2. Clique em **New Variable** e adicione cada linha abaixo:

| Nome da variável | Valor                                      |
|------------------|--------------------------------------------|
| `JWT_SECRET`     | Qualquer frase longa (ex: `Pack61@Segredo2024!`) |
| `DB_PATH`        | `/data/pack61.db`                          |
| `UPLOAD_PATH`    | `/data/uploads`                            |
| `NODE_ENV`       | `production`                               |

3. Após adicionar todas, o Railway vai reiniciar o serviço automaticamente

---

## PASSO 7 — Acessar o sistema

1. Clique na aba **Settings** do serviço
2. Role até **Domains** e clique em **Generate Domain**
3. O Railway vai gerar uma URL como: `https://pack61-sistema.up.railway.app`
4. Acesse essa URL no navegador — o sistema já deve estar funcionando!

---

## Usuários de teste (para primeiro acesso)

| Perfil       | E-mail                    | Senha  |
|--------------|---------------------------|--------|
| Administrador | admin@pack61.com.br      | 123456 |
| Vendedor      | carlos@pack61.com.br     | 123456 |
| Motorista     | joao@pack61.com.br       | 123456 |
| Produção      | producao@pack61.com.br   | 123456 |

> **Importante:** Após o primeiro acesso, troque as senhas pelo painel de Administrador.

---

## Como atualizar o sistema no futuro

Sempre que você quiser atualizar o sistema:

1. Faça as mudanças nos arquivos
2. Envie para o GitHub (pelo GitHub Desktop ou linha de comando)
3. O Railway detecta automaticamente e faz o novo deploy

---

## Problemas comuns

**O sistema não abre / mostra erro 502:**
- Aguarde 2 a 3 minutos — o servidor pode estar iniciando
- Verifique se o volume `/data` foi configurado
- Verifique se as variáveis de ambiente foram adicionadas

**Perdi os dados:**
- Verifique se o volume está configurado com mount path `/data`
- Sem o volume, os dados são perdidos a cada restart

**Esqueci a senha do admin:**
- Acesse o Railway > serviço > aba **Shell**
- O banco fica em `/data/pack61.db`

---

## Suporte

Sistema desenvolvido especialmente para a Pack61.  
Para dúvidas técnicas, entre em contato com o desenvolvedor.
