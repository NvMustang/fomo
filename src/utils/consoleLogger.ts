/**
 * Console Logger - Capture des logs du navigateur
 * 
 * Intercepte les appels à console.log, console.error, etc. et les envoie
 * au serveur Vite pour être écrits dans logs/frontend.log
 */

import { format } from 'date-fns'

interface LogData {
    level: string;
    message: string;
    timestamp: string;
    url: string;
    userAgent: string;
}

class ConsoleLogger {
    private static instance: ConsoleLogger;
    private originalConsole: typeof console;
    private isInitialized = false;

    constructor() {
        this.originalConsole = { ...console };
    }

    static getInstance(): ConsoleLogger {
        if (!ConsoleLogger.instance) {
            ConsoleLogger.instance = new ConsoleLogger();
        }
        return ConsoleLogger.instance;
    }

    init(): void {
        if (this.isInitialized) return;

        // Vider les logs au démarrage (refresh de la page)
        this.clearLogs();

        // Intercepter console.log
        console.log = (...args: unknown[]) => {
            this.originalConsole.log(...args);
            this.sendToServer('log', args);
        };

        // Intercepter console.error
        console.error = (...args: unknown[]) => {
            this.originalConsole.error(...args);
            this.sendToServer('error', args);
        };

        // Intercepter console.warn
        console.warn = (...args: unknown[]) => {
            this.originalConsole.warn(...args);
            this.sendToServer('warn', args);
        };

        // Intercepter console.info
        console.info = (...args: unknown[]) => {
            this.originalConsole.info(...args);
            this.sendToServer('info', args);
        };

        this.isInitialized = true;
        this.originalConsole.log('🔍 Console logger initialized - logs will be captured');
    }

    private async clearLogs(): Promise<void> {
        try {
            const clearEndpoint = `${window.location.origin}/__vite_clear_logs`;
            await fetch(clearEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
        } catch (error) {
            // Ignorer les erreurs pour éviter les boucles infinies
            this.originalConsole.error('Failed to clear logs:', error);
        }
    }

    private async sendToServer(level: string, args: unknown[]): Promise<void> {
        try {
            const message = args.map((arg, index) => {
                if (typeof arg === 'object' && arg !== null) {
                    // Gérer les objets Error vides
                    if (arg.constructor?.name === 'Error' && Object.keys(arg).length === 0) {
                        return `[Error ${index}: empty error object]`;
                    }

                    try {
                        const serialized = JSON.stringify(arg);
                        // Détecter les objets vides ou mal sérialisés
                        if (serialized === '{}' || serialized === '[]' || serialized === 'null') {
                            return `[Object ${index}: ${serialized}] (type: ${arg.constructor?.name || 'unknown'})`;
                        }
                        return serialized;
                    } catch (error) {
                        // Gérer les erreurs de sérialisation circulaire
                        if (error instanceof TypeError && error.message.includes('circular structure')) {
                            // Pour les objets avec références circulaires, essayer d'extraire les propriétés essentielles
                            if (arg instanceof Error) {
                                return `[Error ${index}: ${arg.message || 'no message'}] (circular reference)`;
                            }
                            return `[Object ${index}: circular reference] (type: ${arg.constructor?.name || 'unknown'})`;
                        }
                        return `[Object ${index}: serialization failed] (type: ${arg.constructor?.name || 'unknown'})`;
                    }
                }
                return String(arg);
            }).join(' ');

            const logData: LogData = {
                level,
                message,
                timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
                url: window.location.href,
                userAgent: navigator.userAgent
            };

            // Utiliser l'URL complète pour permettre l'accès depuis le téléphone
            const logEndpoint = `${window.location.origin}/__vite_console_log`;

            await fetch(logEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(logData)
            });
        } catch (error) {
            // Éviter les boucles infinies - utiliser console original
            this.originalConsole.error('Failed to send log to server:', error);
        }
    }
}

export default ConsoleLogger.getInstance();
