/**
 * Script pour minifier le bookmarklet
 * Usage: npm run bookmarklet:minify
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const inputFile = path.join(__dirname, '..', 'public', 'bookmarklet.js');
const outputFile = path.join(__dirname, '..', 'public', 'bookmarklet.min.js');
const outputFileReady = path.join(__dirname, '..', 'public', 'bookmarklet.ready.txt');

async function minifyBookmarklet() {
    try {
        console.log('📦 Minification du bookmarklet...');

        // Lire le fichier source
        const code = fs.readFileSync(inputFile, 'utf8');

        // Minifier avec terser - version ultra-compressée
        // NOTE: drop_console et pure_funcs désactivés pour permettre le débogage
        const result = await minify(code, {
            compress: {
                drop_console: true, // Supprimer les console.log pour réduire la taille
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.warn'], // Supprimer console.log et console.warn
                passes: 3, // Plus de passes pour une meilleure compression
                unsafe: true, // Optimisations plus agressives
                unsafe_comps: true,
                unsafe_math: true,
                unsafe_methods: true,
                unsafe_proto: true,
                unsafe_regexp: true,
                unsafe_undefined: true,
            },
            mangle: {
                reserved: ['API_BASE_URL', '__FOMO_BOOKMARKLET_ACTIVE', '__FOMO_BOOKMARKLET_LOADED'] // Ne pas renommer ces variables
            },
            format: {
                comments: false, // Supprimer les commentaires
            }
        });

        if (result.error) {
            throw result.error;
        }

        // Écrire le fichier minifié
        fs.writeFileSync(outputFile, result.code, 'utf8');

        // Créer aussi une version prête à l'emploi avec le préfixe javascript:
        const readyCode = `javascript:${result.code}`;
        fs.writeFileSync(outputFileReady, readyCode, 'utf8');

        const originalSize = Buffer.byteLength(code, 'utf8');
        const minifiedSize = Buffer.byteLength(result.code, 'utf8');
        const readySize = Buffer.byteLength(readyCode, 'utf8');
        const reduction = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

        console.log('✅ Bookmarklet minifié avec succès!');
        console.log(`📊 Taille originale: ${(originalSize / 1024).toFixed(2)} KB`);
        console.log(`📊 Taille minifiée: ${(minifiedSize / 1024).toFixed(2)} KB`);
        console.log(`📊 Taille avec préfixe: ${(readySize / 1024).toFixed(2)} KB`);
        console.log(`📊 Réduction: ${reduction}%`);
        console.log(`📁 Fichier créé: ${outputFile}`);
        console.log(`📁 Fichier prêt à l'emploi: ${outputFileReady}`);
        console.log('\n💡 Pour utiliser le bookmarklet:');
        console.log('   OPTION 1 (Recommandée):');
        console.log('   1. Ouvrir le fichier public/bookmarklet.ready.txt');
        console.log('   2. Copier tout le contenu (déjà avec javascript:)');
        console.log('   3. Créer un nouveau bookmarklet dans votre navigateur');
        console.log('   4. Coller le code dans l\'URL du bookmarklet');
        console.log('\n   OPTION 2:');
        console.log('   1. Ouvrir le fichier public/bookmarklet.min.js');
        console.log('   2. Copier le contenu et ajouter "javascript:" devant');
        console.log('   3. Créer un nouveau bookmarklet dans votre navigateur');
        console.log('   4. Coller le code dans l\'URL du bookmarklet');

    } catch (error) {
        console.error('❌ Erreur lors de la minification:', error);
        process.exit(1);
    }
}

minifyBookmarklet();

