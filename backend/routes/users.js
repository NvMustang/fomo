/**
 * Routes pour les utilisateurs et le système d'amitié
 * Routes utilisées uniquement (MVP)
 */

const express = require('express')
const router = express.Router()
const UsersController = require('../controllers/usersController')

// GET /api/users - Récupérer tous les utilisateurs
router.get('/', UsersController.getAllUsers)

// POST /api/users - Créer ou mettre à jour un utilisateur (UPSERT)
router.post('/', UsersController.upsertUser)

// PUT /api/users - Mettre à jour un utilisateur existant (UPDATE uniquement)
router.put('/', UsersController.updateUser)

// POST /api/users/friendships - Créer une amitié
router.post('/friendships', UsersController.upsertFriendship)

// GET /api/users/email/:email - Récupérer un utilisateur par email
router.get('/email/:email', UsersController.getUserByEmail)

// GET /api/users/match-email/:email - Rechercher un utilisateur par email et retourner uniquement l'ID
router.get('/match-email/:email', UsersController.matchByEmail)

// GET /api/users/search - Rechercher des utilisateurs par nom ou email
router.get('/search', UsersController.searchUsers)

// GET /api/users/:id/friends - Récupérer les amis d'un utilisateur
router.get('/:id/friends', UsersController.getUserFriends)

module.exports = router