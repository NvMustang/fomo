/**
 * Fake Events prédéfinis avec coordonnées réelles
 * Répartis dans deux régions :
 * - Région 1 : Bastogne, Libramont, Vielsalm (20-30 events)
 * - Région 2 : Nivelles, Waterloo, Charleroi, Bruxelles (30-40 events)
 */

import type { Event } from '@/types/fomoTypes'

// Coordonnées des villes principales utilisées pour les fake events
const COORDINATES = {
    // Région 1 - Ardennes
    bastogne: { lat: 50.0030, lng: 5.7190 },
    libramont: { lat: 49.9200, lng: 5.3800 },
    vielsalm: { lat: 50.2833, lng: 5.9167 },
    
    // Région 2 - Brabant/Hainaut
    nivelles: { lat: 50.6000, lng: 4.3167 },
    waterloo: { lat: 50.7167, lng: 4.4000 },
    charleroi: { lat: 50.4108, lng: 4.4446 },
    bruxelles: { lat: 50.8503, lng: 4.3517 }
}

// Fonction pour générer un point autour d'une ville avec un rayon variable
// Génère des coordonnées réparties entre minRadiusKm et maxRadiusKm
function generatePointAroundCity(
    centerLat: number,
    centerLng: number,
    minRadiusKm: number,
    maxRadiusKm: number
): { lat: number; lng: number } {
    const degreesPerKm = 1 / 111 // 1 degré de latitude ≈ 111 km
    const angle = Math.random() * 2 * Math.PI
    const distanceKm = minRadiusKm + Math.random() * (maxRadiusKm - minRadiusKm)
    
    const latOffset = distanceKm * degreesPerKm * Math.cos(angle)
    const lngOffset = distanceKm * degreesPerKm * Math.sin(angle) / Math.cos(centerLat * Math.PI / 180)
    
    return {
        lat: centerLat + latOffset,
        lng: centerLng + lngOffset
    }
}

// Fonction helper pour créer un venue avec coordonnées cohérentes selon le type de lieu
function createVenue(
    cityCoords: { lat: number; lng: number },
    venueName: string,
    address: string,
    minRadiusKm?: number,
    maxRadiusKm?: number
) {
    // Si les rayons ne sont pas spécifiés, les déterminer selon le type de lieu
    if (minRadiusKm === undefined || maxRadiusKm === undefined) {
        const nameLower = venueName.toLowerCase()
        
        // Lieux en centre-ville (très proche du centre : 0-2 km)
        if (nameLower.includes('salle') || nameLower.includes('bar') || nameLower.includes('restaurant') || 
            nameLower.includes('école') || nameLower.includes('centre') || nameLower.includes('théâtre') ||
            nameLower.includes('musée') || nameLower.includes('galerie') || nameLower.includes('bibliothèque') ||
            nameLower.includes('cave') || nameLower.includes('club') || nameLower.includes('pub') ||
            nameLower.includes('pâtisserie') || nameLower.includes('brasserie') || nameLower.includes('jazz club') ||
            nameLower.includes('coworking') || nameLower.includes('studio') || nameLower.includes('atelier') ||
            nameLower.includes('chapelle') || nameLower.includes('église') || nameLower.includes('ludothèque') ||
            nameLower.includes('espace') || nameLower.includes('formation')) {
            minRadiusKm = 0
            maxRadiusKm = 2
        }
        // Lieux naturels (éloignés : 10-30 km)
        else if (nameLower.includes('forêt') || nameLower.includes('réserve') || nameLower.includes('sentier') ||
                 nameLower.includes('nature') || nameLower.includes('randonnée') || nameLower.includes('vtt')) {
            minRadiusKm = 10
            maxRadiusKm = 30
        }
        // Lieux sportifs (moyennement éloignés : 2-8 km)
        else if (nameLower.includes('stade') || nameLower.includes('terrain') || nameLower.includes('complexe sportif') ||
                 (nameLower.includes('parc') && !nameLower.includes('expositions')) || nameLower.includes('course') || nameLower.includes('basket') ||
                 nameLower.includes('volley') || nameLower.includes('football')) {
            minRadiusKm = 2
            maxRadiusKm = 8
        }
        // Festivals/Événements en plein air (moyennement éloignés : 3-10 km)
        else if (nameLower.includes('festival') || nameLower.includes('parc des expositions') ||
                 nameLower.includes('place') || nameLower.includes('place du marché')) {
            minRadiusKm = 3
            maxRadiusKm = 10
        }
        // Par défaut : lieux urbains moyens (1-5 km)
        else {
            minRadiusKm = 1
            maxRadiusKm = 5
        }
    }
    
    const point = generatePointAroundCity(cityCoords.lat, cityCoords.lng, minRadiusKm, maxRadiusKm)
    return {
        ...point,
        name: venueName,
        address: address
    }
}

// Fonction pour générer une date/heure future
function getFutureDateTime(daysOffset: number, hour: number, minute: number = 0): { startsAt: string; endsAt: string } {
    const now = new Date()
    const eventDate = new Date(now)
    eventDate.setDate(now.getDate() + daysOffset)
    eventDate.setHours(hour, minute, 0, 0)
    
    const endDate = new Date(eventDate)
    endDate.setHours(eventDate.getHours() + 3) // Durée par défaut de 3h
    
    return {
        startsAt: eventDate.toISOString(),
        endsAt: endDate.toISOString()
    }
}

/**
 * Fake Events prédéfinis avec coordonnées réelles
 * Les coverUrl sont des URLs Pexels contextuelles générées via le script generateFakeEventsImages.js
 */

export const PREDEFINED_FAKE_EVENTS: Event[] = [
    // ===== RÉGION 1 : BASTOGNE, LIBRAMONT, VIELSALM (25 events) =====
    
    // Bastogne (8 events)
    {
        id: 'fake-bastogne-1',
        title: 'Concert Jazz Intime',
        venue: createVenue(COORDINATES.bastogne, 'Salle des Fêtes, Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(5, 20, 0),
        tags: ['musique', 'jazz'],
        description: 'Plongez dans l\'ambiance feutrée d\'un concert jazz intimiste au cœur des Ardennes. Un trio de musiciens locaux vous emmènera dans un voyage musical à travers les standards du jazz, du swing au bebop. L\'acoustique exceptionnelle de la salle mettra en valeur chaque note, créant une expérience immersive et chaleureuse. Bar sur place avec sélection de vins et bières artisanales.',
        organizerId: 'fake-organizer-1',
        organizerName: 'Association Culturelle Ardennaise',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/811838/pexels-photo-811838.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-2',
        title: 'Atelier Cuisine Italienne',
        venue: createVenue(COORDINATES.bastogne, 'École de Cuisine, Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(7, 14, 0),
        tags: ['cuisine', 'atelier'],
        description: 'Découvrez les secrets de la cuisine italienne authentique avec Chef Marco, originaire de Toscane. Au programme : préparation de pâtes fraîches maison, réalisation d\'une sauce tomate traditionnelle, et confection d\'un tiramisu à l\'ancienne. Tous les ingrédients sont fournis, et vous repartirez avec vos créations culinaires. Ambiance conviviale garantie !',
        organizerId: 'fake-organizer-2',
        organizerName: 'Chef Marco',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34642148/pexels-photo-34642148.png?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-3',
        title: 'Randonnée VTT Ardennes',
        venue: createVenue(COORDINATES.bastogne, 'Départ Forêt de Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(10, 9, 0),
        tags: ['sport', 'nature'],
        description: 'Partez à l\'aventure sur les sentiers VTT de la forêt de Bastogne ! Un parcours de 25 km adapté à tous les niveaux, avec des passages techniques pour les plus expérimentés et des alternatives plus faciles pour les débutants. Découvrez les paysages magnifiques des Ardennes, ses vallées encaissées et ses points de vue panoramiques. Pause pique-nique prévue à mi-parcours. VTT et casque obligatoires.',
        organizerId: 'fake-organizer-3',
        organizerName: 'VTT Club Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/30678493/pexels-photo-30678493.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-4',
        title: 'Soirée Jeux de Société',
        venue: createVenue(COORDINATES.bastogne, 'Bar Le Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(12, 19, 30),
        tags: ['jeux', 'social'],
        description: 'Rejoignez-nous pour une soirée conviviale autour des jeux de société ! Plus de 50 jeux à votre disposition, des classiques aux nouveautés. Que vous soyez amateur de stratégie, de coopération ou de jeux rapides, il y en a pour tous les goûts. Ambiance décontractée, boissons et snacks disponibles au bar. Parfait pour rencontrer de nouvelles personnes ou passer un bon moment entre amis.',
        organizerId: 'fake-organizer-4',
        organizerName: 'Ludothèque de Bastogne',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/4083297/pexels-photo-4083297.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-5',
        title: 'Atelier Poterie',
        venue: createVenue(COORDINATES.bastogne, 'Atelier Céramique, Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(14, 15, 0),
        tags: ['art', 'atelier'],
        description: 'Initiez-vous à l\'art ancestral de la poterie dans un atelier chaleureux et authentique. Apprenez les techniques de base : modelage, tournage et décoration. Vous créerez votre propre pièce unique (bol, vase ou assiette) que vous pourrez emporter après cuisson. Matériel et argile fournis. Aucune expérience requise, juste l\'envie de créer ! L\'atelier se termine par un moment de partage autour d\'un thé ou café.',
        organizerId: 'fake-organizer-5',
        organizerName: 'Atelier Terre & Feu',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/9853292/pexels-photo-9853292.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-6',
        title: 'Dégustation Bières Artisanales',
        venue: createVenue(COORDINATES.bastogne, 'Brasserie Ardennaise', 'Bastogne, Belgique'),
        ...getFutureDateTime(16, 18, 0),
        tags: ['dégustation', 'bière'],
        description: 'Découvrez les saveurs uniques des bières artisanales des Ardennes ! Dégustation guidée de 6 bières locales, chacune avec son histoire et ses caractéristiques. Du blond fruité à la brune torréfiée, en passant par les spécialités saisonnières. Accompagnement de fromages locaux et de charcuterie ardennaise. Le brasseur partagera ses secrets de fabrication et répondra à toutes vos questions. Ambiance conviviale garantie !',
        organizerId: 'fake-organizer-6',
        organizerName: 'Brasserie des Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/2440527/pexels-photo-2440527.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-7',
        title: 'Concert Folk Acoustique',
        venue: createVenue(COORDINATES.bastogne, 'Église Saint-Pierre, Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(18, 20, 0),
        tags: ['musique', 'folk'],
        description: 'Vivez une expérience musicale unique dans l\'église Saint-Pierre de Bastogne, un lieu chargé d\'histoire. Un concert folk acoustique intime avec des artistes locaux qui interpréteront des morceaux traditionnels et contemporains. L\'acoustique exceptionnelle de l\'édifice mettra en valeur chaque instrument (guitare, violon, accordéon). Un moment magique où musique et patrimoine se rencontrent. Entrée libre, participation libre au chapeau.',
        organizerId: 'fake-organizer-7',
        organizerName: 'Festival Ardennes Folk',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/5909612/pexels-photo-5909612.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-8',
        title: 'Workshop Photographie Nature',
        venue: createVenue(COORDINATES.bastogne, 'Réserve Naturelle, Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(20, 10, 0),
        tags: ['photographie', 'nature'],
        description: 'Partez en immersion dans la réserve naturelle pour apprendre la photographie de nature ! Un photographe professionnel vous enseignera les techniques essentielles : composition, gestion de la lumière naturelle, réglages d\'appareil pour la macro et la faune. Matinée en extérieur avec observation d\'oiseaux, insectes et paysages. Après-midi dédiée au traitement des images et aux conseils de retouche. Apportez votre appareil photo (reflex, hybride ou smartphone).',
        organizerId: 'fake-organizer-8',
        organizerName: 'Photo Nature Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/2608517/pexels-photo-2608517.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    
    // Libramont (8 events)
    {
        id: 'fake-libramont-1',
        title: 'Soirée Networking Tech',
        venue: createVenue(COORDINATES.libramont, 'Espace Coworking, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(6, 18, 30),
        tags: ['networking', 'tech'],
        description: 'Rejoignez la communauté tech des Ardennes pour un moment d\'échange et de networking ! Développeurs, designers, entrepreneurs et passionnés de technologie se retrouvent pour partager leurs expériences, projets et opportunités. Au programme : présentations éclair (lightning talks), discussions libres autour d\'un verre, et échanges sur les dernières tendances tech. Un excellent moyen d\'élargir votre réseau professionnel dans une ambiance décontractée. Apéro offert !',
        organizerId: 'fake-organizer-9',
        organizerName: 'Tech Hub Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/3183197/pexels-photo-3183197.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-2',
        title: 'Exposition Art Contemporain',
        venue: createVenue(COORDINATES.libramont, 'Galerie d\'Art, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(8, 10, 0),
        tags: ['art', 'exposition'],
        description: 'Découvrez une exposition d\'art contemporain mettant à l\'honneur des artistes locaux et internationaux. Peintures, sculptures, installations et œuvres numériques se côtoient dans un espace moderne et lumineux. Rencontrez les artistes lors du vernissage, découvrez leurs processus créatifs et leurs inspirations. Un parcours artistique qui questionne notre rapport au monde moderne. Visite guidée disponible sur demande. Entrée gratuite.',
        organizerId: 'fake-organizer-10',
        organizerName: 'Galerie Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/162589/antique-art-painting-paper-162589.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-3',
        title: 'Workshop Développement Web',
        venue: createVenue(COORDINATES.libramont, 'Centre de Formation, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(11, 10, 0),
        tags: ['tech', 'formation'],
        description: 'Découvrez les bases du développement web moderne dans un workshop pratique et accessible ! Apprenez HTML, CSS et JavaScript à travers des exercices concrets. Vous créerez votre première page web responsive et découvrirez les outils essentiels (éditeurs, navigateurs, Git). Aucun prérequis nécessaire, juste de la curiosité. Matériel fourni (ordinateurs disponibles) ou apportez votre laptop. Un excellent point de départ pour débuter dans le développement web !',
        organizerId: 'fake-organizer-11',
        organizerName: 'Code Academy Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34640514/pexels-photo-34640514.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-4',
        title: 'Festival de Musique Électro',
        venue: createVenue(COORDINATES.libramont, 'Parc des Expositions, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(13, 22, 0),
        tags: ['musique', 'festival'],
        description: 'Vivez une expérience électro inoubliable sous les étoiles ! Un festival de musique électronique en plein air avec 3 scènes, des DJs locaux et internationaux, et une programmation éclectique allant de la house à la techno. Système son de qualité professionnelle, éclairages LED spectaculaires et food trucks pour se restaurer. Ambiance festive garantie jusqu\'au bout de la nuit. Bar et espace détente disponibles. Prévente avantageuse !',
        organizerId: 'fake-organizer-12',
        organizerName: 'Electro Ardennes Festival',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34406255/pexels-photo-34406255.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-5',
        title: 'Atelier Pâtisserie',
        venue: createVenue(COORDINATES.libramont, 'Pâtisserie Le Gourmet, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(15, 16, 0),
        tags: ['cuisine', 'pâtisserie'],
        description: 'Plongez dans l\'univers de la pâtisserie fine avec un chef pâtissier expérimenté ! Apprenez les techniques essentielles : pâte à choux, crème pâtissière, glaçage et décoration. Vous réaliserez deux créations : un éclair au chocolat et un macaron à la framboise. Tous les ingrédients et matériels sont fournis. Petite dégustation en fin d\'atelier avec thé ou café. Vous repartirez avec vos pâtisseries et les recettes détaillées. Aucune expérience requise !',
        organizerId: 'fake-organizer-13',
        organizerName: 'Chef Pâtissier Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34618723/pexels-photo-34618723.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-6',
        title: 'Soirée Stand-up Comedy',
        venue: createVenue(COORDINATES.libramont, 'Théâtre Municipal, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(17, 20, 30),
        tags: ['comedy', 'spectacle'],
        description: 'Riez aux éclats lors d\'une soirée stand-up comedy avec les meilleurs comédiens de la région ! Un line-up de 4 humoristes qui aborderont des thèmes variés avec leur style unique. De l\'humour absurde aux observations de la vie quotidienne, en passant par l\'autodérision. Ambiance chaleureuse et interactive, le public est invité à participer. Bar ouvert avant et après le spectacle. Un moment de détente garanti pour oublier le quotidien !',
        organizerId: 'fake-organizer-14',
        organizerName: 'Comedy Club Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34601153/pexels-photo-34601153.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-7',
        title: 'Workshop Menuiserie',
        venue: createVenue(COORDINATES.libramont, 'Atelier Bois, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(19, 15, 0),
        tags: ['artisanat', 'menuiserie'],
        description: 'Découvrez l\'art du travail du bois dans un atelier traditionnel ! Initiation à la menuiserie avec un artisan expérimenté. Vous apprendrez à utiliser les outils essentiels (scie, rabot, ponceuse) et créerez votre premier objet en bois : un plateau de service ou un porte-clés personnalisé. Matériaux et outils fournis. Techniques de finition (ponçage, huile) incluses. Un savoir-faire ancestral à portée de main. Vous repartirez avec votre création unique !',
        organizerId: 'fake-organizer-15',
        organizerName: 'Artisanat Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/7399354/pexels-photo-7399354.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-8',
        title: 'Concert Rock Indé',
        venue: createVenue(COORDINATES.libramont, 'Salle Polyvalente, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(21, 21, 0),
        tags: ['musique', 'rock'],
        description: 'Découvrez la scène rock indépendante belge avec 3 groupes émergents ! Une soirée énergique où se mêlent rock alternatif, garage rock et indie. Des performances authentiques et puissantes dans une salle avec une acoustique optimale. Bar ouvert, ambiance décontractée et conviviale. Un excellent moyen de soutenir la scène locale et de découvrir de nouveaux talents. Ouverture des portes à 20h, premier groupe à 21h. Entrée libre, participation au chapeau.',
        organizerId: 'fake-organizer-16',
        organizerName: 'Rock Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/811838/pexels-photo-811838.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    
    // Vielsalm (9 events)
    {
        id: 'fake-vielsalm-1',
        title: 'Atelier Yoga & Méditation',
        venue: createVenue(COORDINATES.vielsalm, 'Centre de Bien-être, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(7, 18, 0),
        tags: ['yoga', 'bien-être'],
        description: 'Reconnectez-vous avec vous-même lors d\'une séance de yoga et méditation en pleine nature ! Une pratique douce et accessible à tous les niveaux, dans un cadre apaisant au cœur des Ardennes. Enchaînements de postures adaptés, suivi d\'une méditation guidée pour se recentrer. Tapis fournis, apportez simplement une tenue confortable. L\'atelier se termine par un moment de partage autour d\'un thé aux herbes. Un moment de bien-être et de sérénité garanti.',
        organizerId: 'fake-organizer-17',
        organizerName: 'Yoga Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34537759/pexels-photo-34537759.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-2',
        title: 'Festival de Street Art',
        venue: createVenue(COORDINATES.vielsalm, 'Centre-Ville, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(9, 14, 0),
        tags: ['art', 'street-art'],
        description: 'Découvrez l\'art urbain sous toutes ses formes lors d\'un festival dynamique et coloré ! Des artistes graffeurs créeront des fresques en direct, des performances de danse urbaine animeront les rues, et des installations éphémères transformeront le centre-ville. Parcours guidé pour rencontrer les artistes, ateliers participatifs pour tous les âges, et scène ouverte pour les talents locaux. Un événement qui transforme l\'espace public en galerie à ciel ouvert. Entrée libre !',
        organizerId: 'fake-organizer-18',
        organizerName: 'Street Art Festival',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34578416/pexels-photo-34578416.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-3',
        title: 'Soirée Vin & Fromage',
        venue: createVenue(COORDINATES.vielsalm, 'Cave à Vin, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(11, 19, 0),
        tags: ['dégustation', 'vin'],
        description: 'Savourez une dégustation raffinée de vins et fromages locaux dans l\'ambiance feutrée d\'une cave à vin authentique ! Découverte de 5 vins sélectionnés (blancs, rouges et rosés) accompagnés de fromages artisanaux de la région. Un sommelier vous guidera dans les accords mets et vins, partagera l\'histoire de chaque produit et répondra à vos questions. Planche de charcuterie locale en complément. Un moment de convivialité et de découverte des saveurs ardennaises !',
        organizerId: 'fake-organizer-19',
        organizerName: 'Cave Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/10787145/pexels-photo-10787145.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-4',
        title: 'Randonnée Pédestre',
        venue: createVenue(COORDINATES.vielsalm, 'Départ Sentier des Crêtes', 'Vielsalm, Belgique'),
        ...getFutureDateTime(13, 8, 0),
        tags: ['randonnée', 'nature'],
        description: 'Partez à la découverte des plus beaux paysages ardennais lors d\'une randonnée guidée de 12 km ! Un parcours accessible à tous, avec des pauses commentées sur la faune, la flore et l\'histoire locale. Découvrez les points de vue panoramiques, les ruisseaux cachés et les vestiges historiques. Guide expérimenté, pique-nique inclus (produits locaux). Chaussures de marche recommandées. Un moment de ressourcement en pleine nature, parfait pour se déconnecter du quotidien !',
        organizerId: 'fake-organizer-20',
        organizerName: 'Randonneurs Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/30678493/pexels-photo-30678493.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-5',
        title: 'Atelier Calligraphie',
        venue: createVenue(COORDINATES.vielsalm, 'Atelier d\'Art, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(15, 11, 0),
        tags: ['art', 'calligraphie'],
        description: 'Initiez-vous à l\'art millénaire de la calligraphie dans un atelier zen et apaisant ! Apprenez les techniques de base avec différents outils (plume, pinceau) et styles d\'écriture. Vous créerez des cartes personnalisées, des citations inspirantes ou votre propre signature artistique. Matériel fourni (papier, encres, outils). Aucune expérience requise, juste de la patience et de la concentration. Un art méditatif qui allie beauté et sérénité. Vous repartirez avec vos créations !',
        organizerId: 'fake-organizer-21',
        organizerName: 'Atelier Calligraphie',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/9853292/pexels-photo-9853292.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-6',
        title: 'Concert Metal Local',
        venue: createVenue(COORDINATES.vielsalm, 'Salle des Fêtes, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(17, 20, 30),
        tags: ['musique', 'metal'],
        description: 'Laissez-vous emporter par l\'énergie brute du metal belge ! Un concert intense avec 4 groupes locaux qui vous feront vibrer : du heavy metal classique au death metal moderne. Une soirée pour les amateurs de riffs puissants, de solos épiques et d\'ambiance survoltée. Système son professionnel, éclairages dynamiques et bar ouvert. Ambiance conviviale entre métalleux, parfaite pour découvrir la scène locale. Ouverture des portes à 19h, premier groupe à 20h. Entrée libre, participation au chapeau.',
        organizerId: 'fake-organizer-22',
        organizerName: 'Metal Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34601473/pexels-photo-34601473.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-7',
        title: 'Workshop Sérigraphie',
        venue: createVenue(COORDINATES.vielsalm, 'Atelier Sérigraphie, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(19, 13, 0),
        tags: ['art', 'sérigraphie'],
        description: 'Découvrez l\'art de la sérigraphie, technique d\'impression artisanale aux possibilités infinies ! Apprenez à créer vos propres écrans, à préparer les encres et à imprimer sur différents supports (tissu, papier, carton). Vous réaliserez votre propre design et repartirez avec plusieurs impressions de votre création. Matériel et fournitures fournis. Technique accessible à tous, résultats garantis ! Un savoir-faire artisanal qui permet de créer des objets uniques et personnalisés.',
        organizerId: 'fake-organizer-23',
        organizerName: 'Atelier Sérigraphie',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34599381/pexels-photo-34599381.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-8',
        title: 'Soirée Quiz Musical',
        venue: createVenue(COORDINATES.vielsalm, 'Bar Le Salm, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(21, 19, 0),
        tags: ['jeux', 'musique'],
        description: 'Testez vos connaissances musicales lors d\'une soirée quiz endiablée ! 5 rounds thématiques (années 80, rock, pop, rap, variété française) avec questions audio, blind tests et défis en équipe. Lots à gagner : bons d\'achat, albums vinyle, goodies musicaux. Ambiance conviviale et compétitive, bar ouvert avec happy hour. Formez votre équipe (2-4 personnes) ou rejoignez une équipe sur place. Un moment fun pour mélomanes et amateurs de musique ! Inscription sur place.',
        organizerId: 'fake-organizer-24',
        organizerName: 'Quiz Night Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/5428830/pexels-photo-5428830.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-9',
        title: 'Festival de Danse',
        venue: createVenue(COORDINATES.vielsalm, 'Place du Marché, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(23, 18, 30),
        tags: ['danse', 'festival'],
        description: 'Vivez la magie de la danse lors d\'un festival éclectique et coloré ! 6 troupes locales présenteront des performances variées : danse contemporaine, hip-hop, danse traditionnelle, salsa et tango. Un spectacle en plein air sur la place du marché, avec des performances de 20 minutes chacune. Ateliers participatifs entre les spectacles pour apprendre quelques pas. Ambiance festive et conviviale, bar et food trucks sur place. Un événement qui célèbre la diversité et la créativité de la danse !',
        organizerId: 'fake-organizer-25',
        organizerName: 'Danse Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/14106735/pexels-photo-14106735.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    
    // ===== RÉGION 2 : NIVELLES, WATERLOO, CHARLEROI, BRUXELLES (35 events) =====
    
    // Nivelles (9 events)
    {
        id: 'fake-nivelles-1',
        title: 'Conférence Innovation',
        venue: createVenue(COORDINATES.nivelles, 'Centre Culturel, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(5, 9, 0),
        tags: ['conférence', 'innovation'],
        description: 'Plongez dans l\'univers de l\'innovation technologique avec des experts et entrepreneurs ! Une conférence matinale sur les dernières tendances : intelligence artificielle, blockchain, IoT, et technologies émergentes. 3 intervenants partageront leurs expériences, leurs visions et les opportunités à saisir. Session de questions-réponses et networking autour d\'un café. Un événement pour entrepreneurs, développeurs et curieux de technologie. Petit-déjeuner offert !',
        organizerId: 'fake-organizer-26',
        organizerName: 'Tech Conference Brabant',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34632583/pexels-photo-34632583.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-2',
        title: 'Workshop Design Graphique',
        venue: createVenue(COORDINATES.nivelles, 'École d\'Art, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(7, 10, 30),
        tags: ['design', 'formation'],
        description: 'Développez vos compétences en design graphique dans un workshop pratique et créatif ! Apprenez les fondamentaux : typographie, composition, théorie des couleurs et utilisation d\'outils modernes (Figma, Adobe). Vous créerez votre propre identité visuelle ou un poster promotionnel. Projets pratiques avec feedback personnalisé. Matériel fourni ou apportez votre laptop. Accessible aux débutants comme aux designers expérimentés souhaitant se perfectionner. Portfolio à enrichir !',
        organizerId: 'fake-organizer-27',
        organizerName: 'Design Academy',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34586365/pexels-photo-34586365.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-3',
        title: 'Match de Football Amateur',
        venue: createVenue(COORDINATES.nivelles, 'Stade Municipal, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(9, 19, 0),
        tags: ['sport', 'football'],
        description: 'Vivez l\'émotion du football amateur local ! Un match amical entre deux équipes de la région, dans une ambiance conviviale et sportive. Supportez votre équipe favorite, profitez de l\'ambiance des tribunes et découvrez les talents locaux. Bar et snacks disponibles. Entrée libre, participation libre pour soutenir les clubs. Un moment de partage et de passion pour les amateurs du ballon rond !',
        organizerId: 'fake-organizer-28',
        organizerName: 'FC Nivelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/1171084/pexels-photo-1171084.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-4',
        title: 'Exposition Photo Urbaine',
        venue: createVenue(COORDINATES.nivelles, 'Galerie Photo, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(11, 19, 0),
        tags: ['photographie', 'exposition'],
        description: 'Explorez la ville à travers l\'objectif de photographes talentueux ! Une exposition immersive présentant des clichés urbains capturant l\'essence de la vie citadine : architecture, street art, scènes de rue et portraits. Des œuvres en noir et blanc et en couleur qui racontent des histoires. Rencontre avec les photographes lors du vernissage, discussions sur leurs techniques et inspirations. Un voyage visuel dans l\'urbanité moderne. Entrée gratuite.',
        organizerId: 'fake-organizer-29',
        organizerName: 'Photo Club Nivelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34639465/pexels-photo-34639465.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-5',
        title: 'Tournoi de Basket 3x3',
        venue: createVenue(COORDINATES.nivelles, 'Terrain de Basket, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(13, 14, 0),
        tags: ['sport', 'basket'],
        description: 'Participez ou assistez à un tournoi de basket 3x3 dynamique et accessible ! Format rapide et intense, parfait pour tous les niveaux. Inscription par équipe de 3-4 joueurs, catégories mixtes. Trophées pour les vainqueurs, lots de consolation. Ambiance conviviale avec musique, bar et food trucks. Spectateurs bienvenus pour encourager les équipes ! Un événement sportif fun qui allie compétition et bonne humeur. Inscription sur place ou en ligne.',
        organizerId: 'fake-organizer-30',
        organizerName: 'Basket Club Nivelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/163452/basketball-dunk-blue-game-163452.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-6',
        title: 'Conférence IA & Machine Learning',
        venue: createVenue(COORDINATES.nivelles, 'Centre de Conférences, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(15, 9, 30),
        tags: ['conférence', 'IA'],
        description: 'Découvrez les enjeux et opportunités de l\'intelligence artificielle et du machine learning ! Une conférence matinale avec des experts qui expliqueront les concepts clés, les applications pratiques et l\'impact sur notre société. Cas d\'usage concrets, démonstrations interactives et session de questions-réponses. Accessible aux débutants comme aux initiés. Petit-déjeuner et networking inclus. Un événement pour comprendre l\'IA au-delà des buzzwords !',
        organizerId: 'fake-organizer-31',
        organizerName: 'AI Conference Brabant',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/9574569/pexels-photo-9574569.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-7',
        title: 'Atelier Sushi & Ramen',
        venue: createVenue(COORDINATES.nivelles, 'Restaurant Japonais, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(17, 12, 0),
        tags: ['cuisine', 'japonais'],
        description: 'Maîtrisez l\'art de la cuisine japonaise avec un chef expérimenté ! Apprenez à préparer des sushis parfaits (maki, nigiri) et un ramen authentique. Techniques de découpe du poisson, préparation du riz vinaigré, confection du bouillon et garnitures. Tous les ingrédients frais fournis. Vous dégusterez vos créations en fin d\'atelier avec thé vert et saké. Recettes détaillées à emporter. Un voyage culinaire au pays du soleil levant !',
        organizerId: 'fake-organizer-32',
        organizerName: 'Chef Sushi Nivelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/248444/pexels-photo-248444.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-8',
        title: 'Soirée DJ Électro',
        venue: createVenue(COORDINATES.nivelles, 'Club Le Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(19, 23, 0),
        tags: ['musique', 'électro'],
        description: 'Plongez dans l\'ambiance électro jusqu\'au bout de la nuit ! Une soirée survoltée avec 3 DJs locaux qui enchaîneront les sets house, techno et deep house. Système son puissant, éclairages LED dynamiques et piste de danse spacieuse. Bar ouvert jusqu\'à 3h du matin avec cocktails et bières pression. Ambiance festive et décontractée, parfaite pour danser et se défouler. Dress code : confortable et stylé. Entrée avant 23h30 : tarif réduit !',
        organizerId: 'fake-organizer-33',
        organizerName: 'Electro Night Nivelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/9086940/pexels-photo-9086940.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-9',
        title: 'Marathon de Lecture',
        venue: createVenue(COORDINATES.nivelles, 'Bibliothèque Municipale, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(21, 10, 0),
        tags: ['lecture', 'culture'],
        description: 'Partagez votre passion pour la lecture lors d\'un marathon littéraire unique ! Une journée dédiée à la lecture à voix haute : romans, poésie, nouvelles et textes personnels. Chaque participant peut lire un extrait de 5-10 minutes. Ambiance chaleureuse et bienveillante, café et thé offerts. Découvrez de nouveaux auteurs, échangez vos coups de cœur et rencontrez d\'autres amoureux des livres. Inscription libre, lecteurs et auditeurs bienvenus !',
        organizerId: 'fake-organizer-34',
        organizerName: 'Bibliothèque Nivelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34622537/pexels-photo-34622537.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    
    // Waterloo (8 events)
    {
        id: 'fake-waterloo-1',
        title: 'Concert Acoustique',
        venue: createVenue(COORDINATES.waterloo, 'Chapelle Royale, Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(6, 17, 0),
        tags: ['musique', 'acoustique'],
        description: 'Vivez une expérience musicale exceptionnelle dans la Chapelle Royale de Waterloo, un joyau architectural chargé d\'histoire ! Un concert acoustique intime avec des artistes locaux qui interpréteront des morceaux variés : folk, chanson française et compositions originales. L\'acoustique exceptionnelle de la chapelle mettra en valeur chaque note et chaque voix. Un moment magique où patrimoine et musique se rencontrent. Entrée libre, participation libre au chapeau pour soutenir les artistes.',
        organizerId: 'fake-organizer-35',
        organizerName: 'Musique Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34406258/pexels-photo-34406258.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-2',
        title: 'Soirée Karaoké',
        venue: createVenue(COORDINATES.waterloo, 'Bar Le Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(8, 20, 0),
        tags: ['karaoké', 'divertissement'],
        description: 'Lâchez-vous lors d\'une soirée karaoké endiablée et conviviale ! Plus de 5000 chansons au choix : variété française, pop internationale, rock, rap et bien plus. Ambiance décontractée et bienveillante, parfaite pour chanter entre amis ou rencontrer de nouvelles personnes. Écran géant, micros professionnels et système son de qualité. Bar ouvert avec happy hour jusqu\'à 21h. Concours du meilleur chanteur avec lots à gagner. Un moment fun garanti, même si vous chantez faux !',
        organizerId: 'fake-organizer-36',
        organizerName: 'Karaoké Night Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/144429/pexels-photo-144429.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-3',
        title: 'Tournoi E-Sport FIFA',
        venue: createVenue(COORDINATES.waterloo, 'Gaming Center, Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(10, 16, 0),
        tags: ['e-sport', 'gaming'],
        description: 'Affrontez les meilleurs joueurs de FIFA lors d\'un tournoi e-sport compétitif ! Format 1v1 sur PlayStation et Xbox, élimination directe. Lots à gagner : consoles, manettes, jeux vidéo et bons d\'achat. Matériel fourni (consoles et écrans), apportez votre manette si vous préférez. Ambiance gaming avec retransmission sur grand écran, commentaires en direct et snacks. Inscription sur place ou en ligne. Ouvert à tous les niveaux, des débutants aux pros !',
        organizerId: 'fake-organizer-37',
        organizerName: 'E-Sport Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/9072317/pexels-photo-9072317.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-4',
        title: 'Soirée Vinyl Records',
        venue: createVenue(COORDINATES.waterloo, 'Vinyl Bar, Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(12, 20, 0),
        tags: ['musique', 'vinyl'],
        description: 'Retournez aux sources du son analogique lors d\'une soirée vinyl records authentique ! Un DJ sélectionnera des vinyles rares et collector : jazz, soul, funk, rock et disco. Découvrez la chaleur du son vinyle sur un système audio haut de gamme. Ambiance feutrée et intimiste, parfaite pour écouter de la musique de qualité. Bar avec sélection de whiskies et cocktails classiques. Partagez vos découvertes musicales et échangez avec d\'autres mélomanes. Un voyage dans le temps sonore !',
        organizerId: 'fake-organizer-38',
        organizerName: 'Vinyl Night Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34587758/pexels-photo-34587758.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-5',
        title: 'Atelier Pâtisserie Vegan',
        venue: createVenue(COORDINATES.waterloo, 'Pâtisserie Vegan, Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(14, 14, 30),
        tags: ['cuisine', 'vegan'],
        description: 'Découvrez la pâtisserie vegan, délicieuse et éthique ! Apprenez à réaliser des desserts sans produits d\'origine animale : gâteau au chocolat, cheesecake et cookies. Techniques de substitution (aquafaba, graines de lin, laits végétaux) et recettes gourmandes. Tous les ingrédients bio fournis. Dégustation en fin d\'atelier avec thé ou café. Recettes détaillées à emporter. Accessible à tous, que vous soyez vegan ou simplement curieux. Vous serez surpris par la qualité des résultats !',
        organizerId: 'fake-organizer-39',
        organizerName: 'Vegan Pastry Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34618723/pexels-photo-34618723.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-6',
        title: 'Course à Pied 5km',
        venue: createVenue(COORDINATES.waterloo, 'Parc de Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(16, 8, 0),
        tags: ['sport', 'course'],
        description: 'Relevez le défi d\'une course à pied de 5km accessible à tous les niveaux ! Parcours dans le magnifique parc de Waterloo, terrain plat et sécurisé. Départ groupé à 8h, chronométrage électronique. Médaille de participation pour tous, trophées pour les 3 premiers de chaque catégorie (hommes, femmes, juniors). Espace ravitaillement, vestiaires et douches disponibles. Ambiance conviviale et motivante, parfaite pour débuter ou améliorer votre temps. Inscription en ligne ou sur place.',
        organizerId: 'fake-organizer-40',
        organizerName: 'Running Club Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/54123/pexels-photo-54123.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-7',
        title: 'Concert Reggae Roots',
        venue: createVenue(COORDINATES.waterloo, 'Salle des Fêtes, Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(18, 21, 0),
        tags: ['musique', 'reggae'],
        description: 'Vibrez au rythme du reggae roots avec 3 groupes locaux talentueux ! Une soirée chaleureuse et positive où se mêlent reggae traditionnel, dub et ska. Messages de paix, d\'amour et de fraternité portés par des musiciens passionnés. Ambiance décontractée et festive, bar ouvert avec bières et cocktails. Piste de danse pour danser sur les rythmes entraînants. Un moment de détente et de partage, parfait pour oublier le stress du quotidien. Entrée libre, participation au chapeau.',
        organizerId: 'fake-organizer-41',
        organizerName: 'Reggae Night Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34406258/pexels-photo-34406258.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-8',
        title: 'Tournoi de Volley-Ball',
        venue: createVenue(COORDINATES.waterloo, 'Complexe Sportif, Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(20, 17, 0),
        tags: ['sport', 'volley'],
        description: 'Participez ou assistez à un tournoi de volley-ball mixte dynamique et convivial ! Format 4v4 mixte, accessible à tous les niveaux. Inscription par équipe ou individuelle (nous formons les équipes). Trophées pour les vainqueurs, lots de consolation. Terrain extérieur avec filet professionnel, arbitres expérimentés. Ambiance sportive et amicale, bar et snacks disponibles. Spectateurs bienvenus pour encourager les équipes ! Un événement qui allie compétition et bonne humeur. Inscription sur place ou en ligne.',
        organizerId: 'fake-organizer-42',
        organizerName: 'Volley Club Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34557904/pexels-photo-34557904.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    
    // Charleroi (9 events)
    {
        id: 'fake-charleroi-1',
        title: 'Soirée Blues & Soul',
        venue: createVenue(COORDINATES.charleroi, 'Jazz Club, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(7, 20, 0),
        tags: ['musique', 'blues'],
        description: 'Plongez dans l\'univers du blues et de la soul avec des musiciens locaux talentueux ! Une soirée authentique où se mêlent blues traditionnel, soul moderne et R&B. Guitares électriques, harmonica, voix puissantes et section rythmique groove. Ambiance chaleureuse et intimiste dans un vrai jazz club. Bar ouvert avec sélection de whiskies et cocktails classiques. Un moment pour les amateurs de musique roots et d\'émotions pures. Entrée libre, participation au chapeau pour soutenir les artistes.',
        organizerId: 'fake-organizer-43',
        organizerName: 'Blues Club Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/6621704/pexels-photo-6621704.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-2',
        title: 'Atelier Poterie & Céramique',
        venue: createVenue(COORDINATES.charleroi, 'Atelier Céramique, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(9, 15, 0),
        tags: ['art', 'poterie'],
        description: 'Découvrez l\'art de la poterie et de la céramique dans un atelier traditionnel ! Initiation complète aux techniques de base : modelage à la main, tournage au tour de potier et décoration. Vous créerez plusieurs pièces (bol, vase, assiette) que vous pourrez personnaliser avec des motifs et glaçures. Matériel, argile et outils fournis. Cuisson incluse, récupération des pièces une semaine après. Aucune expérience requise, juste l\'envie de créer avec vos mains !',
        organizerId: 'fake-organizer-44',
        organizerName: 'Atelier Céramique Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/9853292/pexels-photo-9853292.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-3',
        title: 'Dégustation Vins Naturels',
        venue: createVenue(COORDINATES.charleroi, 'Cave à Vin, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(11, 17, 0),
        tags: ['dégustation', 'vin'],
        description: 'Explorez l\'univers des vins naturels et bio lors d\'une dégustation guidée raffinée ! Découverte de 6 vins sélectionnés : vins sans sulfites, biodynamiques et naturels. Un vigneron partagera les secrets de ces vins authentiques, leurs méthodes de production respectueuses de l\'environnement et leurs saveurs uniques. Accompagnement de fromages artisanaux et charcuterie bio. Un moment de découverte pour les amateurs de vins authentiques et responsables. Réservation recommandée !',
        organizerId: 'fake-organizer-45',
        organizerName: 'Cave Nature Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/27819451/pexels-photo-27819451.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-4',
        title: 'Workshop Électronique DIY',
        venue: createVenue(COORDINATES.charleroi, 'FabLab, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(13, 14, 0),
        tags: ['électronique', 'DIY'],
        description: 'Initiez-vous à l\'électronique DIY dans un FabLab équipé ! Apprenez les bases : soudure, lecture de schémas et utilisation d\'Arduino. Vous créerez votre premier projet : une lampe LED personnalisée ou un détecteur de mouvement. Matériel et composants fournis. Accompagnement personnalisé par des makers expérimentés. Aucun prérequis nécessaire, juste de la curiosité. Un savoir-faire pratique qui ouvre la porte à de nombreux projets créatifs. Vous repartirez avec votre création !',
        organizerId: 'fake-organizer-46',
        organizerName: 'FabLab Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34640514/pexels-photo-34640514.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-5',
        title: 'Soirée Trivia Night',
        venue: createVenue(COORDINATES.charleroi, 'Pub Le Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(15, 19, 30),
        tags: ['jeux', 'trivia'],
        description: 'Testez vos connaissances lors d\'une soirée trivia endiablée ! 6 rounds de questions variées : culture générale, histoire, géographie, sciences, sport et divertissement. Formez votre équipe (2-6 personnes) ou rejoignez une équipe sur place. Lots à gagner : bons d\'achat, goodies et boissons. Ambiance conviviale et compétitive dans un pub authentique. Bar ouvert avec happy hour jusqu\'à 20h. Un moment fun pour tester votre culture générale et passer un bon moment entre amis !',
        organizerId: 'fake-organizer-47',
        organizerName: 'Trivia Night Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/239466/pexels-photo-239466.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-6',
        title: 'Atelier Cuisine Thaïlandaise',
        venue: createVenue(COORDINATES.charleroi, 'Restaurant Thaï, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(17, 18, 0),
        tags: ['cuisine', 'thaï'],
        description: 'Découvrez les saveurs exotiques de la Thaïlande avec un chef originaire de Bangkok ! Apprenez à préparer un pad thaï authentique, un curry vert épicé et des nems croustillants. Techniques de découpe, équilibre des saveurs (sucré, salé, acide, épicé) et utilisation des ingrédients thaïlandais. Tous les ingrédients frais fournis. Dégustation de vos créations en fin d\'atelier avec thé glacé thaï. Recettes détaillées à emporter. Un voyage culinaire épicé et coloré !',
        organizerId: 'fake-organizer-48',
        organizerName: 'Chef Thaï Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34642148/pexels-photo-34642148.png?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-7',
        title: 'Festival de Street Food',
        venue: createVenue(COORDINATES.charleroi, 'Place de la Ville, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(19, 12, 0),
        tags: ['food', 'festival'],
        description: 'Savourez les meilleures spécialités du monde lors d\'un festival de street food gourmand ! 15 food trucks proposant des cuisines variées : burgers artisanaux, tacos mexicains, ramen japonais, crêpes bretonnes, spécialités belges et bien plus. Ambiance festive en plein air sur la place centrale, musique live, bar à bières artisanales et espace détente. Un événement pour les gourmands et les curieux de saveurs. Entrée libre, paiement aux stands. Parfait pour un déjeuner ou dîner en extérieur !',
        organizerId: 'fake-organizer-49',
        organizerName: 'Street Food Festival Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/8523140/pexels-photo-8523140.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-8',
        title: 'Soirée Poker Texas Hold\'em',
        venue: createVenue(COORDINATES.charleroi, 'Poker Club, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(21, 19, 30),
        tags: ['poker', 'jeux'],
        description: 'Tentez votre chance lors d\'un tournoi de poker Texas Hold\'em professionnel ! Format tournoi avec buy-in accessible, structure progressive et lots attractifs. Tables de poker professionnelles, dealers expérimentés et ambiance casino authentique. Bar ouvert, snacks disponibles. Ouvert à tous les niveaux, des débutants aux joueurs expérimentés. Règles expliquées en début de tournoi pour les novices. Un moment de stratégie, de bluff et de suspense ! Inscription sur place ou en ligne.',
        organizerId: 'fake-organizer-50',
        organizerName: 'Poker Club Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/262333/pexels-photo-262333.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-9',
        title: 'Conférence Blockchain & Crypto',
        venue: createVenue(COORDINATES.charleroi, 'Centre de Conférences, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(23, 10, 0),
        tags: ['conférence', 'blockchain'],
        description: 'Comprenez les enjeux de la blockchain et des cryptomonnaies avec des experts du secteur ! Une conférence matinale qui démystifie ces technologies : fonctionnement de la blockchain, applications pratiques, investissement responsable et avenir du Web3. Cas d\'usage concrets, démonstrations interactives et session de questions-réponses. Accessible aux débutants comme aux initiés. Petit-déjeuner et networking inclus. Un événement pour comprendre l\'écosystème crypto au-delà des spéculations !',
        organizerId: 'fake-organizer-51',
        organizerName: 'Blockchain Conference Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/8369779/pexels-photo-8369779.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    
    // Bruxelles (9 events)
    {
        id: 'fake-bruxelles-1',
        title: 'Atelier Mixologie Cocktails',
        venue: createVenue(COORDINATES.bruxelles, 'Bar à Cocktails, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(8, 18, 30),
        tags: ['cocktails', 'mixologie'],
        description: 'Devenez un expert en mixologie avec un barman professionnel ! Apprenez les techniques essentielles : shaker, muddler, balance des saveurs et présentation. Vous créerez 4 cocktails signature : un classique (Old Fashioned), un tropical (Mai Tai), un moderne (Espresso Martini) et votre propre création. Tous les ingrédients et matériels fournis. Dégustation de vos créations en fin d\'atelier avec snacks. Recettes détaillées à emporter. Un savoir-faire qui impressionnera vos invités !',
        organizerId: 'fake-organizer-52',
        organizerName: 'Cocktail Academy Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34627199/pexels-photo-34627199.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-2',
        title: 'Exposition Art Contemporain',
        venue: createVenue(COORDINATES.bruxelles, 'Musée d\'Art Moderne, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(10, 10, 0),
        tags: ['art', 'exposition'],
        description: 'Explorez les tendances de l\'art contemporain international dans un musée prestigieux ! Une exposition majeure présentant des œuvres d\'artistes reconnus : installations immersives, sculptures monumentales, peintures abstraites et art numérique. Parcours thématique avec audio-guide disponible. Visite guidée par un conservateur à 15h. Un voyage dans la création artistique actuelle, questionnant notre époque et notre société. Café du musée avec vue sur les collections. Entrée gratuite le premier dimanche du mois.',
        organizerId: 'fake-organizer-53',
        organizerName: 'Musée d\'Art Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/162589/antique-art-painting-paper-162589.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-3',
        title: 'Soirée Networking Tech',
        venue: createVenue(COORDINATES.bruxelles, 'Coworking Space, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(12, 18, 30),
        tags: ['networking', 'tech'],
        description: 'Élargissez votre réseau professionnel lors d\'une soirée networking tech exclusive ! Rencontrez des développeurs, entrepreneurs, investisseurs et passionnés de technologie dans une ambiance décontractée. Lightning talks de 5 minutes, discussions libres autour d\'un apéro, et échanges sur les dernières innovations. Un excellent moyen de découvrir des opportunités, partager vos projets et rencontrer des collaborateurs potentiels. Apéro offert, ambiance conviviale garantie !',
        organizerId: 'fake-organizer-54',
        organizerName: 'Tech Meetup Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/3183197/pexels-photo-3183197.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-4',
        title: 'Workshop Photographie',
        venue: createVenue(COORDINATES.bruxelles, 'Studio Photo, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(14, 13, 0),
        tags: ['photographie', 'formation'],
        description: 'Capturez l\'essence de la ville lors d\'un workshop de photographie urbaine ! Un photographe professionnel vous enseignera les techniques de composition, de gestion de la lumière urbaine et de storytelling. Sortie photo dans les rues de Bruxelles avec exercices pratiques. Après-midi dédiée au traitement des images (Lightroom) et aux conseils de retouche. Apportez votre appareil photo (reflex, hybride ou smartphone). Un workshop pour développer votre œil photographique et créer des images percutantes !',
        organizerId: 'fake-organizer-55',
        organizerName: 'Photo Academy Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/2608517/pexels-photo-2608517.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-5',
        title: 'Festival de Musique Électro',
        venue: createVenue(COORDINATES.bruxelles, 'Parc de Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(16, 22, 0),
        tags: ['musique', 'festival'],
        description: 'Vivez une expérience électro inoubliable dans le magnifique parc de Bruxelles ! Un festival de musique électronique en plein air avec 4 scènes, des DJs internationaux et une programmation éclectique (house, techno, trance, drum & bass). Système son de qualité professionnelle, éclairages LED spectaculaires et mapping vidéo. Food trucks variés, bar à cocktails et espace détente. Ambiance festive jusqu\'au bout de la nuit. Prévente avantageuse, billetterie sur place !',
        organizerId: 'fake-organizer-56',
        organizerName: 'Electro Festival Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34406255/pexels-photo-34406255.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-6',
        title: 'Atelier Cuisine Italienne',
        venue: createVenue(COORDINATES.bruxelles, 'École de Cuisine, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(18, 14, 0),
        tags: ['cuisine', 'italien'],
        description: 'Maîtrisez l\'art de la cuisine italienne avec un chef originaire de Naples ! Apprenez à préparer des pâtes fraîches maison, une sauce tomate traditionnelle et un tiramisu à l\'ancienne. Techniques de pétrissage, confection de la pâte et secrets des recettes de famille. Tous les ingrédients authentiques fournis. Dégustation de vos créations en fin d\'atelier avec vin italien. Recettes détaillées à emporter. Un voyage culinaire au cœur de l\'Italie, de la Toscane à la Sicile !',
        organizerId: 'fake-organizer-57',
        organizerName: 'Chef Italien Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34642148/pexels-photo-34642148.png?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-7',
        title: 'Concert Jazz Intime',
        venue: createVenue(COORDINATES.bruxelles, 'Jazz Club, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(20, 20, 0),
        tags: ['musique', 'jazz'],
        description: 'Plongez dans l\'ambiance feutrée d\'un concert jazz intimiste dans un club légendaire ! Un quartet de musiciens talentueux vous emmènera dans un voyage musical à travers les standards du jazz : bebop, cool jazz et jazz moderne. L\'acoustique exceptionnelle du club mettra en valeur chaque instrument. Ambiance chaleureuse et authentique, parfaite pour les amateurs de jazz. Bar avec sélection de whiskies et cocktails classiques. Réservation recommandée, places limitées !',
        organizerId: 'fake-organizer-58',
        organizerName: 'Jazz Club Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/811838/pexels-photo-811838.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-8',
        title: 'Soirée Jeux de Société',
        venue: createVenue(COORDINATES.bruxelles, 'Ludothèque, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(22, 19, 30),
        tags: ['jeux', 'social'],
        description: 'Rejoignez-nous pour une soirée jeux de société conviviale et variée ! Plus de 100 jeux à votre disposition : stratégie, coopération, party games et jeux classiques. Que vous soyez amateur de jeux complexes ou de jeux rapides, il y en a pour tous les goûts. Ambiance décontractée, boissons et snacks disponibles. Parfait pour rencontrer de nouvelles personnes ou passer un bon moment entre amis. Animateurs présents pour expliquer les règles. Un moment fun garanti !',
        organizerId: 'fake-organizer-59',
        organizerName: 'Ludothèque Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/4083297/pexels-photo-4083297.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-9',
        title: 'Workshop Développement Web',
        venue: createVenue(COORDINATES.bruxelles, 'Code Academy, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(24, 10, 0),
        tags: ['tech', 'formation'],
        description: 'Développez vos compétences en développement web dans un workshop intensif et pratique ! Apprenez les technologies modernes : React, TypeScript, API REST et déploiement. Vous créerez une application web complète de A à Z. Projets pratiques avec code review et feedback personnalisé. Matériel fourni ou apportez votre laptop. Accessible aux développeurs débutants comme aux expérimentés souhaitant se perfectionner. Portfolio à enrichir et compétences à valoriser !',
        organizerId: 'fake-organizer-60',
        organizerName: 'Code Academy Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        coverUrl: 'https://images.pexels.com/photos/34640514/pexels-photo-34640514.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    }
]

