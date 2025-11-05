/**
 * FakeEventCard - Carte d'événement floutée pour les fake pins
 * 
 * Affiche une EventCard floutée avec un message teaser pour inciter à rejoindre FOMO
 */

import React from 'react'
import type { Event } from '@/types/fomoTypes'
import { Button } from '@/components'

interface FakeEventCardProps {
    event: Event
    onJoinClick?: () => void
    variantIndex?: number // Index de la variante (0-49) pour rotation
}

// URLs de bannières récupérées depuis la DB - 50 bannières pour plus de variété
const FAKE_EVENT_BANNERS = [
    'https://images.pexels.com/photos/140831/pexels-photo-140831.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1652340/pexels-photo-1652340.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/260024/pexels-photo-260024.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/33109/fall-autumn-red-season.jpg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/34311559/pexels-photo-34311559.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1692984/pexels-photo-1692984.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1763077/pexels-photo-1763077.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1763078/pexels-photo-1763078.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1763079/pexels-photo-1763079.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1763080/pexels-photo-1763080.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1763081/pexels-photo-1763081.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1763082/pexels-photo-1763082.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1763083/pexels-photo-1763083.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1763084/pexels-photo-1763084.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1763085/pexels-photo-1763085.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1763086/pexels-photo-1763086.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1763087/pexels-photo-1763087.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    // 30 nouvelles images variées
    'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/196652/pexels-photo-196652.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1047442/pexels-photo-1047442.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/976866/pexels-photo-976866.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1587927/pexels-photo-1587927.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/167636/pexels-photo-167636.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1677710/pexels-photo-1677710.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/167491/pexels-photo-167491.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/801863/pexels-photo-801863.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/796606/pexels-photo-796606.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/3171837/pexels-photo-3171837.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1684187/pexels-photo-1684187.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1071882/pexels-photo-1071882.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/787961/pexels-photo-787961.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/162553/keys-workshop-mechanic-tools-162553.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/3183197/pexels-photo-3183197.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/716276/pexels-photo-716276.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/301703/pexels-photo-301703.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1029243/pexels-photo-1029243.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/115558/pexels-photo-115558.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/834892/pexels-photo-834892.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/716281/pexels-photo-716281.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/162631/blacksmith-tools-shop-rustic-162631.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/280014/pexels-photo-280014.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/2774556/pexels-photo-2774556.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/50675/banquet-wedding-society-deco-50675.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/587741/pexels-photo-587741.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/2608517/pexels-photo-2608517.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/2263436/pexels-photo-2263436.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/16408/pexels-photo.jpg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/301987/pexels-photo-301987.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1540338/pexels-photo-1540338.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/433452/pexels-photo-433452.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1763067/pexels-photo-1763067.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    // Images supplémentaires pour variété
    'https://images.pexels.com/photos/167092/pexels-photo-167092.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1389429/pexels-photo-1389429.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/63703/pexels-photo-63703.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/144429/pexels-photo-144429.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/257904/pexels-photo-257904.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/534283/pexels-photo-534283.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1876279/pexels-photo-1876279.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/161154/stained-glass-spiral-circle-pattern-161154.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/102127/pexels-photo-102127.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1193743/pexels-photo-1193743.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/962312/pexels-photo-962312.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/743986/pexels-photo-743986.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1209843/pexels-photo-1209843.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/889839/pexels-photo-889839.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/159862/art-school-of-athens-raphael-italian-painter-fresco-159862.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1183992/pexels-photo-1183992.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1145720/pexels-photo-1145720.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1640773/pexels-photo-1640773.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1660030/pexels-photo-1660030.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/863988/pexels-photo-863988.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/248547/pexels-photo-248547.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/163452/basketball-dunk-blue-game-163452.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1618269/pexels-photo-1618269.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/34514/spot-runs-start-la.jpg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/209977/pexels-photo-209977.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/54567/pexels-photo-54567.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/551852/pexels-photo-551852.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/2078008/pexels-photo-2078008.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1089194/pexels-photo-1089194.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1557328/pexels-photo-1557328.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/941864/pexels-photo-941864.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1058277/pexels-photo-1058277.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/356056/pexels-photo-356056.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/158826/structure-light-led-movement-158826.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1714208/pexels-photo-1714208.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1089438/pexels-photo-1089438.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/3184460/pexels-photo-3184460.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/414860/pexels-photo-414860.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    'https://images.pexels.com/photos/60504/security-protection-anti-virus-software-60504.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'
]

// 50 variantes de templates pour FakeEventCard pour plus de variété
const FAKE_EVENT_VARIANTS = [
    {
        title: 'Concert Jazz Intime',
        venue: 'Bruxelles, Belgique',
        date: 'Vendredi 15 Mars',
        time: '20:00',
        coverUrl: FAKE_EVENT_BANNERS[0]
    },
    {
        title: 'Atelier Cuisine Italienne',
        venue: 'Liège, Belgique',
        date: 'Samedi 16 Mars',
        time: '14:00',
        coverUrl: FAKE_EVENT_BANNERS[1]
    },
    {
        title: 'Soirée Networking Tech',
        venue: 'Namur, Belgique',
        date: 'Dimanche 17 Mars',
        time: '18:30',
        coverUrl: FAKE_EVENT_BANNERS[2]
    },
    {
        title: 'Exposition Photo Urbaine',
        venue: 'Gand, Belgique',
        date: 'Lundi 18 Mars',
        time: '19:00',
        coverUrl: FAKE_EVENT_BANNERS[3]
    },
    {
        title: 'Workshop Développement Web',
        venue: 'Mons, Belgique',
        date: 'Mardi 19 Mars',
        time: '10:00',
        coverUrl: FAKE_EVENT_BANNERS[4]
    },
    {
        title: 'Festival de Musique Électro',
        venue: 'Anvers, Belgique',
        date: 'Mercredi 20 Mars',
        time: '22:00',
        coverUrl: FAKE_EVENT_BANNERS[5]
    },
    {
        title: 'Conférence Innovation',
        venue: 'Louvain, Belgique',
        date: 'Jeudi 21 Mars',
        time: '09:00',
        coverUrl: FAKE_EVENT_BANNERS[6]
    },
    {
        title: 'Atelier Poterie',
        venue: 'Tournai, Belgique',
        date: 'Vendredi 22 Mars',
        time: '15:00',
        coverUrl: FAKE_EVENT_BANNERS[7]
    },
    {
        title: 'Soirée Jeux de Société',
        venue: 'Charleroi, Belgique',
        date: 'Samedi 23 Mars',
        time: '19:30',
        coverUrl: FAKE_EVENT_BANNERS[8]
    },
    {
        title: 'Concert Acoustique',
        venue: 'Bruges, Belgique',
        date: 'Dimanche 24 Mars',
        time: '17:00',
        coverUrl: FAKE_EVENT_BANNERS[9]
    },
    {
        title: 'Workshop Design Graphique',
        venue: 'Malines, Belgique',
        date: 'Lundi 25 Mars',
        time: '10:30',
        coverUrl: FAKE_EVENT_BANNERS[10]
    },
    {
        title: 'Soirée Stand-up Comedy',
        venue: 'Ostende, Belgique',
        date: 'Mardi 26 Mars',
        time: '20:30',
        coverUrl: FAKE_EVENT_BANNERS[11]
    },
    {
        title: 'Atelier Yoga & Méditation',
        venue: 'Hasselt, Belgique',
        date: 'Mercredi 27 Mars',
        time: '18:00',
        coverUrl: FAKE_EVENT_BANNERS[12]
    },
    {
        title: 'Festival de Street Art',
        venue: 'Gand, Belgique',
        date: 'Jeudi 28 Mars',
        time: '14:00',
        coverUrl: FAKE_EVENT_BANNERS[13]
    },
    {
        title: 'Soirée Vin & Fromage',
        venue: 'Bruxelles, Belgique',
        date: 'Vendredi 29 Mars',
        time: '19:00',
        coverUrl: FAKE_EVENT_BANNERS[14]
    },
    {
        title: 'Workshop Photographie',
        venue: 'Liège, Belgique',
        date: 'Samedi 30 Mars',
        time: '13:00',
        coverUrl: FAKE_EVENT_BANNERS[15]
    },
    {
        title: 'Concert Rock Indé',
        venue: 'Namur, Belgique',
        date: 'Dimanche 31 Mars',
        time: '21:00',
        coverUrl: FAKE_EVENT_BANNERS[16]
    },
    {
        title: 'Atelier Pâtisserie',
        venue: 'Anvers, Belgique',
        date: 'Lundi 1er Avril',
        time: '16:00',
        coverUrl: FAKE_EVENT_BANNERS[17]
    },
    {
        title: 'Soirée Karaoké',
        venue: 'Louvain, Belgique',
        date: 'Mardi 2 Avril',
        time: '20:00',
        coverUrl: FAKE_EVENT_BANNERS[18]
    },
    {
        title: 'Festival de Danse',
        venue: 'Bruges, Belgique',
        date: 'Mercredi 3 Avril',
        time: '18:30',
        coverUrl: FAKE_EVENT_BANNERS[19]
    },
    // 30 nouvelles variantes avec styles très variés
    {
        title: 'Match de Football Amateur',
        venue: 'Charleroi, Belgique',
        date: 'Jeudi 4 Avril',
        time: '19:00',
        coverUrl: FAKE_EVENT_BANNERS[20]
    },
    {
        title: 'Exposition Art Contemporain',
        venue: 'Bruxelles, Belgique',
        date: 'Vendredi 5 Avril',
        time: '10:00',
        coverUrl: FAKE_EVENT_BANNERS[21]
    },
    {
        title: 'Soirée DJ Électro',
        venue: 'Anvers, Belgique',
        date: 'Samedi 6 Avril',
        time: '23:00',
        coverUrl: FAKE_EVENT_BANNERS[22]
    },
    {
        title: 'Atelier Sushi & Ramen',
        venue: 'Gand, Belgique',
        date: 'Dimanche 7 Avril',
        time: '12:00',
        coverUrl: FAKE_EVENT_BANNERS[23]
    },
    {
        title: 'Tournoi de Basket 3x3',
        venue: 'Liège, Belgique',
        date: 'Lundi 8 Avril',
        time: '14:00',
        coverUrl: FAKE_EVENT_BANNERS[24]
    },
    {
        title: 'Conférence IA & Machine Learning',
        venue: 'Louvain, Belgique',
        date: 'Mardi 9 Avril',
        time: '09:30',
        coverUrl: FAKE_EVENT_BANNERS[25]
    },
    {
        title: 'Concert Metal Local',
        venue: 'Namur, Belgique',
        date: 'Mercredi 10 Avril',
        time: '20:30',
        coverUrl: FAKE_EVENT_BANNERS[26]
    },
    {
        title: 'Dégustation Bières Artisanales',
        venue: 'Bruges, Belgique',
        date: 'Jeudi 11 Avril',
        time: '18:00',
        coverUrl: FAKE_EVENT_BANNERS[27]
    },
    {
        title: 'Workshop Menuiserie',
        venue: 'Mons, Belgique',
        date: 'Vendredi 12 Avril',
        time: '15:00',
        coverUrl: FAKE_EVENT_BANNERS[28]
    },
    {
        title: 'Soirée Poker Texas Hold\'em',
        venue: 'Ostende, Belgique',
        date: 'Samedi 13 Avril',
        time: '19:30',
        coverUrl: FAKE_EVENT_BANNERS[29]
    },
    {
        title: 'Atelier Calligraphie Chinoise',
        venue: 'Hasselt, Belgique',
        date: 'Dimanche 14 Avril',
        time: '11:00',
        coverUrl: FAKE_EVENT_BANNERS[30]
    },
    {
        title: 'Marathon de Lecture',
        venue: 'Bruxelles, Belgique',
        date: 'Lundi 15 Avril',
        time: '10:00',
        coverUrl: FAKE_EVENT_BANNERS[31]
    },
    {
        title: 'Tournoi E-Sport FIFA',
        venue: 'Anvers, Belgique',
        date: 'Mardi 16 Avril',
        time: '16:00',
        coverUrl: FAKE_EVENT_BANNERS[32]
    },
    {
        title: 'Soirée Vinyl Records',
        venue: 'Gand, Belgique',
        date: 'Mercredi 17 Avril',
        time: '20:00',
        coverUrl: FAKE_EVENT_BANNERS[33]
    },
    {
        title: 'Atelier Pâtisserie Vegan',
        venue: 'Liège, Belgique',
        date: 'Jeudi 18 Avril',
        time: '14:30',
        coverUrl: FAKE_EVENT_BANNERS[34]
    },
    {
        title: 'Course à Pied 5km',
        venue: 'Louvain, Belgique',
        date: 'Vendredi 19 Avril',
        time: '08:00',
        coverUrl: FAKE_EVENT_BANNERS[35]
    },
    {
        title: 'Concert Reggae Roots',
        venue: 'Namur, Belgique',
        date: 'Samedi 20 Avril',
        time: '21:00',
        coverUrl: FAKE_EVENT_BANNERS[36]
    },
    {
        title: 'Workshop Sérigraphie',
        venue: 'Bruges, Belgique',
        date: 'Dimanche 21 Avril',
        time: '13:00',
        coverUrl: FAKE_EVENT_BANNERS[37]
    },
    {
        title: 'Soirée Quiz Musical',
        venue: 'Charleroi, Belgique',
        date: 'Lundi 22 Avril',
        time: '19:00',
        coverUrl: FAKE_EVENT_BANNERS[38]
    },
    {
        title: 'Atelier Mixologie Cocktails',
        venue: 'Bruxelles, Belgique',
        date: 'Mardi 23 Avril',
        time: '18:30',
        coverUrl: FAKE_EVENT_BANNERS[39]
    },
    {
        title: 'Tournoi de Volley-Ball',
        venue: 'Anvers, Belgique',
        date: 'Mercredi 24 Avril',
        time: '17:00',
        coverUrl: FAKE_EVENT_BANNERS[40]
    },
    {
        title: 'Conférence Blockchain & Crypto',
        venue: 'Gand, Belgique',
        date: 'Jeudi 25 Avril',
        time: '10:00',
        coverUrl: FAKE_EVENT_BANNERS[41]
    },
    {
        title: 'Soirée Blues & Soul',
        venue: 'Liège, Belgique',
        date: 'Vendredi 26 Avril',
        time: '20:00',
        coverUrl: FAKE_EVENT_BANNERS[42]
    },
    {
        title: 'Atelier Poterie & Céramique',
        venue: 'Louvain, Belgique',
        date: 'Samedi 27 Avril',
        time: '15:00',
        coverUrl: FAKE_EVENT_BANNERS[43]
    },
    {
        title: 'Dégustation Vins Naturels',
        venue: 'Namur, Belgique',
        date: 'Dimanche 28 Avril',
        time: '17:00',
        coverUrl: FAKE_EVENT_BANNERS[44]
    },
    {
        title: 'Workshop Électronique DIY',
        venue: 'Bruges, Belgique',
        date: 'Lundi 29 Avril',
        time: '14:00',
        coverUrl: FAKE_EVENT_BANNERS[45]
    },
    {
        title: 'Soirée Trivia Night',
        venue: 'Ostende, Belgique',
        date: 'Mardi 30 Avril',
        time: '19:30',
        coverUrl: FAKE_EVENT_BANNERS[46]
    },
    {
        title: 'Atelier Cuisine Thaïlandaise',
        venue: 'Hasselt, Belgique',
        date: 'Mercredi 1er Mai',
        time: '18:00',
        coverUrl: FAKE_EVENT_BANNERS[47]
    },
    {
        title: 'Concert Folk Acoustique',
        venue: 'Bruxelles, Belgique',
        date: 'Jeudi 2 Mai',
        time: '20:00',
        coverUrl: FAKE_EVENT_BANNERS[48]
    },
    {
        title: 'Festival de Street Food',
        venue: 'Anvers, Belgique',
        date: 'Vendredi 3 Mai',
        time: '12:00',
        coverUrl: FAKE_EVENT_BANNERS[49]
    }
]

export const FakeEventCard: React.FC<FakeEventCardProps> = React.memo(({
    event: _event, // Gardé pour compatibilité avec l'interface mais non utilisé
    onJoinClick,
    variantIndex = 0
}) => {
    // Utiliser la variante selon l'index (rotation 0-49)
    const variant = FAKE_EVENT_VARIANTS[variantIndex % 50]

    return (
        <div className="event-card fake-event-card" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            {/* Overlay flouté sur le contenu */}
            <div className="fake-event-card-overlay">
                {/* Zone cliquable (similaire à EventCard) */}
                <div className="event-card-clickable-area fake-event-card-content">
                    {/* Zone fixe 1 - Photo (hauteur fixe) */}
                    <div className="event-card-banner">
                        {variant.coverUrl && (
                            <img
                                src={variant.coverUrl}
                                alt={variant.title}
                                style={{
                                    opacity: 0.6,
                                    objectPosition: 'center'
                                }}
                            />
                        )}
                    </div>

                    {/* Zone fixe 2 - Titre (hauteur fixe) */}
                    <div className="event-card-header" style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: 'var(--sm) var(--sm) 0',
                        flexShrink: 0,
                        opacity: 0.6,
                        pointerEvents: 'none'
                    }}>
                        <h3 className="event-card-title">{variant.title}</h3>
                    </div>

                    {/* Zone fixe 3 - Meta (hauteur fixe) */}
                    <div className="event-card-meta" style={{
                        flexShrink: 0,
                        opacity: 0.6,
                        pointerEvents: 'none'
                    }}>
                        <div className="meta-row">📍 {variant.venue}</div>
                        <div className="meta-row">📅 {variant.date} à {variant.time}</div>
                    </div>
                </div>

                {/* Message teaser centré par-dessus le contenu flouté */}
                <div className="fake-event-card-teaser">
                    <p className="fake-event-card-message">
                        Rejoins FOMO pour découvrir les détails de cet événement 🚀
                    </p>
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={onJoinClick}
                        className="fake-event-card-cta"
                    >
                        <span className="map-teaser-text" data-size="xs">
                            <span className="map-teaser-word"> G
                                <img
                                    src="/globe-icon.svg"
                                    alt="O"
                                    style={{
                                        height: '1em',
                                        width: '1em',
                                        display: 'block',
                                        filter: 'brightness(0) invert(1)',
                                        transform: 'translateY(-0.05em)'
                                    }}
                                />
                            </span>
                            <span className="map-teaser-word">
                                <img
                                    src="/lock-icon.svg"
                                    alt="O"
                                    style={{
                                        height: '1em',
                                        width: '1em',
                                        display: 'block',
                                        filter: 'brightness(0) invert(1)',
                                        transform: 'translateY(-0.05em)'
                                    }}
                                />N
                            </span>
                            <span className="map-teaser-word">F
                                <img
                                    src="/globe-icon.svg"
                                    alt="O"
                                    style={{
                                        height: '1em',
                                        width: '1em',
                                        display: 'block',
                                        filter: 'brightness(0) invert(1)',
                                        transform: 'translateY(-0.05em)'
                                    }}
                                />
                                M
                                <img
                                    src="/lock-icon.svg"
                                    alt="O"
                                    style={{
                                        height: '1em',
                                        width: '1em',
                                        display: 'block',
                                        filter: 'brightness(0) invert(1)',
                                        transform: 'translateY(-0.05em)'
                                    }}
                                />
                            </span>
                        </span>
                    </Button>
                </div>
            </div>
        </div>
    )
})

FakeEventCard.displayName = 'FakeEventCard'

export default FakeEventCard

