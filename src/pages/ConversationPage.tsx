
export default function ConversationPage() {
    console.log('🎭 [ConversationPage] COMPONENT RENDER')

    return (
        <div style={{ width: '100%', minHeight: '100vh', paddingTop: 'var(--lg)', paddingBottom: 'var(--xl)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--md)' }}>
                <div style={{ height: '60px' }}></div>
                <div className="card" style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    textAlign: 'center',
                    padding: 'var(--xl)',
                    marginBottom: 'var(--lg)',
                    marginTop: 'var(--lg)'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: 'var(--md)' }}>🚧</div>
                    <h3 style={{ margin: '0 0 var(--sm) 0', color: 'var(--text)' }}>Fonctionnalité à venir</h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        Le système de chat sera bientôt disponible pour discuter avec les autres participants aux événements.
                    </p>
                </div>

                <div style={{ height: '80px' }}></div>
            </div>
        </div>
    )
}


