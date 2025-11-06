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
 * Les coverUrl seront remplis dynamiquement via Pexels
 */
export const PREDEFINED_FAKE_EVENTS: Omit<Event, 'coverUrl'>[] = [
    // ===== RÉGION 1 : BASTOGNE, LIBRAMONT, VIELSALM (25 events) =====
    
    // Bastogne (8 events)
    {
        id: 'fake-bastogne-1',
        title: 'Concert Jazz Intime',
        venue: createVenue(COORDINATES.bastogne, 'Salle des Fêtes, Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(5, 20, 0),
        tags: ['musique', 'jazz'],
        description: 'Soirée jazz intimiste dans le cœur des Ardennes',
        organizerId: 'fake-organizer-1',
        organizerName: 'Association Culturelle Ardennaise',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-2',
        title: 'Atelier Cuisine Italienne',
        venue: createVenue(COORDINATES.bastogne, 'École de Cuisine, Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(7, 14, 0),
        tags: ['cuisine', 'atelier'],
        description: 'Apprenez les secrets de la cuisine italienne authentique',
        organizerId: 'fake-organizer-2',
        organizerName: 'Chef Marco',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-3',
        title: 'Randonnée VTT Ardennes',
        venue: createVenue(COORDINATES.bastogne, 'Départ Forêt de Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(10, 9, 0),
        tags: ['sport', 'nature'],
        description: 'Parcours VTT à travers les sentiers ardennais',
        organizerId: 'fake-organizer-3',
        organizerName: 'VTT Club Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-4',
        title: 'Soirée Jeux de Société',
        venue: createVenue(COORDINATES.bastogne, 'Bar Le Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(12, 19, 30),
        tags: ['jeux', 'social'],
        description: 'Soirée conviviale autour de jeux de société',
        organizerId: 'fake-organizer-4',
        organizerName: 'Ludothèque de Bastogne',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-5',
        title: 'Atelier Poterie',
        venue: createVenue(COORDINATES.bastogne, 'Atelier Céramique, Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(14, 15, 0),
        tags: ['art', 'atelier'],
        description: 'Découvrez l\'art de la poterie et créez votre propre pièce',
        organizerId: 'fake-organizer-5',
        organizerName: 'Atelier Terre & Feu',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-6',
        title: 'Dégustation Bières Artisanales',
        venue: createVenue(COORDINATES.bastogne, 'Brasserie Ardennaise', 'Bastogne, Belgique'),
        ...getFutureDateTime(16, 18, 0),
        tags: ['dégustation', 'bière'],
        description: 'Découverte des bières artisanales locales',
        organizerId: 'fake-organizer-6',
        organizerName: 'Brasserie des Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-7',
        title: 'Concert Folk Acoustique',
        venue: createVenue(COORDINATES.bastogne, 'Église Saint-Pierre, Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(18, 20, 0),
        tags: ['musique', 'folk'],
        description: 'Concert acoustique dans un cadre historique',
        organizerId: 'fake-organizer-7',
        organizerName: 'Festival Ardennes Folk',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bastogne-8',
        title: 'Workshop Photographie Nature',
        venue: createVenue(COORDINATES.bastogne, 'Réserve Naturelle, Bastogne', 'Bastogne, Belgique'),
        ...getFutureDateTime(20, 10, 0),
        tags: ['photographie', 'nature'],
        description: 'Apprenez à photographier la faune et la flore ardennaises',
        organizerId: 'fake-organizer-8',
        organizerName: 'Photo Nature Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    
    // Libramont (8 events)
    {
        id: 'fake-libramont-1',
        title: 'Soirée Networking Tech',
        venue: createVenue(COORDINATES.libramont, 'Espace Coworking, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(6, 18, 30),
        tags: ['networking', 'tech'],
        description: 'Rencontrez des professionnels du secteur tech',
        organizerId: 'fake-organizer-9',
        organizerName: 'Tech Hub Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-2',
        title: 'Exposition Art Contemporain',
        venue: createVenue(COORDINATES.libramont, 'Galerie d\'Art, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(8, 10, 0),
        tags: ['art', 'exposition'],
        description: 'Exposition d\'artistes locaux et internationaux',
        organizerId: 'fake-organizer-10',
        organizerName: 'Galerie Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-3',
        title: 'Workshop Développement Web',
        venue: createVenue(COORDINATES.libramont, 'Centre de Formation, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(11, 10, 0),
        tags: ['tech', 'formation'],
        description: 'Initiation au développement web moderne',
        organizerId: 'fake-organizer-11',
        organizerName: 'Code Academy Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-4',
        title: 'Festival de Musique Électro',
        venue: createVenue(COORDINATES.libramont, 'Parc des Expositions, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(13, 22, 0),
        tags: ['musique', 'festival'],
        description: 'Festival de musique électronique en plein air',
        organizerId: 'fake-organizer-12',
        organizerName: 'Electro Ardennes Festival',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-5',
        title: 'Atelier Pâtisserie',
        venue: createVenue(COORDINATES.libramont, 'Pâtisserie Le Gourmet, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(15, 16, 0),
        tags: ['cuisine', 'pâtisserie'],
        description: 'Apprenez à réaliser des pâtisseries raffinées',
        organizerId: 'fake-organizer-13',
        organizerName: 'Chef Pâtissier Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-6',
        title: 'Soirée Stand-up Comedy',
        venue: createVenue(COORDINATES.libramont, 'Théâtre Municipal, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(17, 20, 30),
        tags: ['comedy', 'spectacle'],
        description: 'Soirée humoristique avec des comédiens locaux',
        organizerId: 'fake-organizer-14',
        organizerName: 'Comedy Club Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-7',
        title: 'Workshop Menuiserie',
        venue: createVenue(COORDINATES.libramont, 'Atelier Bois, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(19, 15, 0),
        tags: ['artisanat', 'menuiserie'],
        description: 'Initiation à la menuiserie et travail du bois',
        organizerId: 'fake-organizer-15',
        organizerName: 'Artisanat Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-libramont-8',
        title: 'Concert Rock Indé',
        venue: createVenue(COORDINATES.libramont, 'Salle Polyvalente, Libramont', 'Libramont, Belgique'),
        ...getFutureDateTime(21, 21, 0),
        tags: ['musique', 'rock'],
        description: 'Concert de groupes rock indépendants',
        organizerId: 'fake-organizer-16',
        organizerName: 'Rock Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    
    // Vielsalm (9 events)
    {
        id: 'fake-vielsalm-1',
        title: 'Atelier Yoga & Méditation',
        venue: createVenue(COORDINATES.vielsalm, 'Centre de Bien-être, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(7, 18, 0),
        tags: ['yoga', 'bien-être'],
        description: 'Séance de yoga et méditation en pleine nature',
        organizerId: 'fake-organizer-17',
        organizerName: 'Yoga Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-2',
        title: 'Festival de Street Art',
        venue: createVenue(COORDINATES.vielsalm, 'Centre-Ville, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(9, 14, 0),
        tags: ['art', 'street-art'],
        description: 'Festival d\'art urbain et performances live',
        organizerId: 'fake-organizer-18',
        organizerName: 'Street Art Festival',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-3',
        title: 'Soirée Vin & Fromage',
        venue: createVenue(COORDINATES.vielsalm, 'Cave à Vin, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(11, 19, 0),
        tags: ['dégustation', 'vin'],
        description: 'Dégustation de vins et fromages locaux',
        organizerId: 'fake-organizer-19',
        organizerName: 'Cave Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-4',
        title: 'Randonnée Pédestre',
        venue: createVenue(COORDINATES.vielsalm, 'Départ Sentier des Crêtes', 'Vielsalm, Belgique'),
        ...getFutureDateTime(13, 8, 0),
        tags: ['randonnée', 'nature'],
        description: 'Randonnée guidée à travers les paysages ardennais',
        organizerId: 'fake-organizer-20',
        organizerName: 'Randonneurs Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-5',
        title: 'Atelier Calligraphie',
        venue: createVenue(COORDINATES.vielsalm, 'Atelier d\'Art, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(15, 11, 0),
        tags: ['art', 'calligraphie'],
        description: 'Découvrez l\'art de la calligraphie',
        organizerId: 'fake-organizer-21',
        organizerName: 'Atelier Calligraphie',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-6',
        title: 'Concert Metal Local',
        venue: createVenue(COORDINATES.vielsalm, 'Salle des Fêtes, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(17, 20, 30),
        tags: ['musique', 'metal'],
        description: 'Concert de groupes metal locaux',
        organizerId: 'fake-organizer-22',
        organizerName: 'Metal Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-7',
        title: 'Workshop Sérigraphie',
        venue: createVenue(COORDINATES.vielsalm, 'Atelier Sérigraphie, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(19, 13, 0),
        tags: ['art', 'sérigraphie'],
        description: 'Initiation à la sérigraphie et impression artisanale',
        organizerId: 'fake-organizer-23',
        organizerName: 'Atelier Sérigraphie',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-8',
        title: 'Soirée Quiz Musical',
        venue: createVenue(COORDINATES.vielsalm, 'Bar Le Salm, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(21, 19, 0),
        tags: ['jeux', 'musique'],
        description: 'Soirée quiz musical avec lots à gagner',
        organizerId: 'fake-organizer-24',
        organizerName: 'Quiz Night Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-vielsalm-9',
        title: 'Festival de Danse',
        venue: createVenue(COORDINATES.vielsalm, 'Place du Marché, Vielsalm', 'Vielsalm, Belgique'),
        ...getFutureDateTime(23, 18, 30),
        tags: ['danse', 'festival'],
        description: 'Festival de danse avec plusieurs troupes',
        organizerId: 'fake-organizer-25',
        organizerName: 'Danse Ardennes',
        isPublic: true,
        isOnline: true,
        isFake: true,
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
        description: 'Conférence sur les dernières innovations technologiques',
        organizerId: 'fake-organizer-26',
        organizerName: 'Tech Conference Brabant',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-2',
        title: 'Workshop Design Graphique',
        venue: createVenue(COORDINATES.nivelles, 'École d\'Art, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(7, 10, 30),
        tags: ['design', 'formation'],
        description: 'Workshop de design graphique et création visuelle',
        organizerId: 'fake-organizer-27',
        organizerName: 'Design Academy',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-3',
        title: 'Match de Football Amateur',
        venue: createVenue(COORDINATES.nivelles, 'Stade Municipal, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(9, 19, 0),
        tags: ['sport', 'football'],
        description: 'Match de football amateur entre équipes locales',
        organizerId: 'fake-organizer-28',
        organizerName: 'FC Nivelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-4',
        title: 'Exposition Photo Urbaine',
        venue: createVenue(COORDINATES.nivelles, 'Galerie Photo, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(11, 19, 0),
        tags: ['photographie', 'exposition'],
        description: 'Exposition de photographies urbaines',
        organizerId: 'fake-organizer-29',
        organizerName: 'Photo Club Nivelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-5',
        title: 'Tournoi de Basket 3x3',
        venue: createVenue(COORDINATES.nivelles, 'Terrain de Basket, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(13, 14, 0),
        tags: ['sport', 'basket'],
        description: 'Tournoi de basket 3x3 ouvert à tous',
        organizerId: 'fake-organizer-30',
        organizerName: 'Basket Club Nivelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-6',
        title: 'Conférence IA & Machine Learning',
        venue: createVenue(COORDINATES.nivelles, 'Centre de Conférences, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(15, 9, 30),
        tags: ['conférence', 'IA'],
        description: 'Conférence sur l\'intelligence artificielle et le machine learning',
        organizerId: 'fake-organizer-31',
        organizerName: 'AI Conference Brabant',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-7',
        title: 'Atelier Sushi & Ramen',
        venue: createVenue(COORDINATES.nivelles, 'Restaurant Japonais, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(17, 12, 0),
        tags: ['cuisine', 'japonais'],
        description: 'Atelier de cuisine japonaise : sushi et ramen',
        organizerId: 'fake-organizer-32',
        organizerName: 'Chef Sushi Nivelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-8',
        title: 'Soirée DJ Électro',
        venue: createVenue(COORDINATES.nivelles, 'Club Le Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(19, 23, 0),
        tags: ['musique', 'électro'],
        description: 'Soirée électro avec DJ locaux',
        organizerId: 'fake-organizer-33',
        organizerName: 'Electro Night Nivelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-nivelles-9',
        title: 'Marathon de Lecture',
        venue: createVenue(COORDINATES.nivelles, 'Bibliothèque Municipale, Nivelles', 'Nivelles, Belgique'),
        ...getFutureDateTime(21, 10, 0),
        tags: ['lecture', 'culture'],
        description: 'Marathon de lecture collective',
        organizerId: 'fake-organizer-34',
        organizerName: 'Bibliothèque Nivelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    
    // Waterloo (8 events)
    {
        id: 'fake-waterloo-1',
        title: 'Concert Acoustique',
        venue: createVenue(COORDINATES.waterloo, 'Chapelle Royale, Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(6, 17, 0),
        tags: ['musique', 'acoustique'],
        description: 'Concert acoustique dans un lieu historique',
        organizerId: 'fake-organizer-35',
        organizerName: 'Musique Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-2',
        title: 'Soirée Karaoké',
        venue: createVenue(COORDINATES.waterloo, 'Bar Le Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(8, 20, 0),
        tags: ['karaoké', 'divertissement'],
        description: 'Soirée karaoké conviviale',
        organizerId: 'fake-organizer-36',
        organizerName: 'Karaoké Night Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-3',
        title: 'Tournoi E-Sport FIFA',
        venue: createVenue(COORDINATES.waterloo, 'Gaming Center, Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(10, 16, 0),
        tags: ['e-sport', 'gaming'],
        description: 'Tournoi e-sport FIFA avec lots à gagner',
        organizerId: 'fake-organizer-37',
        organizerName: 'E-Sport Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-4',
        title: 'Soirée Vinyl Records',
        venue: createVenue(COORDINATES.waterloo, 'Vinyl Bar, Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(12, 20, 0),
        tags: ['musique', 'vinyl'],
        description: 'Soirée écoute de vinyles avec DJ',
        organizerId: 'fake-organizer-38',
        organizerName: 'Vinyl Night Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-5',
        title: 'Atelier Pâtisserie Vegan',
        venue: createVenue(COORDINATES.waterloo, 'Pâtisserie Vegan, Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(14, 14, 30),
        tags: ['cuisine', 'vegan'],
        description: 'Atelier de pâtisserie vegan',
        organizerId: 'fake-organizer-39',
        organizerName: 'Vegan Pastry Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-6',
        title: 'Course à Pied 5km',
        venue: createVenue(COORDINATES.waterloo, 'Parc de Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(16, 8, 0),
        tags: ['sport', 'course'],
        description: 'Course à pied de 5km ouverte à tous',
        organizerId: 'fake-organizer-40',
        organizerName: 'Running Club Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-7',
        title: 'Concert Reggae Roots',
        venue: createVenue(COORDINATES.waterloo, 'Salle des Fêtes, Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(18, 21, 0),
        tags: ['musique', 'reggae'],
        description: 'Concert reggae roots avec groupes locaux',
        organizerId: 'fake-organizer-41',
        organizerName: 'Reggae Night Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-waterloo-8',
        title: 'Tournoi de Volley-Ball',
        venue: createVenue(COORDINATES.waterloo, 'Complexe Sportif, Waterloo', 'Waterloo, Belgique'),
        ...getFutureDateTime(20, 17, 0),
        tags: ['sport', 'volley'],
        description: 'Tournoi de volley-ball mixte',
        organizerId: 'fake-organizer-42',
        organizerName: 'Volley Club Waterloo',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    
    // Charleroi (9 events)
    {
        id: 'fake-charleroi-1',
        title: 'Soirée Blues & Soul',
        venue: createVenue(COORDINATES.charleroi, 'Jazz Club, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(7, 20, 0),
        tags: ['musique', 'blues'],
        description: 'Soirée blues et soul avec musiciens locaux',
        organizerId: 'fake-organizer-43',
        organizerName: 'Blues Club Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-2',
        title: 'Atelier Poterie & Céramique',
        venue: createVenue(COORDINATES.charleroi, 'Atelier Céramique, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(9, 15, 0),
        tags: ['art', 'poterie'],
        description: 'Atelier de poterie et céramique',
        organizerId: 'fake-organizer-44',
        organizerName: 'Atelier Céramique Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-3',
        title: 'Dégustation Vins Naturels',
        venue: createVenue(COORDINATES.charleroi, 'Cave à Vin, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(11, 17, 0),
        tags: ['dégustation', 'vin'],
        description: 'Dégustation de vins naturels et bio',
        organizerId: 'fake-organizer-45',
        organizerName: 'Cave Nature Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-4',
        title: 'Workshop Électronique DIY',
        venue: createVenue(COORDINATES.charleroi, 'FabLab, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(13, 14, 0),
        tags: ['électronique', 'DIY'],
        description: 'Workshop d\'électronique et bricolage',
        organizerId: 'fake-organizer-46',
        organizerName: 'FabLab Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-5',
        title: 'Soirée Trivia Night',
        venue: createVenue(COORDINATES.charleroi, 'Pub Le Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(15, 19, 30),
        tags: ['jeux', 'trivia'],
        description: 'Soirée quiz général avec lots à gagner',
        organizerId: 'fake-organizer-47',
        organizerName: 'Trivia Night Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-6',
        title: 'Atelier Cuisine Thaïlandaise',
        venue: createVenue(COORDINATES.charleroi, 'Restaurant Thaï, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(17, 18, 0),
        tags: ['cuisine', 'thaï'],
        description: 'Atelier de cuisine thaïlandaise authentique',
        organizerId: 'fake-organizer-48',
        organizerName: 'Chef Thaï Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-7',
        title: 'Festival de Street Food',
        venue: createVenue(COORDINATES.charleroi, 'Place de la Ville, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(19, 12, 0),
        tags: ['food', 'festival'],
        description: 'Festival de street food avec food trucks',
        organizerId: 'fake-organizer-49',
        organizerName: 'Street Food Festival Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-8',
        title: 'Soirée Poker Texas Hold\'em',
        venue: createVenue(COORDINATES.charleroi, 'Poker Club, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(21, 19, 30),
        tags: ['poker', 'jeux'],
        description: 'Tournoi de poker Texas Hold\'em',
        organizerId: 'fake-organizer-50',
        organizerName: 'Poker Club Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-charleroi-9',
        title: 'Conférence Blockchain & Crypto',
        venue: createVenue(COORDINATES.charleroi, 'Centre de Conférences, Charleroi', 'Charleroi, Belgique'),
        ...getFutureDateTime(23, 10, 0),
        tags: ['conférence', 'blockchain'],
        description: 'Conférence sur la blockchain et les cryptomonnaies',
        organizerId: 'fake-organizer-51',
        organizerName: 'Blockchain Conference Charleroi',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    
    // Bruxelles (9 events)
    {
        id: 'fake-bruxelles-1',
        title: 'Atelier Mixologie Cocktails',
        venue: createVenue(COORDINATES.bruxelles, 'Bar à Cocktails, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(8, 18, 30),
        tags: ['cocktails', 'mixologie'],
        description: 'Atelier de mixologie et création de cocktails',
        organizerId: 'fake-organizer-52',
        organizerName: 'Cocktail Academy Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-2',
        title: 'Exposition Art Contemporain',
        venue: createVenue(COORDINATES.bruxelles, 'Musée d\'Art Moderne, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(10, 10, 0),
        tags: ['art', 'exposition'],
        description: 'Exposition d\'art contemporain international',
        organizerId: 'fake-organizer-53',
        organizerName: 'Musée d\'Art Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-3',
        title: 'Soirée Networking Tech',
        venue: createVenue(COORDINATES.bruxelles, 'Coworking Space, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(12, 18, 30),
        tags: ['networking', 'tech'],
        description: 'Soirée networking pour professionnels du tech',
        organizerId: 'fake-organizer-54',
        organizerName: 'Tech Meetup Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-4',
        title: 'Workshop Photographie',
        venue: createVenue(COORDINATES.bruxelles, 'Studio Photo, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(14, 13, 0),
        tags: ['photographie', 'formation'],
        description: 'Workshop de photographie urbaine',
        organizerId: 'fake-organizer-55',
        organizerName: 'Photo Academy Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-5',
        title: 'Festival de Musique Électro',
        venue: createVenue(COORDINATES.bruxelles, 'Parc de Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(16, 22, 0),
        tags: ['musique', 'festival'],
        description: 'Festival de musique électronique en plein air',
        organizerId: 'fake-organizer-56',
        organizerName: 'Electro Festival Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-6',
        title: 'Atelier Cuisine Italienne',
        venue: createVenue(COORDINATES.bruxelles, 'École de Cuisine, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(18, 14, 0),
        tags: ['cuisine', 'italien'],
        description: 'Atelier de cuisine italienne authentique',
        organizerId: 'fake-organizer-57',
        organizerName: 'Chef Italien Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-7',
        title: 'Concert Jazz Intime',
        venue: createVenue(COORDINATES.bruxelles, 'Jazz Club, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(20, 20, 0),
        tags: ['musique', 'jazz'],
        description: 'Concert jazz intimiste',
        organizerId: 'fake-organizer-58',
        organizerName: 'Jazz Club Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-8',
        title: 'Soirée Jeux de Société',
        venue: createVenue(COORDINATES.bruxelles, 'Ludothèque, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(22, 19, 30),
        tags: ['jeux', 'social'],
        description: 'Soirée jeux de société avec large sélection',
        organizerId: 'fake-organizer-59',
        organizerName: 'Ludothèque Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    },
    {
        id: 'fake-bruxelles-9',
        title: 'Workshop Développement Web',
        venue: createVenue(COORDINATES.bruxelles, 'Code Academy, Bruxelles', 'Bruxelles, Belgique'),
        ...getFutureDateTime(24, 10, 0),
        tags: ['tech', 'formation'],
        description: 'Workshop de développement web moderne',
        organizerId: 'fake-organizer-60',
        organizerName: 'Code Academy Bruxelles',
        isPublic: true,
        isOnline: true,
        isFake: true,
        stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
    }
]

