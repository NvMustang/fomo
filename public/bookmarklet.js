/**
 * Bookmarklet FOMO - Extraction d'événements Facebook
 * 
 * Installation: Copier le code minifié dans un nouveau bookmarklet
 * Usage: Cliquer sur le bookmarklet depuis une page d'événement Facebook
 * 
 * CONFIGURATION REQUISE:
 * - Modifier API_BASE_URL ci-dessous avec votre URL de production
 *   Exemple: const API_BASE_URL = 'https://votre-domaine.vercel.app/api'
 * - Modifier FOMO_KEY ci-dessous avec votre clé API (même valeur que FOMO_KEY dans .env)
 *   Exemple: const FOMO_KEY = 'votre-cle-api-secrete'
 */

(function () {
    'use strict';

    // ===== CONFIGURATION =====
    // ⚠️ MODIFIER CETTE URL avec votre URL de production
    // Pour test local: http://localhost:3001/api
    // Pour production: https://fomo-swart.vercel.app/api
    const API_BASE_URL = 'https://fomo-swart.vercel.app/api';
    // ⚠️ MODIFIER CETTE CLÉ avec votre clé API FOMO (même valeur que FOMO_KEY dans .env)
    const FOMO_KEY = 'LaFomoCrew';
    // ===== FIN CONFIGURATION =====

    // Vérifier si on est déjà sur une page d'événement Facebook
    const isFacebookEvent = window.location.href.includes('/events/') && window.location.hostname.includes('facebook.com');

    if (!isFacebookEvent) {
        alert('⚠️ Ce bookmarklet doit être utilisé sur une page d\'événement Facebook.\n\nOuvrez une page d\'événement Facebook (ex: facebook.com/events/...) puis réessayez.');
        return;
    }

    // Empêcher l'exécution multiple
    if (window.__FOMO_BOOKMARKLET_ACTIVE) {
        return;
    }
    window.__FOMO_BOOKMARKLET_ACTIVE = true;

    /**
     * Extraire les données de l'événement depuis le DOM Facebook
     */
    async function extractEventData() {
        const data = {
            source: 'facebook',
            url: window.location.href,
            title: '',
            description: '',
            start: '',
            end: '',
            timezone: 'Europe/Brussels',
            venue_name: '',
            address: '',
            host: '',
            attending_count: '',
            interested_count: '',
            cover: ''
        };

        try {
            // Déclarer mainContent une seule fois pour toute la fonction
            const mainContent = document.querySelector('[role="main"]') || document.body;

            // ===== STRATÉGIE PRIORITAIRE : Structure conteneur avec Date/Titre/Adresse =====
            // Chercher un conteneur avec plusieurs divs enfants, dont un contient un h1 (titre)
            // Structure: conteneur > divs enfants (x1e56ztr x1xmf6yo) > contenu
            // Ordre: 1er div = Date, 2ème div = Titre (h1), 3ème div = Adresse/Nom du lieu
            console.log('🔍 [FOMO Bookmarklet] === STRATÉGIE STRUCTURE CONTENEUR ===');

            // Chercher tous les h1 dans mainContent
            const allH1s = mainContent.querySelectorAll('h1');
            for (const h1 of allH1s) {
                const h1Text = h1.textContent.trim();
                if (!h1Text || h1Text.length < 3 || h1Text.length > 200) continue;

                // Remonter pour trouver le conteneur parent avec la structure
                let container = h1.parentElement;
                let levelsUp = 0;
                const maxLevels = 6;

                while (container && levelsUp < maxLevels) {
                    // Vérifier si ce conteneur a plusieurs divs enfants directs
                    const childDivs = Array.from(container.children).filter(child =>
                        child.tagName === 'DIV' && child.children.length > 0
                    );

                    // On cherche au moins 3 divs enfants (date, titre, adresse)
                    if (childDivs.length >= 3) {
                        // Vérifier que l'un des divs contient notre h1
                        const h1Container = childDivs.find(div => div.contains(h1));

                        if (h1Container) {
                            // Trouvé ! Extraire les informations dans l'ordre
                            const h1Index = childDivs.indexOf(h1Container);

                            // Premier div : Date de début (et parfois date de fin)
                            if (childDivs[0] && !data.start) {
                                const dateText = childDivs[0].textContent.trim();
                                if (dateText && dateText.length > 5) {
                                    // Parser la date (format français ou autre)
                                    // Cette logique sera gérée par la section dates existante
                                    console.log('📅 [FOMO Bookmarklet] Date trouvée via structure:', dateText);
                                }
                            }

                            // Div avec h1 : Titre
                            if (!data.title && h1Text) {
                                data.title = h1Text;
                                console.log('✅ [FOMO Bookmarklet] Titre trouvé via structure:', h1Text);
                            }

                            // Troisième div (ou suivant) : Adresse/Nom du lieu
                            if (childDivs.length > h1Index + 1) {
                                const addressDiv = childDivs[h1Index + 1];
                                const addressText = addressDiv.textContent.trim();

                                if (addressText && addressText.length >= 2 && addressText.length < 200) {
                                    // Exclure le titre
                                    const isTitle = data.title && (
                                        addressText.toLowerCase() === data.title.toLowerCase() ||
                                        addressText.toLowerCase().includes(data.title.toLowerCase()) ||
                                        data.title.toLowerCase().includes(addressText.toLowerCase())
                                    );

                                    if (!isTitle) {
                                        // Si c'est une adresse complète (avec virgules), extraire la ville comme nom du lieu
                                        if (addressText.includes(',')) {
                                            const parts = addressText.split(',').map(p => p.trim());
                                            if (parts.length >= 2) {
                                                // La ville est généralement l'avant-dernière partie
                                                const cityIndex = parts.length - 2;
                                                const city = parts[cityIndex];

                                                if (city && city.length >= 2 && city.length < 100) {
                                                    if (!data.venue_name) {
                                                        data.venue_name = city;
                                                        console.log('✅ [FOMO Bookmarklet] Nom du lieu (ville) trouvé via structure:', city);
                                                    }
                                                    if (!data.address) {
                                                        data.address = addressText;
                                                        console.log('✅ [FOMO Bookmarklet] Adresse trouvée via structure:', addressText);
                                                    }
                                                }
                                            }
                                        } else {
                                            // Nom simple (sans virgule)
                                            if (!data.venue_name) {
                                                data.venue_name = addressText;
                                                console.log('✅ [FOMO Bookmarklet] Nom du lieu trouvé via structure:', addressText);
                                            }
                                        }
                                    }
                                }
                            }

                            // Si on a trouvé au moins le titre, on peut arrêter
                            if (data.title) {
                                console.log('✅ [FOMO Bookmarklet] Structure conteneur identifiée et exploitée');
                                break;
                            }
                        }
                    }

                    container = container.parentElement;
                    levelsUp++;
                }

                // Si on a trouvé le titre via cette stratégie, on arrête
                if (data.title) break;
            }

            // ===== TITRE (fallback si stratégie structure n'a pas fonctionné) =====
            if (!data.title) {
                const titleByTestId = document.querySelector('h1[data-testid="event-permalink-event-name"]');
                if (titleByTestId && titleByTestId.textContent.trim()) {
                    data.title = titleByTestId.textContent.trim();
                } else {
                    const h1Elements = mainContent.querySelectorAll('h1');
                    for (const h1 of h1Elements) {
                        const text = h1.textContent.trim();
                        if (text && text.length > 3 && text.length < 200) {
                            data.title = text;
                            break;
                        }
                    }
                }
            }

            // ===== DESCRIPTION =====
            // Essayer de cliquer sur "Voir plus" / "En voir plus" / "See more" pour déplier la description complète
            // Chercher dans le contenu principal pour être plus précis
            const expandButtons = mainContent.querySelectorAll('[role="button"]');
            let clicked = false;
            for (const btn of expandButtons) {
                const btnText = btn.textContent.trim().toLowerCase();
                // Patterns pour les boutons d'expansion
                const isExpandButton = btnText === 'voir plus' || btnText === 'en voir plus' ||
                    btnText === 'see more' || btnText.includes('voir plus') ||
                    btnText.includes('see more');
                // Exclure les boutons de réduction
                const isReduceButton = btnText === 'voir moins' || btnText === 'see less' ||
                    btnText.includes('moins') || btnText.includes('less');

                if (isExpandButton && !isReduceButton) {
                    try {
                        console.log('🔽 [FOMO Bookmarklet] Clic sur bouton "Voir plus" pour déplier la description:', btnText);
                        btn.click();
                        clicked = true;
                        // Attendre un peu que le contenu se charge (500ms)
                        await new Promise(resolve => setTimeout(resolve, 500));
                        break;
                    } catch (e) {
                        console.warn('⚠️ [FOMO Bookmarklet] Erreur lors du clic sur "Voir plus":', e);
                    }
                }
            }
            if (!clicked) {
                console.log('ℹ️ [FOMO Bookmarklet] Aucun bouton "Voir plus" trouvé ou description déjà dépliée');
            }

            // Stratégie 1: Span avec classes spécifiques contenant plusieurs paragraphes (description complète)
            // Chercher le span qui contient tous les paragraphes de description
            // Le span parent contient tous les paragraphes entre ::before et ::after
            console.log('📝 [FOMO Bookmarklet] === DÉBUT EXTRACTION DESCRIPTION ===');

            // Chercher le span parent qui contient toute la description
            // Il peut être dans un div parent avec classes spécifiques
            let descSpan = null;

            // Essayer d'abord de trouver le span dans un div parent spécifique (selon le sélecteur CSS fourni)
            const parentDivs = mainContent.querySelectorAll('div.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak');
            console.log('📝 [FOMO Bookmarklet] Nombre de divs html-div.xdj266r trouvés:', parentDivs.length);
            for (const parentDiv of parentDivs) {
                const span = parentDiv.querySelector('span[dir="auto"][class*="xdmh292"][class*="x15dsfln"][class*="x140p0ai"]');
                if (span) {
                    // Vérifier que ce span contient des paragraphes de description
                    const hasFirstDiv = span.querySelector('div.xdj266r.x14z9mp.xat24cr.x1lziwak.x1vvkbs');
                    const hasOtherDivs = span.querySelectorAll('div.x14z9mp.xat24cr.x1lziwak.x1vvkbs.xtlvy1s').length > 0;
                    if (hasFirstDiv || hasOtherDivs) {
                        descSpan = span;
                        console.log('📝 [FOMO Bookmarklet] ✅ Span trouvé dans div parent html-div');
                        break;
                    }
                }
            }

            // Fallback: chercher directement le span
            if (!descSpan) {
                descSpan = mainContent.querySelector('span[dir="auto"][class*="xdmh292"][class*="x15dsfln"][class*="x140p0ai"]');
            }

            if (descSpan) {
                console.log('📝 [FOMO Bookmarklet] ✅ Span multi-paragraphes trouvé');
                console.log('📝 [FOMO Bookmarklet] Contenu HTML du span (premiers 500 caractères):', descSpan.innerHTML.substring(0, 500));

                // Cloner le span pour ne pas modifier l'original
                const clone = descSpan.cloneNode(true);

                // Supprimer TOUS les boutons (Voir moins, Voir plus, etc.)
                const buttons = clone.querySelectorAll('[role="button"], button, [class*="button"]');
                console.log('📝 [FOMO Bookmarklet] Nombre de boutons trouvés:', buttons.length);
                let removedButtons = 0;
                buttons.forEach(btn => {
                    const btnText = btn.textContent.trim().toLowerCase();
                    if (btnText.includes('voir moins') || btnText.includes('voir plus') ||
                        btnText.includes('en savoir plus') || btnText.includes('see more') ||
                        btnText.includes('see less') || btnText === 'voir plus' || btnText === 'voir moins' ||
                        btnText === 'plus' || btnText === 'moins' || btnText === 'more' || btnText === 'less') {
                        btn.remove();
                        removedButtons++;
                    }
                });
                console.log('📝 [FOMO Bookmarklet] Boutons supprimés:', removedButtons);

                // Fonction pour extraire le texte avec les emojis et sauts de ligne préservés
                // Remplace les images d'emoji par leur attribut alt et les <br> par des sauts de ligne
                const extractTextWithEmojis = (element) => {
                    // Cloner l'élément pour ne pas modifier l'original
                    const tempDiv = element.cloneNode(true);
                    // Remplacer toutes les images d'emoji par leur attribut alt
                    const emojiImages = tempDiv.querySelectorAll('img[alt]');
                    emojiImages.forEach(img => {
                        const altText = img.getAttribute('alt') || '';
                        // Vérifier que l'image a toujours un parent avant de remplacer
                        if (img.parentNode) {
                            const textNode = document.createTextNode(altText);
                            try {
                                img.parentNode.replaceChild(textNode, img);
                            } catch (e) {
                                // Si le remplacement échoue, on ignore (l'image sera ignorée dans textContent)
                                console.warn('⚠️ [FOMO Bookmarklet] Erreur remplacement emoji:', e);
                            }
                        }
                    });
                    // Remplacer tous les <br> (avec ou sans attributs) par des sauts de ligne
                    const brElements = tempDiv.querySelectorAll('br, br.html-br');
                    brElements.forEach(br => {
                        // Vérifier que le br a toujours un parent avant de remplacer
                        if (br.parentNode) {
                            const textNode = document.createTextNode('\n');
                            try {
                                br.parentNode.replaceChild(textNode, br);
                            } catch (e) {
                                // Si le remplacement échoue, on ignore (le br sera ignoré dans textContent)
                                console.warn('⚠️ [FOMO Bookmarklet] Erreur remplacement <br>:', e);
                            }
                        }
                    });
                    return tempDiv.textContent.trim();
                };

                // Extraire tous les paragraphes dans l'ordre du DOM
                // Structure: premier div avec xdj266r, puis tous les autres avec xtlvy1s
                const paragraphs = [];

                // 1. Premier paragraphe (titre/intro) avec xdj266r (peut contenir des emojis/images)
                const firstDivs = clone.querySelectorAll('div.xdj266r.x14z9mp.xat24cr.x1lziwak.x1vvkbs');
                console.log('📝 [FOMO Bookmarklet] Nombre de divs xdj266r trouvés:', firstDivs.length);
                if (firstDivs.length > 0) {
                    // Prendre le premier div xdj266r trouvé dans l'ordre du DOM
                    const firstDiv = firstDivs[0];
                    const firstText = extractTextWithEmojis(firstDiv);
                    console.log('📝 [FOMO Bookmarklet] Premier div (xdj266r) trouvé');
                    console.log('📝 [FOMO Bookmarklet] Texte du premier div (avec emojis):', firstText);
                    console.log('📝 [FOMO Bookmarklet] HTML du premier div (premiers 200 caractères):', firstDiv.innerHTML.substring(0, 200));
                    if (firstText && firstText.length > 0) {
                        paragraphs.push(firstText);
                        console.log('📝 [FOMO Bookmarklet] ✅ Premier paragraphe ajouté (longueur:', firstText.length, ')');
                    } else {
                        console.warn('📝 [FOMO Bookmarklet] ⚠️ Premier div trouvé mais texte vide après trim');
                    }
                } else {
                    console.log('📝 [FOMO Bookmarklet] ⚠️ Aucun div xdj266r trouvé');
                }

                // 2. Tous les autres paragraphes avec xtlvy1s (dans l'ordre du DOM)
                // Tous utilisent le même sélecteur: div.x14z9mp.xat24cr.x1lziwak.x1vvkbs.xtlvy1s
                const otherDivs = clone.querySelectorAll('div.x14z9mp.xat24cr.x1lziwak.x1vvkbs.xtlvy1s');
                console.log('📝 [FOMO Bookmarklet] Nombre de divs xtlvy1s trouvés:', otherDivs.length);
                console.log('📝 [FOMO Bookmarklet] Extraction de tous les paragraphes dans l\'ordre du DOM...');
                otherDivs.forEach((div, index) => {
                    const divText = extractTextWithEmojis(div);
                    console.log(`📝 [FOMO Bookmarklet] Div xtlvy1s ${index + 1}/${otherDivs.length} texte complet (avec emojis):`, divText);
                    console.log(`📝 [FOMO Bookmarklet] Div xtlvy1s ${index + 1} HTML (premiers 200 caractères):`, div.innerHTML.substring(0, 200));
                    if (divText && divText.length > 0) {
                        paragraphs.push(divText);
                        console.log(`📝 [FOMO Bookmarklet] ✅ Paragraphe ${paragraphs.length} ajouté (longueur: ${divText.length})`);
                    } else {
                        console.warn(`📝 [FOMO Bookmarklet] ⚠️ Div xtlvy1s ${index + 1} trouvé mais texte vide après trim`);
                    }
                });

                console.log('📝 [FOMO Bookmarklet] Total paragraphes extraits:', paragraphs.length);

                // 3. Fallback: si aucun paragraphe structuré trouvé, chercher tous les divs avec classes communes
                if (paragraphs.length === 0) {
                    console.log('📝 [FOMO Bookmarklet] Aucun paragraphe structuré trouvé, recherche fallback dans tous les divs...');
                    const allDescDivs = clone.querySelectorAll('div.x14z9mp.xat24cr.x1lziwak.x1vvkbs');
                    console.log('📝 [FOMO Bookmarklet] Nombre total de divs x14z9mp.xat24cr.x1lziwak.x1vvkbs trouvés:', allDescDivs.length);
                    allDescDivs.forEach((div, index) => {
                        const divText = extractTextWithEmojis(div);
                        if (divText && divText.length > 10) { // Filtrer les divs trop courts
                            paragraphs.push(divText);
                            console.log(`📝 [FOMO Bookmarklet] ✅ Paragraphe fallback ${paragraphs.length} ajouté (avec emojis):`, divText.substring(0, 50));
                        }
                    });
                }

                // Concaténer tous les paragraphes avec des sauts de ligne
                let text = '';
                if (paragraphs.length > 0) {
                    text = paragraphs.join('\n\n');
                    console.log('📝 [FOMO Bookmarklet] Total paragraphes concaténés:', paragraphs.length);
                    console.log('📝 [FOMO Bookmarklet] Texte avant nettoyage (premiers 500 caractères):', text.substring(0, 500));
                } else {
                    // Fallback: utiliser le texte direct du span
                    text = clone.textContent.trim();
                    console.log('📝 [FOMO Bookmarklet] ⚠️ Aucun paragraphe structuré trouvé, utilisation du texte direct');
                    console.log('📝 [FOMO Bookmarklet] Texte direct (premiers 500 caractères):', text.substring(0, 500));
                }

                // Nettoyer uniquement les restes de boutons
                const textBeforeClean = text;
                text = text.replace(/\s*(voir\s+(plus|moins)|en\s+savoir\s+plus|see\s+(more|less))\s*/gi, '');
                text = text.replace(/\n{3,}/g, '\n\n').trim(); // Normaliser les sauts de ligne multiples
                if (textBeforeClean !== text) {
                    console.log('📝 [FOMO Bookmarklet] Texte nettoyé (différences détectées)');
                }

                if (text && text.length > 20) {
                    data.description = text.substring(0, 2000); // Limite augmentée pour descriptions longues
                    console.log('✅ [FOMO Bookmarklet] Description assignée à data.description');
                    console.log('📝 [FOMO Bookmarklet] Longueur totale:', text.length);
                    console.log('📝 [FOMO Bookmarklet] Description finale (premiers 500 caractères):', data.description.substring(0, 500));
                    console.log('📝 [FOMO Bookmarklet] Description finale (derniers 200 caractères):', data.description.substring(Math.max(0, data.description.length - 200)));
                } else {
                    console.warn('⚠️ [FOMO Bookmarklet] Texte extrait trop court ou vide');
                    console.warn('📝 [FOMO Bookmarklet] Longueur du texte:', text ? text.length : 0);
                    console.warn('📝 [FOMO Bookmarklet] Contenu du texte:', text);
                }
            } else {
                console.log('ℹ️ [FOMO Bookmarklet] ❌ Span multi-paragraphes non trouvé');
                console.log('📝 [FOMO Bookmarklet] Recherche dans mainContent:', mainContent ? 'trouvé' : 'non trouvé');
                const allSpans = mainContent.querySelectorAll('span[dir="auto"]');
                console.log('📝 [FOMO Bookmarklet] Nombre total de spans dir="auto" trouvés:', allSpans.length);
            }
            console.log('📝 [FOMO Bookmarklet] === FIN EXTRACTION DESCRIPTION ===');
            console.log('📝 [FOMO Bookmarklet] Description finale dans data.description:', data.description || 'VIDE');

            // Stratégie 2: data-testid
            if (!data.description) {
                const descSelectors = [
                    '[data-testid="event-permalink-details"]',
                    '[data-testid="event-permalink-description"]',
                    '[data-testid="event-permalink-about"]',
                    '[data-testid="event-permalink-event-description"]'
                ];
                for (const selector of descSelectors) {
                    const el = document.querySelector(selector);
                    if (el) {
                        const text = el.textContent.trim();
                        if (text && text.length > 20) {
                            data.description = text.substring(0, 1000);
                            break;
                        }
                    }
                }
            }

            // Stratégie 3: Div avec classes spécifiques Facebook (description principale)
            if (!data.description) {
                // Chercher le div avec les classes xdj266r x14z9mp xat24cr x1lziwak x1vvkbs
                const descDiv = document.querySelector('div.xdj266r.x14z9mp.xat24cr.x1lziwak.x1vvkbs');
                if (descDiv) {
                    // Cloner le div pour ne pas modifier l'original
                    const clone = descDiv.cloneNode(true);
                    // Supprimer TOUS les boutons (plus agressif)
                    const buttons = clone.querySelectorAll('[role="button"], button, [class*="button"]');
                    buttons.forEach(btn => {
                        const btnText = btn.textContent.trim().toLowerCase();
                        // Liste exhaustive des patterns de boutons
                        if (btnText.includes('voir moins') || btnText.includes('voir plus') ||
                            btnText.includes('en savoir plus') || btnText.includes('see more') ||
                            btnText.includes('see less') || btnText === 'voir plus' || btnText === 'voir moins' ||
                            btnText === 'plus' || btnText === 'moins' || btnText === 'more' || btnText === 'less') {
                            btn.remove();
                        }
                    });
                    let text = clone.textContent.trim();

                    // Nettoyer le texte final pour supprimer les restes de boutons
                    text = text.replace(/\s*(voir\s+(plus|moins)|en\s+savoir\s+plus|see\s+(more|less))\s*/gi, '');
                    text = text.replace(/\s+/g, ' ').trim(); // Normaliser les espaces

                    if (text && text.length > 20) {
                        data.description = text.substring(0, 1000);
                        console.log('📝 [FOMO Bookmarklet] Description trouvée via div spécifique:', text.substring(0, 100));
                    }
                }
            }

            // Stratégie 4: Chercher dans les divs avec classes communes (fallback flexible)
            if (!data.description) {
                const descDivs = mainContent.querySelectorAll('div[class*="xdj266r"], div[class*="x14z9mp"]');
                for (const div of descDivs) {
                    const clone = div.cloneNode(true);
                    // Supprimer TOUS les boutons (plus agressif)
                    const buttons = clone.querySelectorAll('[role="button"], button, [class*="button"]');
                    buttons.forEach(btn => {
                        const btnText = btn.textContent.trim().toLowerCase();
                        if (btnText.includes('voir moins') || btnText.includes('voir plus') ||
                            btnText.includes('en savoir plus') || btnText.includes('see more') ||
                            btnText.includes('see less') || btnText === 'voir plus' || btnText === 'voir moins' ||
                            btnText === 'plus' || btnText === 'moins' || btnText === 'more' || btnText === 'less') {
                            btn.remove();
                        }
                    });
                    let text = clone.textContent.trim();
                    // Nettoyer le texte final
                    text = text.replace(/\s*(voir\s+(plus|moins)|en\s+savoir\s+plus|see\s+(more|less))\s*/gi, '');
                    text = text.replace(/\s+/g, ' ').trim();

                    if (text && text.length > 50 && text.length < 2000 &&
                        !text.match(/^https?:\/\//) &&
                        text.split(/\s+/).length > 10) {
                        data.description = text.substring(0, 1000);
                        break;
                    }
                }
            }

            // Stratégie 5: Chercher dans les divs avec dir="auto" qui contiennent beaucoup de texte
            if (!data.description) {
                const divs = mainContent.querySelectorAll('div[dir="auto"]');
                let longestText = '';
                for (const div of divs) {
                    const clone = div.cloneNode(true);
                    // Supprimer TOUS les boutons (plus agressif)
                    const buttons = clone.querySelectorAll('[role="button"], button, [class*="button"]');
                    buttons.forEach(btn => {
                        const btnText = btn.textContent.trim().toLowerCase();
                        if (btnText.includes('voir moins') || btnText.includes('voir plus') ||
                            btnText.includes('en savoir plus') || btnText.includes('see more') ||
                            btnText.includes('see less') || btnText === 'voir plus' || btnText === 'voir moins' ||
                            btnText === 'plus' || btnText === 'moins' || btnText === 'more' || btnText === 'less') {
                            btn.remove();
                        }
                    });
                    let text = clone.textContent.trim();
                    // Nettoyer le texte final
                    text = text.replace(/\s*(voir\s+(plus|moins)|en\s+savoir\s+plus|see\s+(more|less))\s*/gi, '');
                    text = text.replace(/\s+/g, ' ').trim();

                    // Filtrer les textes qui semblent être des descriptions (longs, pas de liens uniquement)
                    if (text && text.length > 50 && text.length < 2000 &&
                        !text.match(/^https?:\/\//) &&
                        text.split(/\s+/).length > 10) {
                        if (text.length > longestText.length) {
                            longestText = text;
                        }
                    }
                }
                if (longestText) {
                    data.description = longestText.substring(0, 1000);
                }
            }

            // ===== DATES =====
            console.log('📅 [FOMO Bookmarklet] === DÉBUT EXTRACTION DATES ===');

            // Stratégie 0: Span spécifique avec format "du X mois. HH:MM au X mois. HH:MM" (prioritaire)
            console.log('📅 [FOMO Bookmarklet] Stratégie 0: Recherche span spécifique avec format "du X mois. HH:MM au X mois. HH:MM"...');
            const dateSpanSpecific = mainContent.querySelector('span[dir="auto"][class*="xdmh292"][class*="x15dsfln"][class*="x140p0ai"][class*="x1yc453h"][class*="x1a1m0xk"][class*="x1xlr1w8"]');
            if (dateSpanSpecific) {
                const dateText = dateSpanSpecific.textContent.trim();
                console.log('📅 [FOMO Bookmarklet] Texte trouvé dans span spécifique:', dateText);

                // Parser le format "du 8 nov. 11:00 au 9 nov. 19:00"
                // Pattern: "du" jour mois_abrégé heure "au" jour mois_abrégé heure
                const dateMatch = dateText.match(/du\s+(\d{1,2})\s+(\w+)\.\s+(\d{1,2}):(\d{2})\s+au\s+(\d{1,2})\s+(\w+)\.\s+(\d{1,2}):(\d{2})/i);

                if (dateMatch) {
                    const [, startDay, startMonthAbbr, startHour, startMinute, endDay, endMonthAbbr, endHour, endMinute] = dateMatch;
                    console.log('📅 [FOMO Bookmarklet] Match trouvé:', { startDay, startMonthAbbr, startHour, startMinute, endDay, endMonthAbbr, endHour, endMinute });

                    // Mapping des mois abrégés français
                    const monthAbbrMap = {
                        'janv': 0, 'jan': 0, 'févr': 1, 'fév': 1, 'mars': 2, 'mar': 2,
                        'avr': 3, 'mai': 4, 'juin': 5, 'juil': 6, 'jul': 6, 'août': 7, 'aout': 7,
                        'sept': 8, 'oct': 9, 'nov': 10, 'déc': 11, 'dec': 11,
                        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
                    };

                    const startMonth = monthAbbrMap[startMonthAbbr.toLowerCase()];
                    const endMonth = monthAbbrMap[endMonthAbbr.toLowerCase()];

                    if (startMonth !== undefined && endMonth !== undefined) {
                        // Utiliser l'année actuelle ou l'année suivante si le mois est déjà passé
                        const now = new Date();
                        let year = now.getFullYear();
                        if (startMonth < now.getMonth() || (startMonth === now.getMonth() && parseInt(startDay) < now.getDate())) {
                            year = year + 1;
                        }

                        const startDate = new Date(year, startMonth, parseInt(startDay), parseInt(startHour), parseInt(startMinute));
                        const endDate = new Date(year, endMonth, parseInt(endDay), parseInt(endHour), parseInt(endMinute));

                        console.log('📅 [FOMO Bookmarklet] Dates créées - Début:', startDate, 'Fin:', endDate);

                        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                            data.start = startDate.toISOString();
                            data.end = endDate.toISOString();
                            console.log('✅ [FOMO Bookmarklet] Date début extraite:', data.start);
                            console.log('✅ [FOMO Bookmarklet] Date fin extraite:', data.end);
                        } else {
                            console.warn('⚠️ [FOMO Bookmarklet] Dates invalides après parsing');
                        }
                    } else {
                        console.warn('⚠️ [FOMO Bookmarklet] Mois non reconnus:', startMonthAbbr, endMonthAbbr);
                    }
                } else {
                    console.log('📅 [FOMO Bookmarklet] Format "du X mois. HH:MM au X mois. HH:MM" non détecté dans le texte');
                }
            } else {
                console.log('📅 [FOMO Bookmarklet] Span spécifique non trouvé');
            }

            // Stratégie 1: Chercher dans les métadonnées JSON-LD
            console.log('📅 [FOMO Bookmarklet] Stratégie 1: Recherche dans JSON-LD...');
            const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
            console.log('📅 [FOMO Bookmarklet] Nombre de scripts JSON-LD trouvés:', jsonLdScripts.length);
            for (const script of jsonLdScripts) {
                try {
                    const json = JSON.parse(script.textContent);
                    if (json['@type'] === 'Event' || (Array.isArray(json) && json.find(item => item['@type'] === 'Event'))) {
                        const event = Array.isArray(json) ? json.find(item => item['@type'] === 'Event') : json;
                        console.log('📅 [FOMO Bookmarklet] Événement trouvé dans JSON-LD:', { startDate: event.startDate, endDate: event.endDate });
                        if (event.startDate) {
                            data.start = new Date(event.startDate).toISOString();
                            console.log('✅ [FOMO Bookmarklet] Date début extraite depuis JSON-LD:', data.start);
                        }
                        if (event.endDate) {
                            data.end = new Date(event.endDate).toISOString();
                            console.log('✅ [FOMO Bookmarklet] Date fin extraite depuis JSON-LD:', data.end);
                        }
                        break;
                    }
                } catch (e) {
                    console.warn('⚠️ [FOMO Bookmarklet] Erreur parsing JSON-LD:', e);
                }
            }

            // Stratégie 2: Chercher les spans avec classes spécifiques Facebook (date et heure)
            if (!data.start) {
                console.log('📅 [FOMO Bookmarklet] Stratégie 2: Recherche dans spans avec classes spécifiques...');
                // Chercher les spans avec dir="auto" et classes communes qui contiennent des dates
                const dateSpans = mainContent.querySelectorAll('span[dir="auto"][class*="xdmh292"], span[dir="auto"][class*="x15dsfln"]');
                console.log('📅 [FOMO Bookmarklet] Nombre de spans avec classes spécifiques trouvés:', dateSpans.length);
                let dateText = '';

                for (const span of dateSpans) {
                    const text = span.textContent.trim();
                    // Pattern: "Dimanche 26 avril 2026 de 13:00 à 19:00" ou similaire
                    // OU formats relatifs: "Aujourd'hui à 06:00", "Demain à 22:00", "Aujourd'hui de 6:00 à 16:00"
                    if (text && (
                        (text.includes('de') && text.includes('à') && text.match(/\d{1,2}\s+\w+\s+\d{4}/)) ||
                        (text.includes('à') && text.match(/\d{1,2}\s+\w+\s+\d{4}/)) ||
                        text.match(/\d{1,2}\/\d{1,2}\/\d{4}/) ||
                        text.match(/\d{4}-\d{2}-\d{2}/) ||
                        /(aujourd'hui|demain|today|tomorrow)/i.test(text) // Formats relatifs
                    )) {
                        dateText = text;
                        console.log('📅 [FOMO Bookmarklet] Date trouvée via span spécifique:', text);
                        break;
                    }
                }

                // Si pas trouvé, chercher dans les attributs data et aria-label
                if (!dateText) {
                    console.log('📅 [FOMO Bookmarklet] Recherche dans attributs data-testid et aria-label...');
                    const dateSelectors = [
                        '[data-testid="event-permalink-event-time"]',
                        '[data-testid="event-time"]',
                        '[aria-label*="Date"]',
                        '[aria-label*="date"]'
                    ];

                    for (const selector of dateSelectors) {
                        const elements = document.querySelectorAll(selector);
                        console.log(`📅 [FOMO Bookmarklet] Sélecteur "${selector}": ${elements.length} éléments trouvés`);
                        for (const el of elements) {
                            const text = el.textContent.trim() || el.getAttribute('aria-label') || '';
                            if (text && (
                                text.includes('à') ||
                                text.match(/\d{1,2}\s+\w+\s+\d{4}/) ||
                                text.match(/\d{1,2}\/\d{1,2}\/\d{4}/) ||
                                text.match(/\d{4}-\d{2}-\d{2}/) ||
                                /(aujourd'hui|demain|today|tomorrow)/i.test(text) // Formats relatifs
                            )) {
                                dateText = text;
                                console.log('📅 [FOMO Bookmarklet] Date trouvée via attribut:', text);
                                break;
                            }
                        }
                        if (dateText) break;
                    }
                }

                // Stratégie 3: Chercher dans tous les spans avec dir="auto" qui contiennent des dates
                if (!dateText) {
                    console.log('📅 [FOMO Bookmarklet] Stratégie 3: Recherche dans tous les spans dir="auto"...');
                    const spans = document.querySelectorAll('span[dir="auto"]');
                    console.log('📅 [FOMO Bookmarklet] Nombre de spans dir="auto" trouvés:', spans.length);
                    for (const span of spans) {
                        const text = span.textContent.trim();
                        if (text && (
                            text.includes('à') ||
                            text.match(/\d{1,2}\s+\w+\s+\d{4}/) ||
                            text.match(/\d{1,2}\/\d{1,2}\/\d{4}/) ||
                            /(aujourd'hui|demain|today|tomorrow)/i.test(text) // Formats relatifs
                        )) {
                            dateText = text;
                            console.log('📅 [FOMO Bookmarklet] Date trouvée via span dir="auto":', text);
                            break;
                        }
                    }
                }

                // Parser la date
                if (dateText) {
                    try {
                        console.log('📅 [FOMO Bookmarklet] Texte de date à parser:', dateText);

                        // Format ISO: "2026-04-26T13:00:00"
                        let isoMatch = dateText.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2})/);
                        if (isoMatch) {
                            console.log('📅 [FOMO Bookmarklet] Format ISO détecté, match:', isoMatch[1]);
                            const parsedDate = new Date(isoMatch[1]);
                            if (!isNaN(parsedDate.getTime())) {
                                data.start = parsedDate.toISOString();
                                console.log('✅ [FOMO Bookmarklet] Date ISO parsée avec succès:', data.start);
                            } else {
                                console.warn('⚠️ [FOMO Bookmarklet] Date ISO invalide après parsing:', isoMatch[1]);
                            }
                        } else if (/(aujourd'hui|today)/i.test(dateText) || /(demain|tomorrow)/i.test(dateText)) {
                            // Formats relatifs: "Aujourd'hui à 06:00", "Demain à 22:00", "Aujourd'hui de 6:00 à 16:00"
                            console.log('📅 [FOMO Bookmarklet] Format relatif détecté (Aujourd\'hui/Demain)');

                            const now = new Date();
                            let targetDate = new Date(now);

                            // Déterminer si c'est "Demain" ou "Aujourd'hui"
                            if (/(demain|tomorrow)/i.test(dateText)) {
                                targetDate.setDate(targetDate.getDate() + 1);
                                console.log('📅 [FOMO Bookmarklet] Date relative: Demain');
                            } else {
                                console.log('📅 [FOMO Bookmarklet] Date relative: Aujourd\'hui');
                            }

                            // Chercher d'abord le format avec plage: "de 6:00 à 16:00"
                            const rangeMatch = dateText.match(/de\s+(\d{1,2}):(\d{2})\s+à\s+(\d{1,2}):(\d{2})/i);
                            if (rangeMatch) {
                                const [, startHour, startMinute, endHour, endMinute] = rangeMatch;
                                targetDate.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
                                data.start = targetDate.toISOString();
                                console.log('✅ [FOMO Bookmarklet] Date relative parsée (début avec plage):', data.start);

                                const endDate = new Date(targetDate);
                                endDate.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
                                data.end = endDate.toISOString();
                                console.log('✅ [FOMO Bookmarklet] Date relative parsée (fin avec plage):', data.end);
                            } else {
                                // Format simple: "à 06:00" ou "à 6:00"
                                const timeMatch = dateText.match(/à\s+(\d{1,2}):(\d{2})/i);
                                if (timeMatch) {
                                    const [, hour, minute] = timeMatch;
                                    targetDate.setHours(parseInt(hour), parseInt(minute), 0, 0);
                                    data.start = targetDate.toISOString();
                                    console.log('✅ [FOMO Bookmarklet] Date relative parsée (début simple):', data.start);
                                } else {
                                    console.warn('⚠️ [FOMO Bookmarklet] Format relatif détecté mais heure non trouvée');
                                }
                            }
                        } else {
                            console.log('📅 [FOMO Bookmarklet] Format ISO non détecté, tentative parsing format français...');
                            const monthMap = {
                                'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
                                'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11,
                                'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
                                'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
                            };

                            // Format français avec début et fin: "Dimanche 26 avril 2026 de 13:00 à 19:00"
                            // Regex plus flexible pour gérer les variations
                            let dateMatchWithRange = dateText.match(/(\d{1,2})\s+(\w+)\s+(\d{4})\s+de\s+(\d{1,2}):(\d{2})\s+à\s+(\d{1,2}):(\d{2})/i);

                            if (!dateMatchWithRange) {
                                // Essayer sans le "de" explicite
                                dateMatchWithRange = dateText.match(/(\d{1,2})\s+(\w+)\s+(\d{4}).*?(\d{1,2}):(\d{2})\s+à\s+(\d{1,2}):(\d{2})/i);
                            }

                            if (dateMatchWithRange) {
                                // Format avec début et fin explicites
                                const [, day, monthName, year, startHour, startMinute, endHour, endMinute] = dateMatchWithRange;
                                console.log('📅 [FOMO Bookmarklet] Match avec range trouvé:', { day, monthName, year, startHour, startMinute, endHour, endMinute });

                                const month = monthMap[monthName.toLowerCase()];
                                console.log('📅 [FOMO Bookmarklet] Mois recherché:', monthName.toLowerCase(), '→ Index:', month);
                                if (month !== undefined) {
                                    const startDate = new Date(parseInt(year), month, parseInt(day), parseInt(startHour), parseInt(startMinute));
                                    const endDate = new Date(parseInt(year), month, parseInt(day), parseInt(endHour), parseInt(endMinute));
                                    console.log('📅 [FOMO Bookmarklet] Dates créées - Début:', startDate, 'Fin:', endDate);

                                    // Vérifier que les dates sont valides
                                    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                                        data.start = startDate.toISOString();
                                        data.end = endDate.toISOString();
                                        console.log('✅ [FOMO Bookmarklet] Date de début extraite:', data.start);
                                        console.log('✅ [FOMO Bookmarklet] Date de fin extraite:', data.end);
                                    } else {
                                        console.warn('⚠️ [FOMO Bookmarklet] Dates invalides après parsing - Début valide:', !isNaN(startDate.getTime()), 'Fin valide:', !isNaN(endDate.getTime()));
                                    }
                                } else {
                                    console.warn('⚠️ [FOMO Bookmarklet] Mois non reconnu:', monthName, '(mois disponibles:', Object.keys(monthMap).join(', '), ')');
                                }
                            } else {
                                console.log('📅 [FOMO Bookmarklet] Format avec range non détecté, tentative format simple...');
                                // Format français simple: "samedi 26 avril 2026 à 13:00"
                                let dateMatch = dateText.match(/(\d{1,2})\s+(\w+)\s+(\d{4}).*?(\d{1,2}):(\d{2})/);

                                // Format alternatif: "26/04/2026 13:00"
                                if (!dateMatch) {
                                    console.log('📅 [FOMO Bookmarklet] Tentative format numérique (DD/MM/YYYY)...');
                                    dateMatch = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}).*?(\d{1,2}):(\d{2})/);
                                    if (dateMatch) {
                                        const [, day, month, year, hour, minute] = dateMatch;
                                        console.log('📅 [FOMO Bookmarklet] Match format numérique trouvé:', { day, month, year, hour, minute });
                                        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
                                        console.log('📅 [FOMO Bookmarklet] Date créée:', date);
                                        if (!isNaN(date.getTime())) {
                                            data.start = date.toISOString();
                                            console.log('✅ [FOMO Bookmarklet] Date simple extraite (format numérique):', data.start);
                                        } else {
                                            console.warn('⚠️ [FOMO Bookmarklet] Date invalide après parsing format numérique');
                                        }
                                    } else {
                                        console.log('📅 [FOMO Bookmarklet] Format numérique non détecté');
                                    }
                                } else {
                                    const [, day, monthName, year, hour, minute] = dateMatch;
                                    console.log('📅 [FOMO Bookmarklet] Match format français simple trouvé:', { day, monthName, year, hour, minute });
                                    const month = monthMap[monthName.toLowerCase()];
                                    console.log('📅 [FOMO Bookmarklet] Mois recherché:', monthName.toLowerCase(), '→ Index:', month);
                                    if (month !== undefined) {
                                        const date = new Date(parseInt(year), month, parseInt(day), parseInt(hour), parseInt(minute));
                                        console.log('📅 [FOMO Bookmarklet] Date créée:', date);
                                        if (!isNaN(date.getTime())) {
                                            data.start = date.toISOString();
                                            console.log('✅ [FOMO Bookmarklet] Date simple extraite (format français):', data.start);
                                        } else {
                                            console.warn('⚠️ [FOMO Bookmarklet] Date invalide après parsing format français');
                                        }
                                    } else {
                                        console.warn('⚠️ [FOMO Bookmarklet] Mois non reconnu dans format simple:', monthName);
                                    }
                                }
                            }
                        }

                        // Chercher la durée pour calculer la date de fin si pas déjà définie
                        if (data.start && !data.end) {
                            console.log('📅 [FOMO Bookmarklet] Date début trouvée mais pas de fin, recherche durée...');
                            const durationMatch = dateText.match(/(\d+)\s*(heure|hour|h|minute|min)/i);
                            if (durationMatch) {
                                const duration = parseInt(durationMatch[1]);
                                const unit = durationMatch[2].toLowerCase();
                                console.log('📅 [FOMO Bookmarklet] Durée trouvée:', duration, unit);
                                const startDate = new Date(data.start);
                                if (unit.includes('heure') || unit.includes('hour') || unit === 'h') {
                                    startDate.setHours(startDate.getHours() + duration);
                                    console.log('📅 [FOMO Bookmarklet] Ajout de', duration, 'heures à la date de début');
                                } else if (unit.includes('minute') || unit.includes('min')) {
                                    startDate.setMinutes(startDate.getMinutes() + duration);
                                    console.log('📅 [FOMO Bookmarklet] Ajout de', duration, 'minutes à la date de début');
                                }
                                if (!isNaN(startDate.getTime())) {
                                    data.end = startDate.toISOString();
                                    console.log('✅ [FOMO Bookmarklet] Date de fin calculée depuis durée:', data.end);
                                } else {
                                    console.warn('⚠️ [FOMO Bookmarklet] Date de fin invalide après calcul depuis durée');
                                }
                            } else {
                                console.log('📅 [FOMO Bookmarklet] Aucune durée trouvée dans le texte');
                            }
                        }
                    } catch (e) {
                        console.error('❌ [FOMO Bookmarklet] Erreur parsing date:', e, dateText);
                        console.error('❌ [FOMO Bookmarklet] Stack trace:', e.stack);
                    }
                } else {
                    console.warn('⚠️ [FOMO Bookmarklet] Aucun texte de date trouvé pour parsing');
                }
            }

            // Résumé final des dates extraites (après toutes les stratégies)
            console.log('📅 [FOMO Bookmarklet] === RÉSUMÉ EXTRACTION DATES ===');
            console.log('📅 [FOMO Bookmarklet] Date début:', data.start || 'NON TROUVÉE');
            console.log('📅 [FOMO Bookmarklet] Date fin:', data.end || 'NON TROUVÉE');
            console.log('📅 [FOMO Bookmarklet] === FIN EXTRACTION DATES ===');

            // ===== ADRESSE =====
            console.log('📍 [FOMO Bookmarklet] === DÉBUT EXTRACTION ADRESSE ===');

            // Trouver la zone spécifique de l'événement actuel pour éviter de prendre l'adresse d'un autre événement
            // Utiliser le titre comme point d'ancrage
            let eventContainer = null;
            const titleElement = document.querySelector('h1[data-testid="event-permalink-event-name"]') ||
                mainContent.querySelector('h1');
            if (titleElement) {
                // Remonter dans le DOM pour trouver un conteneur parent commun
                let parent = titleElement.parentElement;
                let depth = 0;
                while (parent && depth < 10) {
                    // Chercher un conteneur qui a plusieurs sections de l'événement
                    const hasDescription = parent.querySelector('span[dir="auto"][class*="xdmh292"][class*="x15dsfln"][class*="x140p0ai"]');
                    const hasDate = parent.querySelector('span[dir="auto"][class*="xdmh292"][class*="x15dsfln"][class*="x1yc453h"]');
                    if (hasDescription || hasDate) {
                        eventContainer = parent;
                        console.log('📍 [FOMO Bookmarklet] Conteneur événement trouvé');
                        break;
                    }
                    parent = parent.parentElement;
                    depth++;
                }
            }
            // Utiliser uniquement le conteneur événement pour éviter de prendre l'adresse d'un autre événement
            // Si le conteneur n'est pas trouvé, on ne cherchera pas (évite les faux positifs)
            const searchContainer = eventContainer;
            if (!searchContainer) {
                console.warn('📍 [FOMO Bookmarklet] ⚠️ Conteneur événement non trouvé - recherche d\'adresse désactivée pour éviter les faux positifs');
            } else {
                console.log('📍 [FOMO Bookmarklet] Zone de recherche: conteneur événement');
            }

            // Recherche du NOM DU LIEU (venue name) - basée sur l'icône SVG de localisation (fallback si structure conteneur n'a pas fonctionné)
            const venueSearchContainer = searchContainer || mainContent;

            // Stratégie 0: Via aria-label "Informations de localisation pour cet évènement" (prioritaire)
            if (!data.venue_name || !data.address) {
                console.log('📍 [FOMO Bookmarklet] Stratégie 0: Recherche via aria-label de localisation...');

                // Chercher le div avec l'aria-label spécifique
                const locationDiv = venueSearchContainer.querySelector('div[aria-label*="Informations de localisation"], div[aria-label*="localisation"]');

                if (locationDiv) {
                    console.log('✅ [FOMO Bookmarklet] Div de localisation trouvé via aria-label');

                    // Chercher le lien à l'intérieur de ce div
                    const venueLink = locationDiv.querySelector('a[role="link"]');

                    if (venueLink) {
                        console.log('✅ [FOMO Bookmarklet] Lien trouvé dans le div de localisation');

                        // Chercher les spans à l'intérieur du lien
                        // Structure: premier span avec le nom, deuxième span avec l'adresse
                        const spans = venueLink.querySelectorAll('span[dir="auto"]');
                        const texts = [];

                        for (const span of spans) {
                            const text = span.textContent.trim();
                            // Filtrer les textes trop courts ou trop longs, et éviter les doublons
                            if (text && text.length > 2 && text.length < 200 && !texts.includes(text)) {
                                texts.push(text);
                            }
                        }

                        // Chercher aussi dans les divs qui contiennent les spans (structure imbriquée)
                        const divs = venueLink.querySelectorAll('div.xu06os2.x1ok221b');
                        if (divs.length >= 2) {
                            // Premier div = nom, deuxième div = adresse
                            const nameDiv = divs[0];
                            const addressDiv = divs[1];

                            const nameText = nameDiv.textContent.trim();
                            const addressText = addressDiv.textContent.trim();

                            if (nameText && nameText.length > 2 && nameText.length < 200 &&
                                addressText && addressText.length > 5 && addressText.length < 200) {

                                // Vérifier que ce n'est pas le titre de l'événement
                                const isTitle = data.title && (
                                    nameText.toLowerCase() === data.title.toLowerCase() ||
                                    nameText.toLowerCase().includes(data.title.toLowerCase()) ||
                                    data.title.toLowerCase().includes(nameText.toLowerCase())
                                );

                                if (!isTitle) {
                                    // Vérifier que l'adresse ressemble à une adresse
                                    const looksLikeAddress = addressText.includes(',') ||
                                        /(rue|avenue|boulevard|place|chemin|route|allée|impasse|street|road|way|drive|france|belgium|belgique)/i.test(addressText);

                                    if (looksLikeAddress) {
                                        if (!data.venue_name) {
                                            data.venue_name = nameText;
                                            console.log('✅ [FOMO Bookmarklet] Nom du lieu trouvé via lien (divs):', nameText);
                                        }
                                        if (!data.address) {
                                            data.address = addressText;
                                            console.log('✅ [FOMO Bookmarklet] Adresse trouvée via lien (divs):', addressText);
                                        }
                                        // Données trouvées, on peut arrêter la recherche
                                    }
                                }
                            }
                        }

                        // Fallback: utiliser les spans si les divs n'ont pas fonctionné
                        if ((!data.venue_name || !data.address) && texts.length >= 2) {
                            const potentialName = texts[0];
                            const potentialAddress = texts[1];

                            // Vérifier que ce n'est pas le titre de l'événement
                            const isTitle = data.title && (
                                potentialName.toLowerCase() === data.title.toLowerCase() ||
                                potentialName.toLowerCase().includes(data.title.toLowerCase()) ||
                                data.title.toLowerCase().includes(potentialName.toLowerCase())
                            );

                            if (!isTitle) {
                                // Vérifier que l'adresse ressemble à une adresse
                                const looksLikeAddress = potentialAddress.includes(',') ||
                                    /(rue|avenue|boulevard|place|chemin|route|allée|impasse|street|road|way|drive|france|belgium|belgique)/i.test(potentialAddress);

                                if (looksLikeAddress) {
                                    if (!data.venue_name) {
                                        data.venue_name = potentialName;
                                        console.log('✅ [FOMO Bookmarklet] Nom du lieu trouvé via lien (spans):', potentialName);
                                    }
                                    if (!data.address) {
                                        data.address = potentialAddress;
                                        console.log('✅ [FOMO Bookmarklet] Adresse trouvée via lien (spans):', potentialAddress);
                                    }
                                }
                            }
                        } else if (texts.length === 1 && !data.address) {
                            // Si un seul texte, vérifier si c'est une adresse
                            const text = texts[0];
                            const looksLikeAddress = text.includes(',') ||
                                /(rue|avenue|boulevard|place|chemin|route|allée|impasse|street|road|way|drive|france|belgium|belgique)/i.test(text);

                            if (looksLikeAddress) {
                                data.address = text;
                                console.log('✅ [FOMO Bookmarklet] Adresse trouvée via lien (texte unique):', text);
                            }
                        }
                    } else {
                        console.log('⚠️ [FOMO Bookmarklet] Lien non trouvé dans le div de localisation');
                    }
                } else {
                    console.log('⚠️ [FOMO Bookmarklet] Div de localisation non trouvé via aria-label, fallback sur recherche de liens...');

                    // Fallback: chercher les liens avec les classes spécifiques (ancienne méthode)
                    const venueLinks = venueSearchContainer.querySelectorAll('a[role="link"]');
                    console.log('📍 [FOMO Bookmarklet] Nombre de liens trouvés (fallback):', venueLinks.length);

                    for (const link of venueLinks) {
                        // Vérifier si le lien contient les classes spécifiques (au moins quelques-unes)
                        const linkClasses = link.className;
                        if (!linkClasses.includes('x1i10hfl') || !linkClasses.includes('x1qjc9v5')) {
                            continue;
                        }

                        // Chercher les spans à l'intérieur du lien
                        const spans = link.querySelectorAll('span[dir="auto"]');
                        const texts = [];

                        for (const span of spans) {
                            const text = span.textContent.trim();
                            if (text && text.length > 2 && text.length < 200 && !texts.includes(text)) {
                                texts.push(text);
                            }
                        }

                        // Chercher aussi dans les divs qui contiennent les spans (structure imbriquée)
                        const divs = link.querySelectorAll('div.xu06os2.x1ok221b');
                        if (divs.length >= 2) {
                            // Premier div = nom, deuxième div = adresse
                            const nameDiv = divs[0];
                            const addressDiv = divs[1];

                            const nameText = nameDiv.textContent.trim();
                            const addressText = addressDiv.textContent.trim();

                            if (nameText && nameText.length > 2 && nameText.length < 200 &&
                                addressText && addressText.length > 5 && addressText.length < 200) {

                                // Vérifier que ce n'est pas le titre de l'événement
                                const isTitle = data.title && (
                                    nameText.toLowerCase() === data.title.toLowerCase() ||
                                    nameText.toLowerCase().includes(data.title.toLowerCase()) ||
                                    data.title.toLowerCase().includes(nameText.toLowerCase())
                                );

                                if (!isTitle) {
                                    // Vérifier que l'adresse ressemble à une adresse
                                    const looksLikeAddress = addressText.includes(',') ||
                                        /(rue|avenue|boulevard|place|chemin|route|allée|impasse|street|road|way|drive|france|belgium|belgique)/i.test(addressText);

                                    if (looksLikeAddress) {
                                        if (!data.venue_name) {
                                            data.venue_name = nameText;
                                            console.log('✅ [FOMO Bookmarklet] Nom du lieu trouvé via lien (fallback divs):', nameText);
                                        }
                                        if (!data.address) {
                                            data.address = addressText;
                                            console.log('✅ [FOMO Bookmarklet] Adresse trouvée via lien (fallback divs):', addressText);
                                        }
                                        break;
                                    }
                                }
                            }
                        }

                        // Fallback: utiliser les spans si les divs n'ont pas fonctionné
                        if ((!data.venue_name || !data.address) && texts.length >= 2) {
                            const potentialName = texts[0];
                            const potentialAddress = texts[1];

                            // Vérifier que ce n'est pas le titre de l'événement
                            const isTitle = data.title && (
                                potentialName.toLowerCase() === data.title.toLowerCase() ||
                                potentialName.toLowerCase().includes(data.title.toLowerCase()) ||
                                data.title.toLowerCase().includes(potentialName.toLowerCase())
                            );

                            if (!isTitle) {
                                // Vérifier que l'adresse ressemble à une adresse
                                const looksLikeAddress = potentialAddress.includes(',') ||
                                    /(rue|avenue|boulevard|place|chemin|route|allée|impasse|street|road|way|drive|france|belgium|belgique)/i.test(potentialAddress);

                                if (looksLikeAddress) {
                                    if (!data.venue_name) {
                                        data.venue_name = potentialName;
                                        console.log('✅ [FOMO Bookmarklet] Nom du lieu trouvé via lien (fallback spans):', potentialName);
                                    }
                                    if (!data.address) {
                                        data.address = potentialAddress;
                                        console.log('✅ [FOMO Bookmarklet] Adresse trouvée via lien (fallback spans):', potentialAddress);
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // Stratégie basée sur l'icône SVG de localisation (robuste, ne dépend pas des classes CSS)
            // 1. Trouver le SVG avec le path de localisation
            // 2. Remonter au conteneur parent qui contient le texte
            // 3. Extraire le texte (peut être dans span, div, lien, etc.)
            // 4. Si c'est une adresse complète, extraire la ville
            // 5. Si c'est un nom simple, l'utiliser tel quel
            if (!data.venue_name && venueSearchContainer) {
                console.log('📍 [FOMO Bookmarklet] Stratégie SVG: Recherche via icône de localisation...');

                // Path spécifique de l'icône de localisation Facebook
                const locationIconPath = 'M10 .5A7.5 7.5 0 0 0 2.5 8c0 2.257 1.214 4.62 2.545 6.558 1.35 1.963 2.91 3.616 3.773 4.475a1.667 1.667 0 0 0 2.363 0c.863-.86 2.423-2.512 3.773-4.475C16.285 12.62 17.5 10.258 17.5 8A7.5 7.5 0 0 0 10 .5zm0 4.25a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5z';

                // Chercher tous les SVG avec des paths
                const allSvgs = venueSearchContainer.querySelectorAll('svg');
                console.log('📍 [FOMO Bookmarklet] Nombre de SVG trouvés:', allSvgs.length);

                for (const svg of allSvgs) {
                    // Chercher le path de localisation dans ce SVG
                    const paths = svg.querySelectorAll('path');
                    let isLocationIcon = false;

                    for (const path of paths) {
                        const pathD = path.getAttribute('d');
                        if (pathD && pathD.includes('M10 .5A7.5 7.5 0 0 0 2.5 8')) {
                            // C'est l'icône de localisation
                            isLocationIcon = true;
                            console.log('📍 [FOMO Bookmarklet] Icône de localisation trouvée');
                            break;
                        }
                    }

                    if (isLocationIcon) {
                        // Remonter au conteneur parent qui contient à la fois le SVG et le texte
                        // Le conteneur est généralement 2-3 niveaux au-dessus
                        let container = svg.parentElement;
                        let levelsUp = 0;
                        const maxLevels = 5; // Limiter la recherche à 5 niveaux

                        while (container && levelsUp < maxLevels) {
                            // Chercher le texte dans ce conteneur (peut être dans span, div, a, etc.)
                            const textElements = container.querySelectorAll('span, div[role="button"], a, p');

                            for (const textEl of textElements) {
                                const text = textEl.textContent.trim();

                                if (!text || text.length < 2 || text.length > 200) continue;

                                // Exclure le titre de l'événement
                                const isTitle = data.title && (
                                    text.toLowerCase() === data.title.toLowerCase() ||
                                    text.toLowerCase().includes(data.title.toLowerCase()) ||
                                    data.title.toLowerCase().includes(text.toLowerCase())
                                );

                                if (isTitle) continue;

                                // Si c'est une adresse complète (avec virgules), extraire la ville
                                if (text.includes(',')) {
                                    const parts = text.split(',').map(p => p.trim());
                                    // La ville est généralement l'avant-dernière partie (avant le pays)
                                    if (parts.length >= 2) {
                                        // Prendre l'avant-dernière partie (généralement la ville)
                                        const cityIndex = parts.length - 2;
                                        const city = parts[cityIndex];

                                        if (city && city.length >= 2 && city.length < 100) {
                                            data.venue_name = city;
                                            console.log('✅ [FOMO Bookmarklet] Nom du lieu extrait de l\'adresse (ville):', city);
                                            console.log('📍 [FOMO Bookmarklet] Adresse complète trouvée:', text);
                                            // Stocker aussi l'adresse complète si pas encore trouvée
                                            if (!data.address) {
                                                data.address = text;
                                            }
                                            break;
                                        }
                                    }
                                } else {
                                    // C'est un nom simple (sans virgule)
                                    data.venue_name = text;
                                    console.log('✅ [FOMO Bookmarklet] Nom du lieu trouvé (nom simple):', text);
                                    break;
                                }
                            }

                            if (data.venue_name) break;

                            // Remonter d'un niveau
                            container = container.parentElement;
                            levelsUp++;
                        }

                        if (data.venue_name) break;
                    }
                }
            }

            console.log('📍 [FOMO Bookmarklet] Nom du lieu final:', data.venue_name || 'NON TROUVÉ');

            console.log('📍 [FOMO Bookmarklet] === FIN EXTRACTION ADRESSE ===');
            console.log('📍 [FOMO Bookmarklet] Adresse finale:', data.address || 'NON TROUVÉE');

            // ===== ORGANISATEUR/HÔTE =====
            console.log('👤 [FOMO Bookmarklet] === DÉBUT EXTRACTION ORGANISATEUR ===');

            // Stratégie principale: Chercher le texte "Évènement de" / "Event by" et extraire les liens
            // Format: <span>Évènement de <a>Nom de l'organisateur</a></span>
            // Cette stratégie est robuste car elle se base sur le texte sémantique, pas sur les classes CSS
            const allSpans = mainContent.querySelectorAll('span');
            for (const span of allSpans) {
                const text = span.textContent.trim();
                // Chercher le pattern "Évènement de" ou "Event by" (insensible à la casse)
                if (text && (text.toLowerCase().includes('évènement de') ||
                    text.toLowerCase().includes('event by') ||
                    text.toLowerCase().includes('événement de'))) {
                    // Extraire tous les liens dans ce span
                    const links = span.querySelectorAll('a');
                    const organizers = [];
                    for (const link of links) {
                        const linkText = link.textContent.trim();
                        // Prendre le texte du lien s'il n'est pas vide
                        if (linkText && linkText.length > 0) {
                            organizers.push(linkText);
                        }
                    }
                    if (organizers.length > 0) {
                        // Combiner les organisateurs avec " et "
                        data.host = organizers.join(' et ');
                        console.log('👤 [FOMO Bookmarklet] ✅ Organisateur(s) trouvé(s):', data.host);
                        break;
                    }
                }
            }

            console.log('👤 [FOMO Bookmarklet] === FIN EXTRACTION ORGANISATEUR ===');
            console.log('👤 [FOMO Bookmarklet] Organisateur final:', data.host || 'NON TROUVÉ');

            // ===== IMAGE DE COUVERTURE (BANNER) =====
            // Chercher l'image de couverture principale (banner en haut de page)
            const coverSelectors = [
                'img[data-imgperflogname="profileCoverPhoto"]', // Sélecteur spécifique Facebook pour cover photo
                'img[data-testid="event-cover-photo"]',
                'img[alt*="cover"]',
                'img[alt*="Cover"]',
                'img[alt*="event cover"]'
            ];

            for (const selector of coverSelectors) {
                const el = document.querySelector(selector);
                if (el && el.src && !el.src.includes('data:image')) {
                    // Pour profileCoverPhoto, on prend directement l'URL (c'est le banner)
                    if (el.getAttribute('data-imgperflogname') === 'profileCoverPhoto') {
                        data.cover = el.src;
                        console.log('🖼️ [FOMO Bookmarklet] Image de couverture trouvée via profileCoverPhoto:', el.src.substring(0, 100));
                        break;
                    }
                    // Pour les autres sélecteurs, vérifier que c'est une grande image (banner)
                    if (el.offsetWidth > 400 || el.naturalWidth > 400) {
                        data.cover = el.src;
                        break;
                    }
                }
            }

            // Fallback: chercher la plus grande image en haut de la page (banner)
            if (!data.cover) {
                const images = mainContent.querySelectorAll('img');
                let bestImage = null;
                let bestScore = 0;

                // Parcourir les images et calculer un score basé sur:
                // - Taille (largeur x hauteur)
                // - Position (plus haut = mieux)
                // - URL (scontent = images Facebook)
                // - Exclusion des avatars/profils
                for (const img of images) {
                    if (img.src &&
                        !img.src.includes('data:image') &&
                        !img.src.includes('profile') &&
                        !img.src.includes('avatar') &&
                        !img.src.includes('icon') &&
                        !(img.alt && img.alt.toLowerCase().includes('profile'))) {

                        const rect = img.getBoundingClientRect();
                        const width = img.offsetWidth || img.naturalWidth || rect.width;
                        const height = img.offsetHeight || img.naturalHeight || rect.height;
                        const size = width * height;

                        // Score basé sur:
                        // - Taille (plus grand = mieux)
                        // - Position Y (plus haut = mieux, max 1000px depuis le haut)
                        // - URL scontent (priorité aux images Facebook)
                        const yPosition = rect.top;
                        const yScore = yPosition < 1000 ? (1000 - yPosition) / 10 : 0;
                        const sizeScore = size / 100;
                        const urlScore = img.src.includes('scontent') ? 100 : 0;
                        const score = sizeScore + yScore + urlScore;

                        // Filtrer les images trop petites ou trop bas
                        if (size > 50000 && yPosition < 2000 && score > bestScore) {
                            bestScore = score;
                            bestImage = img;
                        }
                    }
                }

                if (bestImage) {
                    // Essayer de récupérer l'URL haute résolution
                    let coverUrl = bestImage.src;
                    // Si c'est une image Facebook, essayer de récupérer la version haute résolution
                    if (coverUrl.includes('scontent') && coverUrl.includes('&')) {
                        // Enlever les paramètres de taille pour obtenir la version originale
                        coverUrl = coverUrl.split('&')[0] + '&ext=';
                    }
                    data.cover = coverUrl;
                }
            }

            // ===== COMPTEURS (PARTICIPANTS ET INTÉRESSÉS) =====
            /**
             * Extrait un texte de compteur (nombre ou format abrégé comme "1K", "2K", "1,9K")
             * @param {string} text - Texte à extraire (ex: "1K", "166", "1.5K", "1,9K")
             * @returns {string|null} - Texte du compteur ou null si invalide
             */
            function extractCountText(text) {
                if (!text) return null;

                // Nettoyer le texte (supprimer espaces insécables, espaces, etc.)
                let cleanText = text.replace(/\u00A0/g, ' ').trim().replace(/\s+/g, ' ');

                // Format simple: nombre entier (ex: "166", "999")
                if (/^\d+$/.test(cleanText)) {
                    return cleanText;
                }

                // Format abrégé avec K - gérer les virgules (format européen) et les points (format anglo-saxon)
                // Ex: "1K", "2K", "1.5K", "1,9K", "6,2K"
                const kMatch = cleanText.match(/^(\d+)[,.]?(\d+)?\s*K$/i);
                if (kMatch) {
                    const [, wholePart, decimalPart] = kMatch;
                    // Normaliser: convertir la virgule en point pour la cohérence, puis reconstruire
                    if (decimalPart) {
                        return `${wholePart}.${decimalPart}K`.toUpperCase();
                    } else {
                        return `${wholePart}K`.toUpperCase();
                    }
                }

                // Format abrégé avec M - gérer les virgules et les points
                // Ex: "1M", "2.5M", "1,2M"
                const mMatch = cleanText.match(/^(\d+)[,.]?(\d+)?\s*M$/i);
                if (mMatch) {
                    const [, wholePart, decimalPart] = mMatch;
                    if (decimalPart) {
                        return `${wholePart}.${decimalPart}M`.toUpperCase();
                    } else {
                        return `${wholePart}M`.toUpperCase();
                    }
                }

                return null;
            }

            // Stratégie 1: Chercher les spans avec classes spécifiques qui contiennent un nombre
            // Chercher les spans avec dir="auto" et classes communes (xdmh292, x15dsfln, etc.)
            const countSpans = mainContent.querySelectorAll('span[dir="auto"][class*="xdmh292"], span[dir="auto"][class*="x15dsfln"]');
            for (const span of countSpans) {
                let text = span.textContent.trim();
                let countText = extractCountText(text);

                // Si le span ne contient qu'un nombre ou qu'un "K", essayer de combiner avec le parent
                // (Facebook peut séparer "1" et "K" dans des spans différents)
                if (countText === null && span.parentElement) {
                    const parentText = span.parentElement.textContent.trim();
                    // Essayer d'extraire le texte du parent (qui peut contenir "1 K" si séparé)
                    countText = extractCountText(parentText);
                    if (countText !== null) {
                        text = parentText; // Utiliser le texte du parent pour le contexte
                    }
                }

                if (countText !== null) {
                    // Chercher le contexte autour (parent, siblings, previous/next siblings, grand-parent)
                    const parent = span.parentElement;
                    const grandParent = parent ? parent.parentElement : null;

                    // Collecter tous les textes du contexte
                    let contextTexts = [];

                    // Texte du parent
                    if (parent) {
                        contextTexts.push(parent.textContent.trim().toLowerCase());
                    }

                    // Texte du grand-parent
                    if (grandParent) {
                        contextTexts.push(grandParent.textContent.trim().toLowerCase());
                    }

                    // Texte des siblings précédents/suivants
                    if (parent) {
                        const prevSibling = span.previousElementSibling;
                        const nextSibling = span.nextElementSibling;
                        if (prevSibling) contextTexts.push(prevSibling.textContent.trim().toLowerCase());
                        if (nextSibling) contextTexts.push(nextSibling.textContent.trim().toLowerCase());
                    }

                    // Texte des siblings du parent
                    if (parent) {
                        const parentSiblings = Array.from(parent.parentElement ? parent.parentElement.children : []);
                        parentSiblings.forEach(sib => {
                            if (sib !== parent) {
                                contextTexts.push(sib.textContent.trim().toLowerCase());
                            }
                        });
                    }

                    const context = contextTexts.join(' ');

                    // Vérifier si le contexte indique "participants", "going", etc.
                    if (context.includes('participant') || context.includes('going') || context.includes('vont') ||
                        context.includes('participer') || context.includes('personne') || context.includes('va')) {
                        if (!data.attending_count) {
                            data.attending_count = countText;
                            console.log('👥 [FOMO Bookmarklet] Participants trouvés via span:', countText);
                        }
                    }
                    // Vérifier si le contexte indique "intéressés", "interested", etc.
                    if (context.includes('intéressé') || context.includes('interested') || context.includes('s\'intéresse')) {
                        if (!data.interested_count) {
                            data.interested_count = countText;
                            console.log('👀 [FOMO Bookmarklet] Intéressés trouvés via span:', countText);
                        }
                    }
                }
            }

            // Stratégie 2: Chercher dans les boutons et textes spécifiques
            const allBodyText = document.body.textContent || '';

            // Participants/Going
            // Patterns mis à jour pour gérer les formats abrégés (1K, 2K, 1,9K, 6,2K, etc.)
            const attendingPatterns = [
                /(\d+(?:[.,]\d+)?\s*[KM]?)\s*(personnes|people|participants|going|participent|vont|participeront)/i,
                /(\d+(?:[.,]\d+)?\s*[KM]?)\s*(personne|person|participant|va|participera)/i,
                /going[:\s]+(\d+(?:[.,]\d+)?\s*[KM]?)/i,
                /participants[:\s]+(\d+(?:[.,]\d+)?\s*[KM]?)/i
            ];

            for (const pattern of attendingPatterns) {
                const match = allBodyText.match(pattern);
                if (match) {
                    const countText = extractCountText(match[1].trim());
                    if (countText !== null && !data.attending_count) {
                        data.attending_count = countText;
                    }
                    break;
                }
            }

            // Intéressés/Interested
            // Patterns mis à jour pour gérer les formats abrégés (1K, 2K, 1,9K, 6,2K, etc.)
            const interestedPatterns = [
                /(\d+(?:[.,]\d+)?\s*[KM]?)\s*(intéressés|interested|intéressées|s'intéressent)/i,
                /(\d+(?:[.,]\d+)?\s*[KM]?)\s*(intéressé|interested)/i,
                /interested[:\s]+(\d+(?:[.,]\d+)?\s*[KM]?)/i,
                /intéressés[:\s]+(\d+(?:[.,]\d+)?\s*[KM]?)/i
            ];

            for (const pattern of interestedPatterns) {
                const match = allBodyText.match(pattern);
                if (match) {
                    const countText = extractCountText(match[1].trim());
                    if (countText !== null && !data.interested_count) {
                        data.interested_count = countText;
                    }
                    break;
                }
            }

            // Stratégie 3: Chercher dans les boutons spécifiques
            const buttons = document.querySelectorAll('button, [role="button"]');
            for (const button of buttons) {
                const text = button.textContent.trim();
                // Pattern: "X going" ou "X interested" - mis à jour pour gérer les formats abrégés (1,9K, 6,2K, etc.)
                const goingMatch = text.match(/(\d+(?:[.,]\d+)?\s*[KM]?)\s*(going|participants|vont)/i);
                if (goingMatch) {
                    const countText = extractCountText(goingMatch[1].trim());
                    if (countText !== null && !data.attending_count) {
                        data.attending_count = countText;
                    }
                }
                const interestedMatch = text.match(/(\d+(?:[.,]\d+)?\s*[KM]?)\s*(interested|intéressés)/i);
                if (interestedMatch) {
                    const countText = extractCountText(interestedMatch[1].trim());
                    if (countText !== null && !data.interested_count) {
                        data.interested_count = countText;
                    }
                }
            }

        } catch (error) {
            console.error('Erreur extraction données:', error);
        }

        // Debug: Afficher les résultats dans la console
        console.log('🔍 [FOMO Bookmarklet] Données extraites:', data);
        console.log('🔍 [FOMO Bookmarklet] Champs remplis:', {
            title: !!data.title,
            description: !!data.description,
            start: !!data.start,
            end: !!data.end,
            venue_name: !!data.venue_name,
            address: !!data.address,
            host: !!data.host,
            cover: !!data.cover,
            attending_count: data.attending_count,
            interested_count: data.interested_count
        });

        return data;
    }

    /**
     * Créer et afficher l'interface de validation
     */
    function showValidationModal(eventData, onConfirm, onCancel) {
        // Créer la modal directement (sans overlay) - positionnée en haut à droite
        const modal = document.createElement('div');
        modal.id = 'fomo-bookmarklet-modal';
        modal.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 400px;
            max-height: calc(100vh - 40px);
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;

        // En-tête avec titre et bouton de fermeture
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            flex-shrink: 0;
            cursor: move;
            user-select: none;
        `;

        // Titre
        const title = document.createElement('h2');
        title.textContent = '📅 Ajouter l\'événement à FOMO';
        title.style.cssText = 'margin: 0; font-size: 18px; color: #333; flex: 1;';

        // Bouton de fermeture (X)
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 28px;
            color: #666;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            border-radius: 4px;
        `;
        closeBtn.onclick = () => {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
            window.__FOMO_BOOKMARKLET_ACTIVE = false;
            onCancel();
        };
        closeBtn.onmouseover = () => {
            closeBtn.style.background = '#f0f0f0';
        };
        closeBtn.onmouseout = () => {
            closeBtn.style.background = 'none';
        };

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Fonctionnalité de drag & drop pour déplacer le modal
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let modalStartX = 0;
        let modalStartY = 0;

        header.onmousedown = (e) => {
            // Ne pas activer le drag si on clique sur un bouton
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            const rect = modal.getBoundingClientRect();
            modalStartX = rect.left;
            modalStartY = rect.top;
            modal.style.transition = 'none';
            document.body.style.userSelect = 'none';
        };

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;
            let newX = modalStartX + deltaX;
            let newY = modalStartY + deltaY;

            // Limiter le déplacement dans la fenêtre
            const maxX = window.innerWidth - modal.offsetWidth;
            const maxY = window.innerHeight - modal.offsetHeight;
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            modal.style.left = newX + 'px';
            modal.style.top = newY + 'px';
            modal.style.right = 'auto';
            modal.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                modal.style.transition = '';
                document.body.style.userSelect = '';
            }
        });

        // Conteneur scrollable pour le contenu
        const scrollableContent = document.createElement('div');
        scrollableContent.style.cssText = `
            overflow-y: auto;
            overflow-x: hidden;
            flex: 1;
            padding-right: 8px;
        `;

        // Formulaire
        const form = document.createElement('form');
        form.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

        // Fonction helper pour créer un champ
        function createField(label, name, value, required = false, type = 'text') {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

            const labelEl = document.createElement('label');
            labelEl.textContent = label + (required ? ' *' : '');
            labelEl.style.cssText = 'font-weight: 600; color: #555; font-size: 14px;';

            let input;
            if (type === 'textarea') {
                input = document.createElement('textarea');
                input.rows = 4;
            } else {
                input = document.createElement('input');
                input.type = type;
            }
            input.name = name;
            // Pour les champs number, convertir en string
            if (type === 'number') {
                input.value = value !== undefined && value !== null ? String(value) : '0';
                input.min = '0';
            } else {
                input.value = value || '';
            }
            input.required = required;
            input.style.cssText = `
                padding: 6px 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 13px;
                font-family: inherit;
                width: 100%;
                box-sizing: border-box;
            `;

            container.appendChild(labelEl);
            container.appendChild(input);
            return { container, input };
        }

        // Champs du formulaire
        const urlField = createField('URL', 'url', eventData.url, true);
        urlField.input.readOnly = true;
        urlField.input.style.background = '#f5f5f5';

        const titleField = createField('Titre', 'title', eventData.title, true);
        const descField = createField('Description', 'description', eventData.description, false, 'textarea');
        // Convertir les dates ISO en format datetime-local avant de créer les champs
        let startDateTimeLocal = '';
        let endDateTimeLocal = '';

        if (eventData.start) {
            try {
                console.log('📅 [FOMO Bookmarklet] Date début ISO reçue:', eventData.start);
                const date = new Date(eventData.start);
                if (!isNaN(date.getTime())) {
                    // Convertir depuis UTC vers l'heure locale pour datetime-local
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    startDateTimeLocal = `${year}-${month}-${day}T${hours}:${minutes}`;
                    console.log('📅 [FOMO Bookmarklet] Date début convertie pour datetime-local:', startDateTimeLocal);
                } else {
                    console.warn('⚠️ [FOMO Bookmarklet] Date début invalide:', eventData.start);
                }
            } catch (e) {
                console.error('❌ [FOMO Bookmarklet] Erreur conversion date début:', e, eventData.start);
            }
        } else {
            console.warn('⚠️ [FOMO Bookmarklet] Pas de date début dans eventData');
        }

        if (eventData.end) {
            try {
                console.log('📅 [FOMO Bookmarklet] Date fin ISO reçue:', eventData.end);
                const date = new Date(eventData.end);
                if (!isNaN(date.getTime())) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    endDateTimeLocal = `${year}-${month}-${day}T${hours}:${minutes}`;
                    console.log('📅 [FOMO Bookmarklet] Date fin convertie pour datetime-local:', endDateTimeLocal);
                } else {
                    console.warn('⚠️ [FOMO Bookmarklet] Date fin invalide:', eventData.end);
                }
            } catch (e) {
                console.error('❌ [FOMO Bookmarklet] Erreur conversion date fin:', e, eventData.end);
            }
        }

        const startField = createField('Date de début (ISO)', 'start', startDateTimeLocal || eventData.start, true, 'datetime-local');
        const endField = createField('Date de fin (ISO)', 'end', endDateTimeLocal || eventData.end, false, 'datetime-local');
        const venueNameField = createField('Nom du lieu', 'venue_name', eventData.venue_name);
        const addressField = createField('Adresse du lieu', 'address', eventData.address);
        const hostField = createField('Organisateur', 'host', eventData.host);
        const coverField = createField('Image de couverture (URL)', 'cover', eventData.cover);
        const attendingField = createField('Nombre de participants', 'attending_count', eventData.attending_count || '', false, 'text');
        const interestedField = createField('Nombre d\'intéressés', 'interested_count', eventData.interested_count || '', false, 'text');

        // Logs pour vérifier les valeurs finales
        console.log('📅 [FOMO Bookmarklet] Valeur finale champ date début:', startField.input.value);
        console.log('📅 [FOMO Bookmarklet] Valeur finale champ date fin:', endField.input.value);

        // Ajouter les champs au formulaire
        form.appendChild(urlField.container);
        form.appendChild(titleField.container);
        form.appendChild(descField.container);
        form.appendChild(startField.container);
        form.appendChild(endField.container);
        form.appendChild(venueNameField.container);
        form.appendChild(addressField.container);
        form.appendChild(hostField.container);
        form.appendChild(coverField.container);
        form.appendChild(attendingField.container);
        form.appendChild(interestedField.container);

        // Ajouter l'en-tête et le formulaire au conteneur scrollable
        scrollableContent.appendChild(header);
        scrollableContent.appendChild(form);

        // Boutons (fixes en bas, non scrollables)
        const buttons = document.createElement('div');
        buttons.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee; flex-shrink: 0;';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Annuler';
        cancelBtn.style.cssText = `
            padding: 8px 16px;
            border: 1px solid #ccc;
            background: #f5f5f5;
            color: #333;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            min-width: 80px;
            flex-shrink: 0;
        `;
        cancelBtn.onclick = () => {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
            window.__FOMO_BOOKMARKLET_ACTIVE = false;
            onCancel();
        };

        const submitBtn = document.createElement('button');
        submitBtn.type = 'button'; // Changé de 'submit' à 'button' car le bouton n'est pas dans le form
        submitBtn.textContent = 'Envoyer';
        submitBtn.style.cssText = `
            padding: 8px 16px;
            border: none;
            background: #1877f2;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            min-width: 80px;
            flex-shrink: 0;
        `;
        // Déclencher manuellement la soumission du formulaire
        submitBtn.onclick = () => {
            console.log('🔘 [FOMO Bookmarklet] Bouton Envoyer cliqué');
            // Créer et déclencher l'événement submit
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(submitEvent);
        };

        buttons.appendChild(cancelBtn);
        buttons.appendChild(submitBtn);

        // Gestion de la soumission
        form.onsubmit = async (e) => {
            e.preventDefault();
            console.log('🔘 [FOMO Bookmarklet] Formulaire soumis');

            // Validation
            if (!titleField.input.value.trim()) {
                alert('Le titre est obligatoire');
                return;
            }
            if (!startField.input.value.trim()) {
                alert('La date de début est obligatoire');
                return;
            }

            // Convertir datetime-local en ISO si nécessaire
            let startISO = startField.input.value;
            if (startField.input.type === 'datetime-local') {
                try {
                    const date = new Date(startField.input.value);
                    if (!isNaN(date.getTime())) {
                        startISO = date.toISOString();
                    }
                } catch (e) {
                    alert('Format de date invalide');
                    return;
                }
            }

            let endISO = endField.input.value;
            if (endField.input.value && endField.input.type === 'datetime-local') {
                try {
                    const date = new Date(endField.input.value);
                    if (!isNaN(date.getTime())) {
                        endISO = date.toISOString();
                    }
                } catch (e) {
                    endISO = '';
                }
            }

            // Préparer les données
            const payload = {
                source: 'facebook',
                url: urlField.input.value.trim(),
                title: titleField.input.value.trim(),
                description: descField.input.value.trim(),
                start: startISO,
                end: endISO || undefined,
                venue_name: venueNameField.input.value.trim() || undefined,
                address: addressField.input.value.trim() || undefined,
                host: hostField.input.value.trim() || undefined,
                cover: coverField.input.value.trim() || undefined,
                attending_count: attendingField.input.value.trim() || undefined,
                interested_count: interestedField.input.value.trim() || undefined
            };

            // Désactiver le bouton pendant l'envoi
            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi...';

            console.log('📤 [FOMO Bookmarklet] Envoi du payload:', payload);

            try {
                await onConfirm(payload);
                console.log('✅ [FOMO Bookmarklet] onConfirm terminé avec succès');
            } catch (error) {
                console.error('❌ [FOMO Bookmarklet] Erreur dans onConfirm:', error);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Envoyer';
                alert('Erreur: ' + (error.message || 'Erreur inconnue'));
            }
        };

        // Assembler la modal
        modal.appendChild(scrollableContent);
        modal.appendChild(buttons);

        // Fermer avec Escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
                window.__FOMO_BOOKMARKLET_ACTIVE = false;
                document.removeEventListener('keydown', escapeHandler);
                onCancel();
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Ajouter la modal au body
        document.body.appendChild(modal);
    }

    /**
     * Envoyer les données à l'API via formulaire POST + popup
     * (contourne la same-origin policy et la CSP de Facebook)
     * Utilise un formulaire POST car c'est moins bloqué que window.open()
     */
    function sendToAPI(payload, password) {
        console.log('📤 [FOMO Bookmarklet] Envoi des données via formulaire POST...');

        return new Promise((resolve, reject) => {
            // Générer un requestId unique avec crypto.randomUUID() si disponible
            const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

            // Extraire expectedOrigin depuis location.origin
            const expectedOrigin = window.location.origin;

            // Créer un formulaire POST invisible
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = API_BASE_URL + '/ingest/event-form';
            form.target = 'fomo-bookmarklet-receiver';
            form.style.cssText = 'position: absolute; left: -9999px; opacity: 0; pointer-events: none;';

            // Ajouter la clé API (apiKey)
            const keyInput = document.createElement('input');
            keyInput.type = 'hidden';
            keyInput.name = 'apiKey';
            keyInput.value = password;
            form.appendChild(keyInput);

            // Ajouter requestId
            const requestIdInput = document.createElement('input');
            requestIdInput.type = 'hidden';
            requestIdInput.name = 'requestId';
            requestIdInput.value = requestId;
            form.appendChild(requestIdInput);

            // Ajouter expectedOrigin
            const expectedOriginInput = document.createElement('input');
            expectedOriginInput.type = 'hidden';
            expectedOriginInput.name = 'expectedOrigin';
            expectedOriginInput.value = expectedOrigin;
            form.appendChild(expectedOriginInput);

            // Ajouter toutes les données de l'événement
            for (const [key, value] of Object.entries(payload)) {
                if (value !== undefined && value !== null) {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = key;
                    input.value = typeof value === 'string' ? value : JSON.stringify(value);
                    form.appendChild(input);
                }
            }

            document.body.appendChild(form);

            // Déclarer timeoutId dans le scope parent pour pouvoir le nettoyer
            let timeoutId = null;

            // Écouter les réponses de la popup
            const messageHandler = (event) => {
                // Log tous les messages pour debug
                console.log('📨 [FOMO Bookmarklet] Message reçu:', {
                    origin: event.origin,
                    type: event.data?.type,
                    requestId: event.data?.requestId,
                    expectedRequestId: requestId
                });

                // Vérifier l'origine pour la sécurité
                // La popup vient de notre domaine (fomo-swart.vercel.app ou localhost:3001)
                const apiOrigin = API_BASE_URL.replace('/api', '').split('/').slice(0, 3).join('/');
                // Pour localhost, accepter aussi les variantes
                const allowedOrigins = apiOrigin.includes('localhost')
                    ? [apiOrigin, 'http://localhost:3001', 'http://127.0.0.1:3001']
                    : apiOrigin.includes('fomo-swart.vercel.app')
                        ? ['https://fomo-swart.vercel.app']
                        : [apiOrigin];

                // Vérifier que l'origine contient notre domaine
                const originMatches = allowedOrigins.some(origin => {
                    const originDomain = origin.replace('https://', '').replace('http://', '').split(':')[0];
                    return event.origin.includes(originDomain);
                });

                if (!originMatches) {
                    console.log('⚠️ [FOMO Bookmarklet] Message ignoré - origine incorrecte:', event.origin, 'attendu:', allowedOrigins);
                    return; // Ignorer les messages d'autres origines
                }

                // Vérifier que c'est bien une réponse pour cette requête
                if (event.data?.type === 'FOMO_INGEST_RESPONSE' && event.data?.requestId === requestId) {
                    console.log('✅ [FOMO Bookmarklet] Réponse reçue:', event.data);

                    // Nettoyer le timeout
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }

                    // Nettoyer
                    window.removeEventListener('message', messageHandler);
                    if (document.body.contains(form)) {
                        document.body.removeChild(form);
                    }

                    try {
                        const popup = window.open('', 'fomo-bookmarklet-receiver');
                        if (popup && !popup.closed) {
                            popup.close();
                        }
                    } catch (e) {
                        // Ignorer si déjà fermée
                    }

                    // Résoudre ou rejeter selon le résultat
                    if (event.data.ok) {
                        resolve({
                            ok: true,
                            id: event.data.id,
                            duplicate: event.data.duplicate || false
                        });
                    } else {
                        reject(new Error(event.data.error || 'Erreur inconnue'));
                    }
                }
            };

            window.addEventListener('message', messageHandler);

            // Soumettre le formulaire (ouvre une popup)
            console.log('📤 [FOMO Bookmarklet] Soumission du formulaire POST...');
            console.log('📤 [FOMO Bookmarklet] RequestId:', requestId);
            console.log('📤 [FOMO Bookmarklet] ExpectedOrigin:', expectedOrigin);
            form.submit();

            // Vérifier si la popup s'est ouverte (après un court délai)
            setTimeout(() => {
                try {
                    const popup = window.open('', 'fomo-bookmarklet-receiver');
                    if (popup && !popup.closed) {
                        console.log('✅ [FOMO Bookmarklet] Popup ouverte avec succès');
                    } else {
                        console.warn('⚠️ [FOMO Bookmarklet] Popup non accessible ou fermée');
                    }
                } catch (e) {
                    console.warn('⚠️ [FOMO Bookmarklet] Impossible de vérifier la popup:', e);
                }
            }, 500);

            // Timeout de sécurité (10 secondes)
            // Pas de fallback fetch/sendBeacon car ils sont bloqués par la CSP de Facebook
            timeoutId = setTimeout(() => {
                console.warn('⚠️ [FOMO Bookmarklet] Timeout après 10 secondes - pas de réponse du serveur');
                window.removeEventListener('message', messageHandler);
                if (document.body.contains(form)) {
                    document.body.removeChild(form);
                }
                reject(new Error('Timeout - la popup n\'a pas répondu. Vérifiez que les popups ne sont pas bloquées.'));
            }, 10000);
        });
    }

    /**
     * Point d'entrée principal
     */
    async function main() {
        try {
            // Vérifier que la clé API est configurée
            if (!FOMO_KEY || FOMO_KEY === 'VOTRE_CLE_API_ICI') {
                alert('⚠️ Erreur de configuration: La clé API FOMO n\'est pas définie.\n\nVeuillez modifier la constante FOMO_KEY dans le code du bookmarklet.');
                window.__FOMO_BOOKMARKLET_ACTIVE = false;
                return;
            }

            // Étape 1: Extraire les données
            const eventData = await extractEventData();

            // Étape 2: Afficher l'interface de validation
            showValidationModal(eventData, async (payload) => {
                // Étape 3: Envoyer les données directement à l'API
                console.log('🚀 [FOMO Bookmarklet] Callback onConfirm appelé avec payload:', payload);
                try {
                    // Envoyer à l'API via formulaire POST
                    const result = await sendToAPI(payload, FOMO_KEY);
                    console.log('✅ [FOMO Bookmarklet] Événement créé:', result);

                    // Afficher le message de succès selon l'architecture
                    if (result.ok) {
                        if (result.duplicate) {
                            alert('⚠️ Doublon détecté. L\'événement existe déjà ✅\nID: ' + result.id);
                        } else {
                            alert('Événement envoyé ✅\nID: ' + result.id);
                        }
                    } else {
                        alert('❌ Erreur: ' + (result.error || 'Erreur inconnue'));
                    }

                    // Fermer la modal
                    const modal = document.querySelector('#fomo-bookmarklet-modal');
                    if (modal && document.body.contains(modal)) {
                        document.body.removeChild(modal);
                    }
                    window.__FOMO_BOOKMARKLET_ACTIVE = false;
                } catch (error) {
                    console.error('❌ [FOMO Bookmarklet] Erreur dans callback onConfirm:', error);

                    // Afficher un message d'erreur dans la modal
                    const modal = document.querySelector('#fomo-bookmarklet-modal');
                    if (modal) {
                        const scrollableContent = modal.querySelector('div');
                        if (scrollableContent) {
                            const message = document.createElement('div');
                            message.style.cssText = `
                                padding: 12px;
                                margin-top: 12px;
                                border-radius: 4px;
                                background: #f8d7da;
                                color: #721c24;
                                font-size: 14px;
                                text-align: center;
                            `;
                            message.textContent = `❌ Erreur: ${error.message || 'Erreur inconnue'}`;
                            scrollableContent.appendChild(message);
                        }
                    }

                    // Réactiver le bouton en cas d'erreur
                    if (modal) {
                        const buttons = modal.querySelectorAll('button[type="button"]');
                        for (const btn of buttons) {
                            if (btn.textContent.trim() === 'Envoi...' || btn.textContent.trim() === 'Envoyer') {
                                btn.disabled = false;
                                btn.textContent = 'Envoyer';
                                break;
                            }
                        }
                    }
                }
            }, () => {
                // Annulation
                window.__FOMO_BOOKMARKLET_ACTIVE = false;
            });

        } catch (error) {
            alert('Erreur: ' + error.message);
            window.__FOMO_BOOKMARKLET_ACTIVE = false;
        }
    }

    // Lancer le processus
    main();
})();


