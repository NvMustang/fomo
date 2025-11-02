/**
 * Routes pour les événements
 * Routes utilisées uniquement (MVP)
 */

const express = require('express')
const router = express.Router()
const EventsController = require('../controllers/eventsController')

// GET /api/events - Récupérer tous les événements
router.get('/', EventsController.getAllEvents)

// GET /api/events/:id - Récupérer un événement par ID
router.get('/:id', EventsController.getEventById)

// POST /api/events - Créer un événement
router.post('/', EventsController.upsertEvent)

module.exports = router