/**
 * FOMO MVP - Components Index
 * 
 * Index centralisé pour exporter uniquement les composants UI
 */

// Composants UI de base
export { Button } from './ui/Button'
export { Header } from './ui/Header'
export { EventCard } from './ui/EventCard'
export { default as EventCardDefault } from './ui/EventCard'
export { UserCard } from './ui/UserCard'
export { WelcomeScreen } from '@/onboarding/modals/WelcomeScreen'
export { Logo } from './ui/Logo'
export { ToggleLabelsWithExpendableList } from './ui/ToggleLabelsWithExpendableList'
export { NavBar } from './ui/NavBar'
export { MapIcon, ListIcon, ChatIcon, ProfileIcon, PlusIcon, SearchIcon } from './ui/NavIcons'

// Modales
export { AddFriendModal } from './modals/AddFriendModal'
export { default as CreateEventModal } from './modals/CreateEventModal'
export { UserConnexionModal } from '@/onboarding/modals/UserConnexionModal'
export { VisitorRegistrationModal } from '@/onboarding/modals/VisitorRegistrationModal'
export { BetaModal } from './modals/BetaModal'

// Composants utilitaires
export { LocationPicker } from './ui/LocationPicker'
export { AddressAutocomplete } from '../utils/AddressAutocomplete'
export { ImagePicker } from './ui/ImagePicker'
export { FomoDatePicker } from './ui/DatePicker'
export { DateRangePicker } from './ui/DateRangePicker'
