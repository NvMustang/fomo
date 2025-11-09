/**
 * Dashboard Page - Page Analytics
 * 
 * Page dédiée pour accéder au dashboard analytics via /analytics
 */

import Analytics from '@/components/ui/Analytics'

const DashboardPage: React.FC = () => {
    return (
        <div className="dashboard-page">
            <Analytics />
        </div>
    )
}

export default DashboardPage

