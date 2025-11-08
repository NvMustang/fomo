/**
 * Script pour générer des URLs d'images Pexels contextuelles pour les fake events
 * 
 * Usage: node scripts/generateFakeEventsImages.js
 * 
 * Ce script :
 * 1. Lit les fake events depuis fakeEventsData.ts
 * 2. Génère des queries contextuelles basées sur tags + titre
 * 3. Appelle l'API Pexels pour chaque event
 * 4. Met à jour directement fakeEventsData.ts avec les URLs générées
 * 5. Crée un backup avant modification
 * 
 * Prérequis: VITE_PEXELS_API_KEY doit être définie dans .env.local
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const PEXELS_API_KEY = process.env.VITE_PEXELS_API_KEY;
const PEXELS_API_URL = 'https://api.pexels.com/v1/search';
const DEFAULT_COVER_URL = 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=300&fit=crop&crop=center';

if (!PEXELS_API_KEY) {
    console.error('❌ Erreur: VITE_PEXELS_API_KEY non définie dans .env.local');
    console.error('   Veuillez créer un fichier .env.local avec:');
    console.error('   VITE_PEXELS_API_KEY=votre_cle_api_pexels');
    process.exit(1);
}

// Mapping de tags français vers queries Pexels en anglais
const TAG_MAPPING = {
    'musique': 'music',
    'jazz': 'jazz music',
    'rock': 'rock music',
    'pop': 'pop music',
    'classique': 'classical music',
    'cuisine': 'cooking food',
    'italienne': 'italian food',
    'française': 'french food',
    'sport': 'sport',
    'football': 'football sport',
    'basketball': 'basketball',
    'randonnée': 'hiking nature',
    'vtt': 'mountain biking',
    'art': 'art',
    'exposition': 'art exhibition',
    'peinture': 'painting art',
    'photographie': 'photography',
    'cinéma': 'cinema movie',
    'théâtre': 'theater',
    'danse': 'dance',
    'festival': 'festival',
    'concert': 'concert music',
    'conférence': 'conference',
    'formation': 'training education',
    'tech': 'technology',
    'développement': 'programming code',
    'startup': 'startup business',
    'networking': 'networking business',
    'nature': 'nature',
    'forêt': 'forest nature',
    'plage': 'beach',
    'montagne': 'mountain',
    'culture': 'culture',
    'histoire': 'history',
    'patrimoine': 'heritage',
    'famille': 'family',
    'enfants': 'children',
    'seniors': 'elderly',
    'bien-être': 'wellness',
    'yoga': 'yoga',
    'méditation': 'meditation',
    'santé': 'health',
    'environnement': 'environment',
    'écologie': 'ecology',
    'développement durable': 'sustainability'
};

/**
 * Génère une query contextuelle à partir du titre et des tags
 */
function generateContextualQuery(title, tags = []) {
    // Extraire les mots-clés du titre
    const titleWords = title
        .toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9\s]/g, '')
        .split(' ')
        .filter(word => word.length > 2)
        .slice(0, 2); // Prendre les 2 premiers mots du titre

    // Mapper les tags vers des queries en anglais
    const tagQueries = tags
        .map(tag => TAG_MAPPING[tag.toLowerCase()] || tag.toLowerCase())
        .filter(Boolean)
        .slice(0, 2); // Prendre les 2 premiers tags

    // Combiner titre + tags
    const allKeywords = [...titleWords, ...tagQueries];
    const query = allKeywords.slice(0, 3).join(' '); // Max 3 mots-clés

    return query || 'event';
}

/**
 * Récupère une image depuis Pexels
 */
async function getPexelsImage(query) {
    try {
        const response = await fetch(`${PEXELS_API_URL}?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, {
            headers: {
                'Authorization': PEXELS_API_KEY
            }
        });

        if (!response.ok) {
            console.warn(`  ⚠️  Erreur HTTP ${response.status} pour "${query}"`);
            return null;
        }

        const data = await response.json();
        
        if (data.photos && data.photos.length > 0) {
            const photo = data.photos[0];
            return photo.src?.large || photo.src?.medium || photo.src?.original || null;
        }

        return null;
    } catch (error) {
        console.error(`  ❌ Erreur pour "${query}":`, error.message);
        return null;
    }
}

/**
 * Lit les fake events depuis le fichier TypeScript et retourne le contenu + les events
 */
function parseFakeEvents() {
    const filePath = path.join(__dirname, '../src/utils/fakeEventsData.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const events = [];
    // Regex pour capturer chaque event avec son id, title, tags et coverUrl
    // Utilise une approche plus robuste en cherchant par ID unique
    const eventRegex = /id:\s*['"](fake-[^'"]+)['"][\s\S]*?title:\s*['"]([^'"]+)['"][\s\S]*?tags:\s*\[([^\]]*)\][\s\S]*?coverUrl:\s*([^,}]+),/g;
    
    let match;
    while ((match = eventRegex.exec(content)) !== null) {
        const [, id, title, tagsStr, currentCoverUrl] = match;
        
        const tags = tagsStr
            .split(',')
            .map(t => t.trim().replace(/['"]/g, ''))
            .filter(Boolean);
        
        // Trouver la position exacte du coverUrl pour ce event spécifique
        const idPattern = `id: '${id}'`;
        const idIndex = content.indexOf(idPattern, match.index);
        if (idIndex === -1) continue;
        
        // Chercher le coverUrl après cet ID (peut être DEFAULT_COVER_URL ou une URL en dur)
        const afterId = content.substring(idIndex);
        const coverUrlMatch = afterId.match(/coverUrl:\s*([^,}]+),/);
        if (!coverUrlMatch) continue;
        
        const coverUrlIndex = idIndex + afterId.indexOf(coverUrlMatch[0]);
        const coverUrlValue = coverUrlMatch[1].trim();
        
        events.push({
            id: id.trim(),
            title: title.trim(),
            tags,
            coverUrlIndex,
            coverUrlValue,
            coverUrlMatch: coverUrlMatch[0],
            fullMatch: coverUrlMatch[0]
        });
    }
    
    return { content, events };
}

/**
 * Génère les URLs pour tous les events et met à jour directement le fichier
 */
async function generateAllUrls() {
    console.log('📸 Génération des URLs Pexels pour les fake events...\n');
    
    const { content, events } = parseFakeEvents();
    console.log(`📋 ${events.length} events trouvés\n`);
    
    let successCount = 0;
    let failCount = 0;
    let updatedContent = content;
    
    // Traiter les events dans l'ordre inverse pour préserver les indices lors du remplacement
    const replacements = [];
    
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const query = generateContextualQuery(event.title, event.tags);
        
        console.log(`[${i + 1}/${events.length}] ${event.title}`);
        console.log(`  Query: "${query}"`);
        
        const imageUrl = await getPexelsImage(query);
        
        if (imageUrl) {
            console.log(`  ✅ ${imageUrl.substring(0, 60)}...`);
            replacements.push({
                event,
                coverUrl: imageUrl
            });
            successCount++;
        } else {
            console.log(`  ❌ Aucune image trouvée, garde l'URL par défaut`);
            failCount++;
        }
        
        // Délai pour respecter les rate limits (200 requêtes/heure)
        if (i < events.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2s entre chaque requête
        }
        
        console.log('');
    }
    
    console.log(`\n✅ Terminé: ${successCount} succès, ${failCount} échecs\n`);
    
    // Appliquer les remplacements dans l'ordre inverse pour préserver les indices
    replacements.reverse().forEach(({ event, coverUrl }) => {
        // Remplacer le coverUrl à la position exacte
        const beforeCoverUrl = updatedContent.substring(0, event.coverUrlIndex);
        const afterCoverUrl = updatedContent.substring(event.coverUrlIndex + event.fullMatch.length);
        
        // Construire le nouveau coverUrl (remplacer la valeur par l'URL entre guillemets)
        const newCoverUrl = `coverUrl: '${coverUrl}',`;
        
        updatedContent = beforeCoverUrl + newCoverUrl + afterCoverUrl;
    });
    
    // Écrire le fichier mis à jour
    writeUpdatedFile(updatedContent, successCount, failCount);
}

/**
 * Écrit le fichier mis à jour
 */
function writeUpdatedFile(content, successCount, failCount) {
    const filePath = path.join(__dirname, '../src/utils/fakeEventsData.ts');
    
    // Créer une backup avant modification
    const backupPath = path.join(__dirname, '../src/utils/fakeEventsData.ts.backup');
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(backupPath, originalContent);
    console.log(`💾 Backup créé: ${backupPath}`);
    
    // Écrire le fichier mis à jour
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Fichier mis à jour: ${filePath}`);
    console.log(`\n📊 Résumé: ${successCount} URLs générées, ${failCount} échecs`);
    console.log(`💡 Backup disponible en cas de problème: ${backupPath}\n`);
}

// Exécuter le script
if (require.main === module) {
    generateAllUrls().catch(console.error);
}

module.exports = { generateContextualQuery, getPexelsImage };

