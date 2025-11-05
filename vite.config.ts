import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    // Plugin pour capturer les logs de la console du navigateur
    {
      name: 'console-logger',
      configureServer(server) {
        // Endpoint pour capturer les logs
        server.middlewares.use('/__vite_console_log', (req, res, next) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              try {
                const logData = JSON.parse(body);

                // Créer le dossier logs s'il n'existe pas
                const logsDir = path.join(__dirname, 'logs');
                if (!fs.existsSync(logsDir)) {
                  fs.mkdirSync(logsDir, { recursive: true });
                }

                // Écrire dans logs/frontend.log
                const logPath = path.join(logsDir, 'frontend.log');
                const logEntry = `[${logData.timestamp}] [${logData.level.toUpperCase()}] ${logData.message} (${logData.url})\n`;

                fs.appendFileSync(logPath, logEntry);

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (error) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: error.message }));
              }
            });
          } else {
            next();
          }
        });

        // Endpoint pour vider les logs (au refresh)
        server.middlewares.use('/__vite_clear_logs', (req, res, next) => {
          if (req.method === 'POST') {
            try {
              const logsDir = path.join(__dirname, 'logs');
              const logPath = path.join(logsDir, 'frontend.log');

              // Vider le fichier de logs (garder seulement les logs du serveur Vite)
              const serverLogs = `> fomo-mvp@1.0.0 dev
> vite

`;
              fs.writeFileSync(logPath, serverLogs);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Logs cleared' }));
            } catch (error) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: error.message }));
            }
          } else {
            next();
          }
        });
      }
    }
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl'],
          'react-map': ['react-map-gl'],
          clustering: ['supercluster'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    hmr: false,
  },
  preview: {
    port: 3000,
    host: true,
  },
})