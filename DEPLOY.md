# Deploy para Servidor VNC - Agenda API

## Passos para Deploy

### 1. No seu computador local
```bash
# Build do projeto
bun run build
```

---

## 📦 PASSO A PASSO - ENVIO PARA O SERVIDOR VNC

### 2. Conectar ao servidor VNC via WinSCP ou FileZilla

**Usando WinSCP:**
1. Abra o WinSCP
2. Conecte ao servidor VNC com suas credenciais
3. Navegue até `/var/www/` no servidor (painel direito)

---

### 3. Criar diretório no servidor

**Via terminal SSH:**
```bash
# Conectar via SSH (PowerShell ou PuTTY)
ssh usuario@ip_do_servidor

# Criar diretório
sudo mkdir -p /var/www/agenda-api
sudo chown $USER:$USER /var/www/agenda-api
```

---

### 4. Enviar arquivos via WinSCP

**Arquivos e pastas para enviar:**
- ✅ Pasta `dist/` (completa)
- ✅ Pasta `prisma/` (completa)
- ✅ Arquivo `package.json`
- ✅ Arquivo `ecosystem.config.js`
- ✅ Arquivo `.env`

**No WinSCP:**
1. Selecione os arquivos acima no painel esquerdo (seu computador)
2. Arraste para `/var/www/agenda-api` no painel direito (servidor)
3. Aguarde o upload completar

---

### 5. Instalar dependências no servidor

**Via SSH no servidor:**
```bash
# Navegar até o diretório
cd /var/www/agenda-api

# Verificar se os arquivos foram enviados
ls -la

# Instalar dependências com Bun
bun install --production

# Gerar Prisma Client
bun prisma generate
```

---

### 6. Iniciar aplicação com PM2

```bash
# Iniciar a aplicação
pm2 start ecosystem.config.js

# Salvar para auto-iniciar no boot
pm2 save

# Configurar PM2 para iniciar no boot do sistema
pm2 startup
# (Copie e execute o comando que o PM2 retornar)
```

---

### 7. Verificar se está rodando

```bash
# Ver status do PM2
pm2 status

# Ver logs em tempo real
pm2 logs agenda-api

# Testar localmente no servidor
curl http://localhost:8080

# Ou testar uma rota específica
curl http://localhost:8080/docs
```

---

### 8. Configurar Nginx (opcional - para domínio/subdomínio)

Se você quiser acessar via domínio ou IP público:

```bash
# Editar configuração do Nginx
sudo nano /etc/nginx/sites-available/agenda-api

# Cole a configuração abaixo:
```

```nginx
server {
    listen 80;
    server_name api.seudominio.com;  # ou use o IP do servidor

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/agenda-api /etc/nginx/sites-enabled/

# Testar configuração do Nginx
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

---

### 9. Verificar funcionamento

- **Acesso local no servidor:** `http://localhost:8080`
- **Acesso via IP:** `http://IP_DO_SERVIDOR:8080`
- **Swagger UI:** `http://localhost:8080/docs` ou `http://IP_DO_SERVIDOR:8080/docs`
- **Se configurou Nginx:** `http://api.seudominio.com`

## Comandos Úteis

```bash
# Parar a aplicação
pm2 stop agenda-api

# Reiniciar a aplicação
pm2 restart agenda-api

# Ver logs em tempo real
pm2 logs agenda-api --lines 100

# Deletar do PM2
pm2 delete agenda-api
```

## Portas
- Outro projeto (agenda frontend): 80
- Este projeto (agenda-api): 8080
