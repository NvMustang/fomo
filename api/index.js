/**
 * Adapter Vercel Serverless pour Express App
 * Utilise @vercel/node pour wrapper Express correctement
 */

const app = require('../backend/app')

// Vercel Serverless Function handler
// @vercel/node wrapper automatiquement l'app Express
// Le rewrite dans vercel.json envoie /api/* vers cette fonction
// Le path /api est déjà retiré par Vercel, donc les routes Express
// doivent être montées à la racine (déjà fait dans app.js avec isVercel)
module.exports = app

